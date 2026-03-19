import { sql } from '@payloadcms/db-postgres/drizzle'
import type { CollectionSlug, PayloadRequest } from 'payload'

import { defineMethod } from '../registry/define.js'
import type { HypervalueDescriptor } from '../registry/types.js'
import { resolveTable, validateNumeric, buildWhereClause } from '../registry/utils.js'

export type GapfillMethod = 'locf' | 'interpolate'

export type GapfillArgs = {
  collection: CollectionSlug
  field: string
  id?: string | number
  interval: string
  from: Date
  to: Date
  method?: GapfillMethod
  req?: PayloadRequest
  overrideAccess?: boolean
}

type GapfillRow = { bucket: string; value: number | null }
type GapfillResult = { docs: GapfillRow[] }

export const gapfillMethod = defineMethod<GapfillArgs, GapfillResult>({
  build: (discovery, args) => {
    if (!args.from || !args.to) {
      throw new Error('[hypervalue] gapfill() requires both "from" and "to" arguments.')
    }

    const schema = discovery._schemaName ?? 'public'
    const resolved = resolveTable(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    })

    const fillMethod = args.method ?? 'locf'

    // interpolate requires numeric field; locf works on any type
    if (fillMethod === 'interpolate') {
      validateNumeric(discovery, {
        collectionSlug: args.collection,
        fieldName: args.field,
      }, 'gapfill (interpolate)')
    }

    const qualifiedTable = sql.raw(`"${schema}"."${resolved.tableName}"`)
    const castExpr = sql.raw(`"${resolved.valueColumn}"::numeric`)
    const fromStr = args.from.toISOString()
    const toStr = args.to.toISOString()

    // Build the fill function based on method
    const fillExpr = fillMethod === 'interpolate'
      ? sql`interpolate(avg(${castExpr}))`
      : sql`locf(avg(${castExpr}))`

    const sqlFragment = sql`SELECT
      time_bucket_gapfill(${args.interval}::interval, recorded_at, ${fromStr}::timestamptz, ${toStr}::timestamptz) AS bucket,
      ${fillExpr} AS value
      FROM ${qualifiedTable}
      WHERE document_id = ${args.id}
        AND recorded_at >= ${fromStr}::timestamptz
        AND recorded_at <= ${toStr}::timestamptz
      GROUP BY bucket
      ORDER BY bucket`

    return {
      sqlFragment,
      parse: (rows: any[]) => ({
        docs: rows.map((r) => ({
          bucket: r.bucket instanceof Date ? r.bucket.toISOString() : String(r.bucket),
          value: r.value !== null ? Number(r.value) : null,
        })),
      }),
      validate: () => {},
      accessCheck: { collection: args.collection, id: args.id },
    } as HypervalueDescriptor<GapfillResult>
  },

  endpoint: {
    path: '/hypervalue/:collection/:field/gapfill',
    method: 'get',
    parseRequest: (params, query) => {
      const from = query.get('from')
      const to = query.get('to')
      const interval = query.get('interval')

      if (!from || !to) {
        throw new Error('[hypervalue] gapfill endpoint requires "from" and "to" query parameters.')
      }
      if (!interval) {
        throw new Error('[hypervalue] gapfill endpoint requires "interval" query parameter.')
      }

      const args: GapfillArgs = {
        collection: params.collection,
        field: params.field,
        interval,
        from: new Date(from),
        to: new Date(to),
      }
      const id = query.get('id')
      if (id) args.id = id
      const method = query.get('method')
      if (method === 'locf' || method === 'interpolate') args.method = method
      return args
    },
  },
})
