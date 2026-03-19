import { sql } from '@payloadcms/db-postgres/drizzle'
import type { SQL } from '@payloadcms/db-postgres/drizzle'

import { defineMethod } from '../registry/define.js'
import type { BaseArgs, WithOptionalField, WithTimeRange, WithPagination } from '../registry/args.js'
import type { HypervalueDescriptor } from '../registry/types.js'
import { resolvePointField } from '../registry/utils.js'

export type WithinArgs = BaseArgs & WithOptionalField & WithTimeRange & WithPagination & {
  /** GeoJSON geometry (Polygon, MultiPolygon, etc.) */
  geometry: object
}

type WithinRecord = {
  documentId: string | number
  value: [number, number]
  recorded_at: string
}

type WithinResult = {
  docs: WithinRecord[]
}

export const withinMethod = defineMethod<WithinArgs, WithinResult>({
  build: (discovery, args) => {
    const schema = discovery._schemaName ?? 'public'
    const resolved = resolvePointField(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    })

    const limit = args.limit ?? 100
    const qualifiedTable = sql.raw(`"${schema}"."${resolved.tableName}"`)
    const geoJson = JSON.stringify(args.geometry)

    // Build WHERE conditions
    const conditions: SQL[] = [
      sql`ST_Within(value::geometry, ST_GeomFromGeoJSON(${geoJson}))`,
    ]

    if (args.from) {
      conditions.push(sql`recorded_at >= ${args.from.toISOString()}`)
    }
    if (args.to) {
      conditions.push(sql`recorded_at <= ${args.to.toISOString()}`)
    }

    const whereClause = conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`)

    const sqlFragment = sql`SELECT
        document_id,
        ST_X(value::geometry) AS lng,
        ST_Y(value::geometry) AS lat,
        recorded_at
      FROM ${qualifiedTable}
      WHERE ${whereClause}
      ORDER BY recorded_at DESC
      LIMIT ${limit}`

    return {
      sqlFragment,
      parse: (rows: any[]) => ({
        docs: rows.map((r) => ({
          documentId: r.document_id,
          value: [Number(r.lng), Number(r.lat)] as [number, number],
          recorded_at: r.recorded_at,
        })),
      }),
      validate: () => {
        if (!args.geometry || typeof args.geometry !== 'object') {
          throw new Error('[hypervalue] within() requires a GeoJSON geometry argument.')
        }
      },
      accessCheck: { collection: args.collection },
    } as HypervalueDescriptor<WithinResult>
  },

  endpoint: {
    path: '/hypervalue/:collection/within',
    method: 'post',
    parseRequest: (params, query) => {
      // GeoJSON geometry comes in the request body — parsed by the endpoint handler
      // For now, provide minimal parsing from query params
      const args: WithinArgs = {
        collection: params.collection,
        geometry: {}, // Will be populated from request body
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
