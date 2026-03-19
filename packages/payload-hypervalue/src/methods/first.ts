import { sql } from '@payloadcms/db-postgres/drizzle'
import type { SQL } from '@payloadcms/db-postgres/drizzle'

import { defineMethod } from '../registry/define.js'
import type { BaseArgs, WithField, WithOptionalId, WithTimeRange } from '../registry/args.js'
import type { HypervalueDescriptor } from '../registry/types.js'
import type { HypervalueRecord } from '../types.js'

export type FirstArgs = BaseArgs & WithField & WithOptionalId & WithTimeRange

type FirstResult = { doc: HypervalueRecord | null }

export const firstMethod = defineMethod<FirstArgs, FirstResult>({
  build: (discovery, args) => {
    const schema = discovery._schemaName ?? 'public'

    // Try narrow table first
    const narrowField = discovery.fields.find(
      (f) => f.collectionSlug === args.collection && f.fieldName === args.field,
    )

    if (narrowField) {
      return buildNarrowFirst(schema, narrowField.tableName, args)
    }

    // Fallback: single field from wide table
    const wideCollection = discovery.collections.find(
      (c) => c.collectionSlug === args.collection,
    )
    const wideField = wideCollection?.fields.find((f) => f.fieldName === args.field)

    if (wideCollection && wideField) {
      return buildWideFirst(schema, wideCollection.tableName, wideField.columnName, args)
    }

    throw new Error(
      `[hypervalue] Field "${args.field}" on collection "${args.collection}" is not a hypervalue field.`,
    )
  },

  endpoint: {
    path: '/hypervalue/:collection/:field/first',
    method: 'get',
    parseRequest: (params, query) => {
      const args: FirstArgs = {
        collection: params.collection,
        field: params.field,
      }
      const id = query.get('id')
      if (id) args.id = id
      const from = query.get('from')
      if (from) args.from = new Date(from)
      const to = query.get('to')
      if (to) args.to = new Date(to)
      return args
    },
  },
})

function buildNarrowFirst(
  schema: string,
  tableName: string,
  args: FirstArgs,
): HypervalueDescriptor<FirstResult> {
  const qualifiedTable = sql.raw(`"${schema}"."${tableName}"`)
  const whereClause = buildWhere(args)

  const sqlFragment = sql`SELECT value, recorded_at
    FROM ${qualifiedTable}
    WHERE ${whereClause}
    ORDER BY recorded_at ASC
    LIMIT 1`

  return {
    sqlFragment,
    parse: (rows) => ({ doc: rows.length > 0 ? (rows[0] as HypervalueRecord) : null }),
    validate: () => {},
    accessCheck: { collection: args.collection, id: args.id },
  }
}

function buildWideFirst(
  schema: string,
  tableName: string,
  columnName: string,
  args: FirstArgs,
): HypervalueDescriptor<FirstResult> {
  const qualifiedTable = sql.raw(`"${schema}"."${tableName}"`)
  const columnRef = sql.raw(`"${columnName}"`)
  const whereClause = buildWhere(args)

  const sqlFragment = sql`SELECT ${columnRef} AS value, recorded_at
    FROM ${qualifiedTable}
    WHERE ${whereClause} AND ${columnRef} IS NOT NULL
    ORDER BY recorded_at ASC
    LIMIT 1`

  return {
    sqlFragment,
    parse: (rows) => ({ doc: rows.length > 0 ? (rows[0] as HypervalueRecord) : null }),
    validate: () => {},
    accessCheck: { collection: args.collection, id: args.id },
  }
}

function buildWhere(args: FirstArgs): SQL {
  const parts: SQL[] = []
  if (args.id) {
    parts.push(sql`document_id = ${args.id}`)
  }
  if (args.from) {
    parts.push(sql`recorded_at >= ${args.from.toISOString()}`)
  }
  if (args.to) {
    parts.push(sql`recorded_at <= ${args.to.toISOString()}`)
  }
  if (parts.length === 0) {
    return sql`1=1`
  }
  let result = parts[0]
  for (let i = 1; i < parts.length; i++) {
    result = sql`${result} AND ${parts[i]}`
  }
  return result
}
