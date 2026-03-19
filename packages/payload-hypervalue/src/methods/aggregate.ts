import { sql } from '@payloadcms/db-postgres/drizzle'
import type { PayloadRequest } from 'payload'

import { defineMethod } from '../registry/define.js'
import type { HypervalueDescriptor } from '../registry/types.js'
import { resolveTable, validateNumeric, buildWhereClause } from '../registry/utils.js'

export type AggregateMetric = 'avg' | 'sum' | 'min' | 'max' | 'count'

export type AggregateArgs = {
  collection: string
  field: string
  id?: string | number
  interval?: string
  metric: AggregateMetric
  from?: Date
  to?: Date
  req?: PayloadRequest
  overrideAccess?: boolean
}

type BucketedResult = { docs: { bucket: string; value: number }[] }
type SingleResult = { doc: { value: number } }
type AggregateResult = BucketedResult | SingleResult

const NUMERIC_ONLY_METRICS = new Set<AggregateMetric>(['avg', 'sum'])

export const aggregateMethod = defineMethod<AggregateArgs, AggregateResult>({
  build: (discovery, args) => {
    const schema = discovery._schemaName ?? 'public'
    const resolved = resolveTable(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    })

    // Validate numeric for avg/sum
    if (NUMERIC_ONLY_METRICS.has(args.metric)) {
      validateNumeric(discovery, {
        collectionSlug: args.collection,
        fieldName: args.field,
      }, args.metric)
    }

    const qualifiedTable = sql.raw(`"${schema}"."${resolved.tableName}"`)
    const columnRef = sql.raw(`"${resolved.valueColumn}"`)
    const whereClause = buildWhereClause(args)

    // Build the aggregate expression
    const castExpr = args.metric === 'count'
      ? sql.raw(`*`)
      : sql.raw(`"${resolved.valueColumn}"::numeric`)

    const aggExpr = buildAggExpr(args.metric, castExpr)

    if (args.interval) {
      // Bucketed aggregation
      const sqlFragment = sql`SELECT
        time_bucket(${args.interval}::interval, recorded_at) AS bucket,
        ${aggExpr} AS value
        FROM ${qualifiedTable}
        WHERE ${whereClause}
        GROUP BY bucket
        ORDER BY bucket`

      return {
        sqlFragment,
        parse: (rows: any[]) => ({
          docs: rows.map((r) => ({
            bucket: r.bucket instanceof Date ? r.bucket.toISOString() : String(r.bucket),
            value: Number(r.value),
          })),
        }),
        validate: () => {},
        accessCheck: { collection: args.collection, id: args.id },
      } as HypervalueDescriptor<AggregateResult>
    }

    // Single aggregate
    const sqlFragment = sql`SELECT ${aggExpr} AS value
      FROM ${qualifiedTable}
      WHERE ${whereClause}`

    return {
      sqlFragment,
      parse: (rows: any[]) => ({
        doc: { value: rows.length > 0 ? Number(rows[0].value) : 0 },
      }),
      validate: () => {},
      accessCheck: { collection: args.collection, id: args.id },
    } as HypervalueDescriptor<AggregateResult>
  },

  endpoint: {
    path: '/hypervalue/:collection/:field/aggregate',
    method: 'get',
    parseRequest: (params, query) => {
      const args: AggregateArgs = {
        collection: params.collection,
        field: params.field,
        metric: (query.get('metric') || 'avg') as AggregateMetric,
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

function buildAggExpr(metric: AggregateMetric, castExpr: ReturnType<typeof sql.raw>) {
  switch (metric) {
    case 'avg': return sql`avg(${castExpr})`
    case 'sum': return sql`sum(${castExpr})`
    case 'min': return sql`min(${castExpr})`
    case 'max': return sql`max(${castExpr})`
    case 'count': return sql`count(${castExpr})::int`
  }
}
