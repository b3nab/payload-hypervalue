import { sql } from '@payloadcms/db-postgres/drizzle'

import { defineMethod } from '../registry/define.js'
import type { BaseArgs, WithField, WithOptionalId, WithTimeRange } from '../registry/args.js'
import type { HypervalueDescriptor } from '../registry/types.js'
import { resolveTable, validateNumeric, buildWhereClause } from '../registry/utils.js'

export type StatsArgs = BaseArgs & WithField & WithOptionalId & WithTimeRange

type StatsResult = {
  doc: {
    mean: number | null
    stddev: number | null
    variance: number | null
    min: number | null
    max: number | null
    count: number
  }
}

export const statsMethod = defineMethod<StatsArgs, StatsResult>({
  build: (discovery, args) => {
    const schema = discovery._schemaName ?? 'public'
    const resolved = resolveTable(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    })

    validateNumeric(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    }, 'stats')

    const qualifiedTable = sql.raw(`"${schema}"."${resolved.tableName}"`)
    const castExpr = sql.raw(`"${resolved.valueColumn}"::numeric`)
    const whereClause = buildWhereClause(args)

    const sqlFragment = sql`SELECT
      avg(${castExpr}) AS mean,
      stddev_samp(${castExpr}) AS stddev,
      variance(${castExpr}) AS variance,
      min(${castExpr}) AS min,
      max(${castExpr}) AS max,
      count(*)::int AS count
      FROM ${qualifiedTable}
      WHERE ${whereClause}`

    return {
      sqlFragment,
      parse: (rows: any[]) => {
        if (rows.length === 0) {
          return { doc: { mean: null, stddev: null, variance: null, min: null, max: null, count: 0 } }
        }
        const r = rows[0]
        return {
          doc: {
            mean: r.mean !== null ? Number(r.mean) : null,
            stddev: r.stddev !== null ? Number(r.stddev) : null,
            variance: r.variance !== null ? Number(r.variance) : null,
            min: r.min !== null ? Number(r.min) : null,
            max: r.max !== null ? Number(r.max) : null,
            count: Number(r.count),
          },
        }
      },
      validate: () => {},
      accessCheck: { collection: args.collection, id: args.id },
    } as HypervalueDescriptor<StatsResult>
  },

  endpoint: {
    path: '/hypervalue/:collection/:field/stats',
    method: 'get',
    parseRequest: (params, query) => {
      const args: StatsArgs = {
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
