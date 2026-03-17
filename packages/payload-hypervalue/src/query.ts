import type { Payload } from 'payload'

import { sql } from '@payloadcms/db-postgres/drizzle'

import type { DiscoveredCollection, DiscoveredField, HypervalueQueryArgs, HypervalueResult } from './types.js'

/**
 * Query hypervalue history — auto-detects narrow (field-level) vs wide (collection-level) tables.
 */
export async function queryHypervalue(
  payload: Payload,
  discoveredCollections: DiscoveredCollection[],
  discoveredFields: DiscoveredField[],
  args: HypervalueQueryArgs,
): Promise<HypervalueResult> {
  // Access control: verify user can read the document
  if (!args.overrideAccess) {
    await payload.findByID({
      collection: args.collection,
      id: args.id,
      req: args.req,
    })
  }

  const adapter = payload.db
  const drizzle = adapter.drizzle
  const schema = adapter.schemaName ?? 'public'
  const limit = args.limit ?? 100
  const offset = args.offset ?? 0

  // Route 1: field provided → narrow table first, wide table fallback
  if (args.field) {
    // Try narrow table match
    const hvField = discoveredFields.find(
      (f) => f.collectionSlug === args.collection && f.fieldName === args.field,
    )

    if (hvField) {
      return queryNarrowTable(drizzle, schema, hvField.tableName, args, limit, offset)
    }

    // Fallback: single field from wide table
    const hvCollection = discoveredCollections.find(
      (c) => c.collectionSlug === args.collection,
    )
    const hvColField = hvCollection?.fields.find((f) => f.fieldName === args.field)

    if (hvCollection && hvColField) {
      return queryWideTableSingleField(drizzle, schema, hvCollection.tableName, hvColField.columnName, args, limit, offset)
    }

    throw new Error(
      `[hypervalue] Field "${args.field}" on collection "${args.collection}" is not a hypervalue field.`,
    )
  }

  // Route 2: no field → wide table full snapshot
  const hvCollection = discoveredCollections.find(
    (c) => c.collectionSlug === args.collection,
  )

  if (!hvCollection) {
    throw new Error(
      `[hypervalue] Collection "${args.collection}" is not a collection-level hypervalue collection.`,
    )
  }

  return queryWideTableSnapshot(drizzle, schema, hvCollection.tableName, args, limit, offset)
}

