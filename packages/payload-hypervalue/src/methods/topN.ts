import { sql } from '@payloadcms/db-postgres/drizzle'
import type { CollectionSlug, PayloadRequest } from 'payload'

import { defineMethod } from '../registry/define.js'
import type { HypervalueDescriptor } from '../registry/types.js'
import type { HypervalueRecord } from '../types.js'
import { resolveTable, buildWhereClause } from '../registry/utils.js'

export type TopNArgs = {
  collection: CollectionSlug
  field: string
  id?: string | number
  n: number
  direction: 'asc' | 'desc'
  from?: Date
  to?: Date
  req?: PayloadRequest
  overrideAccess?: boolean
}

type TopNResult = {
  docs: HypervalueRecord[]
}

export const topNMethod = defineMethod<TopNArgs, TopNResult>({
  build: (discovery, args) => {
    const schema = discovery._schemaName ?? 'public'
    const resolved = resolveTable(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    })

    if (!args.n || args.n < 1) {
      throw new Error('[hypervalue] topN() requires n >= 1.')
    }

    if (args.direction !== 'asc' && args.direction !== 'desc') {
      throw new Error('[hypervalue] topN() requires direction to be "asc" or "desc".')
    }

    const qualifiedTable = sql.raw(`"${schema}"."${resolved.tableName}"`)
    const whereClause = buildWhereClause(args)

    // For narrow tables, value column is "value"; for wide tables, it's the column name
    const columnRef = sql.raw(`"${resolved.valueColumn}"`)
    const orderExpr = sql.raw(`"${resolved.valueColumn}"::numeric ${args.direction.toUpperCase()}`)

    const sqlFragment = sql`SELECT ${columnRef} AS value, recorded_at
      FROM ${qualifiedTable}
      WHERE ${whereClause}
      ORDER BY ${orderExpr}
      LIMIT ${args.n}`

    return {
      sqlFragment,
      parse: (rows: any[]) => ({
        docs: rows.map((r) => ({
          value: r.value,
          recorded_at: r.recorded_at,
        })) as HypervalueRecord[],
      }),
      validate: () => {},
      accessCheck: { collection: args.collection, id: args.id },
    } as HypervalueDescriptor<TopNResult>
  },

  endpoint: {
    path: '/hypervalue/:collection/:field/topn',
    method: 'get',
    parseRequest: (params, query) => {
      const args: TopNArgs = {
        collection: params.collection,
        field: params.field,
        n: parseInt(query.get('n') || '10', 10),
        direction: (query.get('direction') || 'desc') as 'asc' | 'desc',
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
