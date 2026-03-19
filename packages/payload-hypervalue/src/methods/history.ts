import { sql } from '@payloadcms/db-postgres/drizzle'
import type { SQL } from '@payloadcms/db-postgres/drizzle'

import { defineMethod } from '../registry/define.js'
import type { BaseArgs, WithOptionalField, WithId, WithTimeRange, WithPagination } from '../registry/args.js'
import type { HypervalueDescriptor } from '../registry/types.js'
import type { HypervalueResult, HypervalueRecord, HypervalueSnapshotRecord } from '../types.js'

export type HistoryArgs = BaseArgs & WithId & WithOptionalField & WithTimeRange & WithPagination & {
  /** Point-in-time query */
  at?: Date
}

export const historyMethod = defineMethod<HistoryArgs, HypervalueResult>({
  build: (discovery, args) => {
    const schema = discovery._schemaName ?? 'public'
    const limit = args.limit ?? 10
    const offset = args.offset ?? 0

    // Route 1: field provided — narrow table first, wide table fallback
    if (args.field) {
      // Try narrow table match
      const narrowField = discovery.fields.find(
        (f) => f.collectionSlug === args.collection && f.fieldName === args.field,
      )

      if (narrowField) {
        return buildNarrowDescriptor(schema, narrowField.tableName, args, limit, offset)
      }

      // Fallback: single field from wide table
      const wideCollection = discovery.collections.find(
        (c) => c.collectionSlug === args.collection,
      )
      const wideField = wideCollection?.fields.find((f) => f.fieldName === args.field)

      if (wideCollection && wideField) {
        return buildWideSingleFieldDescriptor(
          schema,
          wideCollection.tableName,
          wideField.columnName,
          args,
          limit,
          offset,
        )
      }

      throw new Error(
        `[hypervalue] Field "${args.field}" on collection "${args.collection}" is not a hypervalue field.`,
      )
    }

    // Route 2: no field — wide table full snapshot
    const wideCollection = discovery.collections.find(
      (c) => c.collectionSlug === args.collection,
    )

    if (!wideCollection) {
      throw new Error(
        `[hypervalue] Collection "${args.collection}" is not a collection-level hypervalue collection.`,
      )
    }

    return buildWideSnapshotDescriptor(schema, wideCollection.tableName, args, limit, offset)
  },

  endpoint: {
    path: '/hypervalue/:collection/:id/:field?',
    method: 'get',
    parseRequest: (params, query) => {
      const args: HistoryArgs = {
        collection: params.collection,
        id: params.id,
        field: params.field || undefined,
      }
      const at = query.get('at')
      if (at) args.at = new Date(at)
      const from = query.get('from')
      if (from) args.from = new Date(from)
      const to = query.get('to')
      if (to) args.to = new Date(to)
      const limit = query.get('limit')
      if (limit) args.limit = parseInt(limit, 10)
      const queryOffset = query.get('offset')
      if (queryOffset) args.offset = parseInt(queryOffset, 10)
      return args
    },
  },
})

/** Build descriptor for narrow table (field-level) queries */
function buildNarrowDescriptor(
  schema: string,
  tableName: string,
  args: HistoryArgs,
  limit: number,
  offset: number,
): HypervalueDescriptor<HypervalueResult> {
  const qualifiedTable = sql.raw(`"${schema}"."${tableName}"`)

  if (args.at) {
    const sqlFragment = sql`SELECT value, recorded_at
      FROM ${qualifiedTable}
      WHERE document_id = ${args.id}
        AND recorded_at <= ${args.at.toISOString()}
      ORDER BY recorded_at DESC
      LIMIT 1`

    return {
      sqlFragment,
      parse: (rows) => ({ docs: rows as HypervalueRecord[] }),
      validate: () => {},
      accessCheck: { collection: args.collection, id: args.id },
    }
  }

  // Range or default query
  const whereClause = buildWhere(args)

  const dataQuery = sql`SELECT value, recorded_at
    FROM ${qualifiedTable}
    WHERE ${whereClause}
    ORDER BY recorded_at DESC
    LIMIT ${limit} OFFSET ${offset}`

  const countQuery = sql`SELECT COUNT(*)::int AS total
    FROM ${qualifiedTable}
    WHERE ${whereClause}`

  // We need both queries — combine into a single SQL using a CTE isn't ideal.
  // Instead, we'll use a compound approach: execute the data query as the main fragment,
  // and embed the count logic into the parse step via a second execution.
  // But executeDescriptor only runs one query. So we concatenate both results.
  // Actually, let's use a single query with a window function for totalDocs.
  const combinedQuery = sql`WITH data AS (
    SELECT value, recorded_at
    FROM ${qualifiedTable}
    WHERE ${whereClause}
    ORDER BY recorded_at DESC
    LIMIT ${limit} OFFSET ${offset}
  ), total AS (
    SELECT COUNT(*)::int AS total
    FROM ${qualifiedTable}
    WHERE ${whereClause}
  )
  SELECT d.*, t.total FROM data d, total t`

  return {
    sqlFragment: combinedQuery,
    parse: (rows: any[]) => {
      const totalDocs = rows.length > 0 ? rows[0].total : 0
      const docs = rows.map(({ total: _, ...rest }) => rest) as HypervalueRecord[]
      return { docs, totalDocs }
    },
    validate: () => {},
    accessCheck: { collection: args.collection, id: args.id },
  }
}