/** Query narrow table (existing behavior) */
async function queryNarrowTable(
  drizzle: any,
  schema: string,
  tableName: string,
  args: HypervalueQueryArgs,
  limit: number,
  offset: number,
): Promise<HypervalueResult> {
  const qualifiedTable = sql.raw(`"${schema}"."${tableName}"`)

  if (args.at) {
    const result = await drizzle.execute(
      sql`SELECT value, recorded_at
        FROM ${qualifiedTable}
        WHERE document_id = ${args.id}
          AND recorded_at <= ${args.at.toISOString()}
        ORDER BY recorded_at DESC
        LIMIT 1`,
    )
    const rows = result.rows ?? result
    return { docs: rows }
  }

  if (args.from || args.to) {
    let whereClause = sql`document_id = ${args.id}`
    if (args.from) {
      whereClause = sql`${whereClause} AND recorded_at >= ${args.from.toISOString()}`
    }
    if (args.to) {
      whereClause = sql`${whereClause} AND recorded_at <= ${args.to.toISOString()}`
    }

    const result = await drizzle.execute(
      sql`SELECT value, recorded_at
        FROM ${qualifiedTable}
        WHERE ${whereClause}
        ORDER BY recorded_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
    )
    const countResult = await drizzle.execute(
      sql`SELECT COUNT(*)::int AS total
        FROM ${qualifiedTable}
        WHERE ${whereClause}`,
    )
    const rows = result.rows ?? result
    const countRows = countResult.rows ?? countResult
    return { docs: rows, totalDocs: countRows[0]?.total ?? 0 }
  }

  const result = await drizzle.execute(
    sql`SELECT value, recorded_at
      FROM ${qualifiedTable}
      WHERE document_id = ${args.id}
      ORDER BY recorded_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
  )
  const countResult = await drizzle.execute(
    sql`SELECT COUNT(*)::int AS total
      FROM ${qualifiedTable}
      WHERE document_id = ${args.id}`,
  )
  const rows = result.rows ?? result
  const countRows = countResult.rows ?? countResult
  return { docs: rows, totalDocs: countRows[0]?.total ?? 0 }
}

/** Query wide table for a single field — returns { value, recorded_at } shape */
async function queryWideTableSingleField(
  drizzle: any,
  schema: string,
  tableName: string,
  columnName: string,
  args: HypervalueQueryArgs,
  limit: number,
  offset: number,
): Promise<HypervalueResult> {
  const qualifiedTable = sql.raw(`"${schema}"."${tableName}"`)
  const columnRef = sql.raw(`"${columnName}"`)

  if (args.at) {
    const result = await drizzle.execute(
      sql`SELECT recorded_at, ${columnRef} AS value
        FROM ${qualifiedTable}
        WHERE document_id = ${args.id}
          AND recorded_at <= ${args.at.toISOString()}
        ORDER BY recorded_at DESC
        LIMIT 1`,
    )
    const rows = result.rows ?? result
    return { docs: rows }
  }

  if (args.from || args.to) {
    let whereClause = sql`document_id = ${args.id}`
    if (args.from) {
      whereClause = sql`${whereClause} AND recorded_at >= ${args.from.toISOString()}`
    }
    if (args.to) {
      whereClause = sql`${whereClause} AND recorded_at <= ${args.to.toISOString()}`
    }

    const result = await drizzle.execute(
      sql`SELECT recorded_at, ${columnRef} AS value
        FROM ${qualifiedTable}
        WHERE ${whereClause}
        ORDER BY recorded_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
    )
    const countResult = await drizzle.execute(
      sql`SELECT COUNT(*)::int AS total
        FROM ${qualifiedTable}
        WHERE ${whereClause}`,
    )
    const rows = result.rows ?? result
    const countRows = countResult.rows ?? countResult
    return { docs: rows, totalDocs: countRows[0]?.total ?? 0 }
  }

  const result = await drizzle.execute(
    sql`SELECT recorded_at, ${columnRef} AS value
      FROM ${qualifiedTable}
      WHERE document_id = ${args.id}
      ORDER BY recorded_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
  )
  const countResult = await drizzle.execute(
    sql`SELECT COUNT(*)::int AS total
      FROM ${qualifiedTable}
      WHERE document_id = ${args.id}`,
  )
  const rows = result.rows ?? result
  const countRows = countResult.rows ?? countResult
  return { docs: rows, totalDocs: countRows[0]?.total ?? 0 }
}

/** Query wide table for full snapshots — returns all columns */
async function queryWideTableSnapshot(
  drizzle: any,
  schema: string,
  tableName: string,
  args: HypervalueQueryArgs,
  limit: number,
  offset: number,
): Promise<HypervalueResult> {
  const qualifiedTable = sql.raw(`"${schema}"."${tableName}"`)

  if (args.at) {
    const result = await drizzle.execute(
      sql`SELECT *
        FROM ${qualifiedTable}
        WHERE document_id = ${args.id}
          AND recorded_at <= ${args.at.toISOString()}
        ORDER BY recorded_at DESC
        LIMIT 1`,
    )
    const rows = result.rows ?? result
    return { docs: rows }
  }

  if (args.from || args.to) {
    let whereClause = sql`document_id = ${args.id}`
    if (args.from) {
      whereClause = sql`${whereClause} AND recorded_at >= ${args.from.toISOString()}`
    }
    if (args.to) {
      whereClause = sql`${whereClause} AND recorded_at <= ${args.to.toISOString()}`
    }

    const result = await drizzle.execute(
      sql`SELECT *
        FROM ${qualifiedTable}
        WHERE ${whereClause}
        ORDER BY recorded_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
    )
    const countResult = await drizzle.execute(
      sql`SELECT COUNT(*)::int AS total
        FROM ${qualifiedTable}
        WHERE ${whereClause}`,
    )
    const rows = result.rows ?? result
    const countRows = countResult.rows ?? countResult
    return { docs: rows, totalDocs: countRows[0]?.total ?? 0 }
  }

  const result = await drizzle.execute(
    sql`SELECT *
      FROM ${qualifiedTable}
      WHERE document_id = ${args.id}
      ORDER BY recorded_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
  )
  const countResult = await drizzle.execute(
    sql`SELECT COUNT(*)::int AS total
      FROM ${qualifiedTable}
      WHERE document_id = ${args.id}`,
  )
  const rows = result.rows ?? result
  const countRows = countResult.rows ?? countResult
  return { docs: rows, totalDocs: countRows[0]?.total ?? 0 }
}
