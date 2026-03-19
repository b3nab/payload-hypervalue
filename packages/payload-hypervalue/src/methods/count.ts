import { sql } from '@payloadcms/db-postgres/drizzle'
import type { SQL } from '@payloadcms/db-postgres/drizzle'
import type { PayloadRequest } from 'payload'

import { defineMethod } from '../registry/define.js'
import type { HypervalueDescriptor } from '../registry/types.js'

export type CountArgs = {
  collection: string
  field?: string
  id?: string | number
  /** Range query start */
  from?: Date
  /** Range query end */
  to?: Date
  /** Request object for access control */
  req?: PayloadRequest
  /** Bypass access control. Default: false */
  overrideAccess?: boolean
}

type CountResult = { totalDocs: number }

export const countMethod = defineMethod<CountArgs, CountResult>({
  build: (discovery, args) => {
    const schema = discovery._schemaName ?? 'public'

    // Route 1: field provided — narrow table first, wide table fallback
    if (args.field) {
      const narrowField = discovery.fields.find(
        (f) => f.collectionSlug === args.collection && f.fieldName === args.field,
      )

      if (narrowField) {
        return buildCount(schema, narrowField.tableName, args)
      }

      // Fallback: wide table — verify field exists
      const wideCollection = discovery.collections.find(
        (c) => c.collectionSlug === args.collection,
      )
      const wideField = wideCollection?.fields.find((f) => f.fieldName === args.field)

      if (wideCollection && wideField) {
        return buildCount(schema, wideCollection.tableName, args)
      }

      throw new Error(
        `[hypervalue] Field "${args.field}" on collection "${args.collection}" is not a hypervalue field.`,
      )
    }

    // Route 2: no field — wide table
    const wideCollection = discovery.collections.find(
      (c) => c.collectionSlug === args.collection,
    )

    if (!wideCollection) {
      throw new Error(
        `[hypervalue] Collection "${args.collection}" is not a collection-level hypervalue collection.`,
      )
    }

    return buildCount(schema, wideCollection.tableName, args)
  },

  endpoint: {
    path: '/hypervalue/:collection/:field/count',
    method: 'get',
    parseRequest: (params, query) => {
      const args: CountArgs = {
        collection: params.collection,
        field: params.field || undefined,
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

function buildCount(
  schema: string,
  tableName: string,
  args: CountArgs,
): HypervalueDescriptor<CountResult> {
  const qualifiedTable = sql.raw(`"${schema}"."${tableName}"`)
  const whereClause = buildWhere(args)

  const sqlFragment = sql`SELECT COUNT(*)::int AS total
    FROM ${qualifiedTable}
    WHERE ${whereClause}`

  return {
    sqlFragment,
    parse: (rows: any[]) => ({ totalDocs: rows.length > 0 ? rows[0].total : 0 }),
    validate: () => {},
    accessCheck: { collection: args.collection, id: args.id },
  }
}

function buildWhere(args: CountArgs): SQL {
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
