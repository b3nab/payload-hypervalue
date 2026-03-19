import { sql } from '@payloadcms/db-postgres/drizzle'
import type { PayloadRequest } from 'payload'

import { defineMethod } from '../registry/define.js'
import type { HypervalueDescriptor } from '../registry/types.js'
import { resolveTable, buildWhereClause } from '../registry/utils.js'

export type TimeInStateArgs = {
  collection: string
  field: string
  id?: string | number
  from?: Date
  to?: Date
  req?: PayloadRequest
  overrideAccess?: boolean
}

type TimeInStateRow = { state: unknown; duration: number; unit: 'seconds' }
type TimeInStateResult = { docs: TimeInStateRow[] }

export const timeInStateMethod = defineMethod<TimeInStateArgs, TimeInStateResult>({
  build: (discovery, args) => {
    const schema = discovery._schemaName ?? 'public'
    const resolved = resolveTable(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    })

    const qualifiedTable = sql.raw(`"${schema}"."${resolved.tableName}"`)
    const columnRef = sql.raw(`"${resolved.valueColumn}"`)
    const whereClause = buildWhereClause(args)

    const sqlFragment = sql`WITH transitions AS (
        SELECT
          ${columnRef} AS state,
          recorded_at,
          LEAD(recorded_at) OVER (ORDER BY recorded_at) AS next_at
        FROM ${qualifiedTable}
        WHERE ${whereClause}
      )
      SELECT
        state,
        EXTRACT(EPOCH FROM SUM(COALESCE(next_at, NOW()) - recorded_at))::numeric AS duration
      FROM transitions
      GROUP BY state
      ORDER BY duration DESC`

    return {
      sqlFragment,
      parse: (rows: any[]) => ({
        docs: rows.map((r) => ({
          state: r.state,
          duration: Number(r.duration),
          unit: 'seconds' as const,
        })),
      }),
      validate: () => {},
      accessCheck: { collection: args.collection, id: args.id },
    } as HypervalueDescriptor<TimeInStateResult>
  },

  endpoint: {
    path: '/hypervalue/:collection/:field/time-in-state',
    method: 'get',
    parseRequest: (params, query) => {
      const args: TimeInStateArgs = {
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
