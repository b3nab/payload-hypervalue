import { sql } from '@payloadcms/db-postgres/drizzle'
import type { CollectionSlug, PayloadRequest } from 'payload'

import { defineMethod } from '../registry/define.js'
import type { HypervalueDescriptor } from '../registry/types.js'
import { resolveTable, validateNumeric, buildWhereClause } from '../registry/utils.js'

export type CandlestickArgs = {
  collection: CollectionSlug
  field: string
  id?: string | number
  interval: string
  from?: Date
  to?: Date
  req?: PayloadRequest
  overrideAccess?: boolean
}

type CandlestickRecord = {
  bucket: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type CandlestickResult = {
  docs: CandlestickRecord[]
}

export const candlestickMethod = defineMethod<CandlestickArgs, CandlestickResult>({
  build: (discovery, args) => {
    const schema = discovery._schemaName ?? 'public'
    const resolved = resolveTable(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    })

    validateNumeric(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    }, 'candlestick')

    if (!args.interval) {
      throw new Error('[hypervalue] candlestick() requires an interval.')
    }

    const qualifiedTable = sql.raw(`"${schema}"."${resolved.tableName}"`)
    const castExpr = sql.raw(`"${resolved.valueColumn}"::numeric`)
    const whereClause = buildWhereClause(args)

    const sqlFragment = sql`SELECT
      time_bucket(${args.interval}::interval, recorded_at) AS bucket,
      first(${castExpr}, recorded_at) AS open,
      max(${castExpr}) AS high,
      min(${castExpr}) AS low,
      last(${castExpr}, recorded_at) AS close,
      count(*)::int AS volume
      FROM ${qualifiedTable}
      WHERE ${whereClause}
      GROUP BY bucket
      ORDER BY bucket`

    return {
      sqlFragment,
      parse: (rows: any[]) => ({
        docs: rows.map((r) => ({
          bucket: r.bucket instanceof Date ? r.bucket.toISOString() : String(r.bucket),
          open: Number(r.open),
          high: Number(r.high),
          low: Number(r.low),
          close: Number(r.close),
          volume: Number(r.volume),
        })),
      }),
      validate: () => {},
      accessCheck: { collection: args.collection, id: args.id },
    } as HypervalueDescriptor<CandlestickResult>
  },

  endpoint: {
    path: '/hypervalue/:collection/:field/candlestick',
    method: 'get',
    parseRequest: (params, query) => {
      const args: CandlestickArgs = {
        collection: params.collection,
        field: params.field,
        interval: query.get('interval') || '1 day',
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
