import { sql } from '@payloadcms/db-postgres/drizzle'
import type { SQL } from '@payloadcms/db-postgres/drizzle'

import { defineMethod } from '../registry/define.js'
import type { BaseArgs, WithField, WithOptionalId, WithTimeRange } from '../registry/args.js'
import type { HypervalueDescriptor } from '../registry/types.js'
import { resolveTable, validateNumeric, buildWhereClause } from '../registry/utils.js'

export type PercentileArgs = BaseArgs & WithField & WithOptionalId & WithTimeRange & {
  percentiles: number[]
}

type PercentileResult = {
  doc: Record<string, number>
}

export const percentileMethod = defineMethod<PercentileArgs, PercentileResult>({
  build: (discovery, args) => {
    const schema = discovery._schemaName ?? 'public'
    const resolved = resolveTable(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    })

    validateNumeric(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    }, 'percentile')

    if (!args.percentiles || args.percentiles.length === 0) {
      throw new Error('[hypervalue] percentile() requires at least one percentile value.')
    }

    for (const p of args.percentiles) {
      if (p < 0 || p > 1) {
        throw new Error(`[hypervalue] Percentile value ${p} is out of range [0, 1].`)
      }
    }

    const qualifiedTable = sql.raw(`"${schema}"."${resolved.tableName}"`)
    const castExpr = `"${resolved.valueColumn}"::numeric`
    const whereClause = buildWhereClause(args)

    // Build one percentile_cont per requested percentile
    const selectParts = args.percentiles.map((p) => {
      const alias = String(p)
      return sql.raw(
        `percentile_cont(${p}) WITHIN GROUP (ORDER BY ${castExpr}) AS "${alias}"`,
      )
    })

    // Combine select parts with commas
    let selectFragment: SQL = selectParts[0]
    for (let i = 1; i < selectParts.length; i++) {
      selectFragment = sql`${selectFragment}, ${selectParts[i]}`
    }

    const sqlFragment = sql`SELECT ${selectFragment}
      FROM ${qualifiedTable}
      WHERE ${whereClause}`

    return {
      sqlFragment,
      parse: (rows: any[]) => {
        if (rows.length === 0) {
          const doc: Record<string, number> = {}
          for (const p of args.percentiles) {
            doc[String(p)] = 0
          }
          return { doc }
        }
        const r = rows[0]
        const doc: Record<string, number> = {}
        for (const p of args.percentiles) {
          const key = String(p)
          doc[key] = r[key] !== null && r[key] !== undefined ? Number(r[key]) : 0
        }
        return { doc }
      },
      validate: () => {},
      accessCheck: { collection: args.collection, id: args.id },
    } as HypervalueDescriptor<PercentileResult>
  },

  endpoint: {
    path: '/hypervalue/:collection/:field/percentile',
    method: 'get',
    parseRequest: (params, query) => {
      const args: PercentileArgs = {
        collection: params.collection,
        field: params.field,
        percentiles: [],
      }
      const id = query.get('id')
      if (id) args.id = id
      const percentiles = query.get('percentiles')
      if (percentiles) {
        args.percentiles = percentiles.split(',').map(Number)
      }
      const from = query.get('from')
      if (from) args.from = new Date(from)
      const to = query.get('to')
      if (to) args.to = new Date(to)
      return args
    },
  },
})
