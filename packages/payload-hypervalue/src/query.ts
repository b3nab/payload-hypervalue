import type { CollectionSlug, Payload } from 'payload'

import { sql } from '@payloadcms/db-postgres/drizzle'

import type { DiscoveredField, HypervalueQueryArgs, HypervalueResult } from './types.js'

/**
 * Query hypervalue history for a field.
 */
export async function queryHypervalue(
  payload: Payload,
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

  // Find the discovered field
  const hvField = discoveredFields.find(
    (f) => f.collectionSlug === args.collection && f.fieldName === args.field,
  )

  if (!hvField) {
    throw new Error(
      `[hypervalue] Field "${args.field}" on collection "${args.collection}" is not a hypervalue field.`,
    )
  }

  const adapter = payload.db
  const drizzle = adapter.drizzle
  const schema = adapter.schemaName ?? 'public'
  const qualifiedTable = sql.raw(`"${schema}"."${hvField.tableName}"`)
  const limit = args.limit ?? 100
  const offset = args.offset ?? 0

  // Point-in-time query
  if (args.at) {
    const atStr = args.at.toISOString()
    const result = await drizzle.execute(
      sql`SELECT value, recorded_at
        FROM ${qualifiedTable}
        WHERE document_id = ${args.id}
          AND recorded_at <= ${atStr}
        ORDER BY recorded_at DESC
        LIMIT 1`,
    )

    const rows = result.rows ?? result
    return { docs: rows }
  }

  // Range query
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

  // Full history (paginated)
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
