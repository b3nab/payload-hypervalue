import { sql } from '@payloadcms/db-postgres/drizzle'
import type { SQL } from '@payloadcms/db-postgres/drizzle'

import { defineMethod } from '../registry/define.js'
import type { BaseArgs, WithOptionalField, WithId, WithTimeRange, WithPagination } from '../registry/args.js'
import type { HypervalueDescriptor } from '../registry/types.js'
import { resolvePointField } from '../registry/utils.js'

export type TrajectoryArgs = BaseArgs & WithOptionalField & WithId & WithTimeRange & WithPagination

type TrajectoryPoint = {
  coordinates: [number, number]
  recorded_at: string
}

type TrajectoryResult = {
  doc: {
    lineString: object | null
    points: TrajectoryPoint[]
  }
}

export const trajectoryMethod = defineMethod<TrajectoryArgs, TrajectoryResult>({
  build: (discovery, args) => {
    const schema = discovery._schemaName ?? 'public'
    const resolved = resolvePointField(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    })

    const limit = args.limit ?? 1000
    const qualifiedTable = sql.raw(`"${schema}"."${resolved.tableName}"`)

    // Build WHERE conditions
    const conditions: SQL[] = [
      sql`document_id = ${args.id}`,
    ]

    if (args.from) {
      conditions.push(sql`recorded_at >= ${args.from.toISOString()}`)
    }
    if (args.to) {
      conditions.push(sql`recorded_at <= ${args.to.toISOString()}`)
    }

    const whereClause = conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`)

    const sqlFragment = sql`WITH points AS (
        SELECT
          ST_X(value::geometry) AS lng,
          ST_Y(value::geometry) AS lat,
          recorded_at
        FROM ${qualifiedTable}
        WHERE ${whereClause}
        ORDER BY recorded_at
        LIMIT ${limit}
      )
      SELECT
        json_agg(
          json_build_object(
            'coordinates', ARRAY[lng, lat],
            'recorded_at', recorded_at
          ) ORDER BY recorded_at
        ) AS points,
        CASE
          WHEN COUNT(*) >= 2 THEN
            ST_AsGeoJSON(
              ST_MakeLine(
                array_agg(ST_SetSRID(ST_MakePoint(lng, lat), 4326) ORDER BY recorded_at)
              )
            )::json
          ELSE NULL
        END AS line_string
      FROM points`

    return {
      sqlFragment,
      parse: (rows: any[]) => {
        const row = rows[0]
        if (!row || !row.points) {
          return {
            doc: { lineString: null, points: [] },
          }
        }

        const points: TrajectoryPoint[] = row.points.map((p: any) => ({
          coordinates: [Number(p.coordinates[0]), Number(p.coordinates[1])] as [number, number],
          recorded_at: p.recorded_at,
        }))

        return {
          doc: {
            lineString: row.line_string ?? null,
            points,
          },
        }
      },
      validate: () => {
        if (!args.id) {
          throw new Error('[hypervalue] trajectory() requires an id argument.')
        }
      },
      accessCheck: { collection: args.collection, id: args.id },
    } as HypervalueDescriptor<TrajectoryResult>
  },

  endpoint: {
    path: '/hypervalue/:collection/trajectory',
    method: 'get',
    parseRequest: (params, query) => {
      const id = query.get('id')
      const args: TrajectoryArgs = {
        collection: params.collection,
        id: id ?? '',
      }
      const field = query.get('field')
      if (field) args.field = field
      const from = query.get('from')
      if (from) args.from = new Date(from)
      const to = query.get('to')
      if (to) args.to = new Date(to)
      const limit = query.get('limit')
      if (limit) args.limit = parseInt(limit, 10)
      return args
    },
  },
})