/** Build descriptor for wide table single field queries */
function buildWideSingleFieldDescriptor(
  schema: string,
  tableName: string,
  columnName: string,
  args: HistoryArgs,
  limit: number,
  offset: number,
): HypervalueDescriptor<HypervalueResult> {
  const qualifiedTable = sql.raw(`"${schema}"."${tableName}"`)
  const columnRef = sql.raw(`"${columnName}"`)

  if (args.at) {
    const sqlFragment = sql`SELECT recorded_at, ${columnRef} AS value
      FROM ${qualifiedTable}
      WHERE document_id = ${args.id}
        AND recorded_at <= ${args.at.toISOString()}
      ORDER BY recorded_at DESC
      LIMIT 1`

    return {
      sqlFragment,
      parse: (rows) => ({ docs: rows as HypervalueRecord[] }),
      validate: () => {},
      accessCheck: { collection: args.collection, id: args.id },
    }
  }

  const whereClause = buildWhere(args)

  const combinedQuery = sql`WITH data AS (
    SELECT recorded_at, ${columnRef} AS value
    FROM ${qualifiedTable}
    WHERE ${whereClause}
    ORDER BY recorded_at DESC
    LIMIT ${limit} OFFSET ${offset}
  ), total AS (
    SELECT COUNT(*)::int AS total
    FROM ${qualifiedTable}
    WHERE ${whereClause}
  )
  SELECT d.*, t.total FROM data d, total t`

  return {
    sqlFragment: combinedQuery,
    parse: (rows: any[]) => {
      const totalDocs = rows.length > 0 ? rows[0].total : 0
      const docs = rows.map(({ total: _, ...rest }) => rest) as HypervalueRecord[]
      return { docs, totalDocs }
    },
    validate: () => {},
    accessCheck: { collection: args.collection, id: args.id },
  }
}

/** Build descriptor for wide table snapshot queries */
function buildWideSnapshotDescriptor(
  schema: string,
  tableName: string,
  args: HistoryArgs,
  limit: number,
  offset: number,
): HypervalueDescriptor<HypervalueResult> {
  const qualifiedTable = sql.raw(`"${schema}"."${tableName}"`)

  if (args.at) {
    const sqlFragment = sql`SELECT *
      FROM ${qualifiedTable}
      WHERE document_id = ${args.id}
        AND recorded_at <= ${args.at.toISOString()}
      ORDER BY recorded_at DESC
      LIMIT 1`

    return {
      sqlFragment,
      parse: (rows) => ({ docs: rows as HypervalueSnapshotRecord[] }),
      validate: () => {},
      accessCheck: { collection: args.collection, id: args.id },
    }
  }

  const whereClause = buildWhere(args)

  const combinedQuery = sql`WITH data AS (
    SELECT *
    FROM ${qualifiedTable}
    WHERE ${whereClause}
    ORDER BY recorded_at DESC
    LIMIT ${limit} OFFSET ${offset}
  ), total AS (
    SELECT COUNT(*)::int AS total
    FROM ${qualifiedTable}
    WHERE ${whereClause}
  )
  SELECT d.*, t.total FROM data d, total t`

  return {
    sqlFragment: combinedQuery,
    parse: (rows: any[]) => {
      const totalDocs = rows.length > 0 ? rows[0].total : 0
      const docs = rows.map(({ total: _, ...rest }) => rest) as HypervalueSnapshotRecord[]
      return { docs, totalDocs }
    },
    validate: () => {},
    accessCheck: { collection: args.collection, id: args.id },
  }
}

/** Build WHERE clause for document_id + optional time range */
function buildWhere(args: HistoryArgs): SQL {
  let whereClause = sql`document_id = ${args.id}`
  if (args.from) {
    whereClause = sql`${whereClause} AND recorded_at >= ${args.from.toISOString()}`
  }
  if (args.to) {
    whereClause = sql`${whereClause} AND recorded_at <= ${args.to.toISOString()}`
  }
  return whereClause
}
