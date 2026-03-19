import { sql } from '@payloadcms/db-postgres/drizzle'
import type { PayloadRequest } from 'payload'

import { defineMethod } from '../registry/define.js'
import type { HypervalueDescriptor } from '../registry/types.js'
import { resolveTable, validateNumeric, buildWhereClause } from '../registry/utils.js'

export type DeltaArgs = {
  collection: string
  field: string
  id?: string | number
  interval?: string
  from?: Date
  to?: Date
  req?: PayloadRequest
  overrideAccess?: boolean
}

type PerRecordDelta = { delta: number; rate: number | null; recorded_at: string }
type BucketedDelta = { bucket: string; delta: number }

type DeltaResult =
  | { docs: PerRecordDelta[] }
  | { docs: BucketedDelta[] }

export const deltaMethod = defineMethod<DeltaArgs, DeltaResult>({
  build: (discovery, args) => {
    const schema = discovery._schemaName ?? 'public'
    const resolved = resolveTable(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    })

    validateNumeric(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    }, 'delta')

    const qualifiedTable = sql.raw(`"${schema}"."${resolved.tableName}"`)
    const castExpr = sql.raw(`"${resolved.valueColumn}"::numeric`)
    const whereClause = buildWhereClause(args)

    if (args.interval) {
      // Bucketed deltas: last() - first() per bucket
      const sqlFragment = sql`SELECT
        time_bucket(${args.interval}::interval, recorded_at) AS bucket,
        last(${castExpr}, recorded_at) - first(${castExpr}, recorded_at) AS delta
        FROM ${qualifiedTable}
        WHERE ${whereClause}
        GROUP BY bucket
        ORDER BY bucket`

      return {
        sqlFragment,
        parse: (rows: any[]) => ({
          docs: rows.map((r) => ({
            bucket: r.bucket instanceof Date ? r.bucket.toISOString() : String(r.bucket),
            delta: Number(r.delta),
          })),
        }),
        validate: () => {},
        accessCheck: { collection: args.collection, id: args.id },
      } as HypervalueDescriptor<DeltaResult>
    }

    // Per-record deltas using window functions
    // We select all rows including the first (which has NULL delta) and filter in parse
    const sqlFragment = sql`SELECT
      ${castExpr} - LAG(${castExpr}) OVER (ORDER BY recorded_at) AS delta,
      CASE
        WHEN LAG(recorded_at) OVER (ORDER BY recorded_at) IS NOT NULL
        THEN (${castExpr} - LAG(${castExpr}) OVER (ORDER BY recorded_at)) /
             NULLIF(EXTRACT(EPOCH FROM recorded_at - LAG(recorded_at) OVER (ORDER BY recorded_at)), 0)
        ELSE NULL
      END AS rate,
      recorded_at
      FROM ${qualifiedTable}
      WHERE ${whereClause}
      ORDER BY recorded_at`

    return {
      sqlFragment,
      parse: (rows: any[]) => ({
        // Filter out the first row which has NULL delta (no previous value to compare)
        docs: rows
          .filter((r) => r.delta !== null)
          .map((r) => ({
            delta: Number(r.delta),
            rate: r.rate !== null ? Number(r.rate) : null,
            recorded_at: r.recorded_at instanceof Date ? r.recorded_at.toISOString() : String(r.recorded_at),
          })),
      }),
      validate: () => {},
      accessCheck: { collection: args.collection, id: args.id },
    } as HypervalueDescriptor<DeltaResult>
  },

  endpoint: {
    path: '/hypervalue/:collection/:field/delta',
    method: 'get',
    parseRequest: (params, query) => {
      const args: DeltaArgs = {
        collection: params.collection,
        field: params.field,
      }
      const id = query.get('id')
      if (id) args.id = id
      const interval = query.get('interval')
      if (interval) args.interval = interval
      const from = query.get('from')
      if (from) args.from = new Date(from)
      const to = query.get('to')
      if (to) args.to = new Date(to)
      return args
    },
  },
})
