import { sql } from '@payloadcms/db-postgres/drizzle'
import type { SQL } from '@payloadcms/db-postgres/drizzle'
import type { CollectionSlug, PayloadRequest } from 'payload'

import { defineMethod } from '../registry/define.js'
import type { HypervalueDescriptor } from '../registry/types.js'
import { resolvePointField } from '../registry/utils.js'

export type NearbyArgs = {
  collection: CollectionSlug
  /** [lng, lat] */
  point: [number, number]
  /** Maximum distance in meters */
  maxDistance?: number
  /** Minimum distance in meters */
  minDistance?: number
  field?: string
  from?: Date
  to?: Date
  limit?: number
  req?: PayloadRequest
  overrideAccess?: boolean
}

type NearbyRecord = {
  documentId: string | number
  value: [number, number]
  recorded_at: string
  distance: number
}

type NearbyResult = {
  docs: NearbyRecord[]
}

export const nearbyMethod = defineMethod<NearbyArgs, NearbyResult>({
  build: (discovery, args) => {
    const schema = discovery._schemaName ?? 'public'
    const resolved = resolvePointField(discovery, {
      collectionSlug: args.collection,
      fieldName: args.field,
    })

    const limit = args.limit ?? 100
    const [lng, lat] = args.point
    const qualifiedTable = sql.raw(`"${schema}"."${resolved.tableName}"`)
    const refPoint = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`

    // Build WHERE conditions
    const conditions: SQL[] = []

    if (args.maxDistance !== undefined) {
      conditions.push(
        sql`ST_DWithin(value::geography, ${refPoint}, ${args.maxDistance})`,
      )
    }

    if (args.minDistance !== undefined) {
      conditions.push(
        sql`ST_Distance(value::geography, ${refPoint}) >= ${args.minDistance}`,
      )
    }

    if (args.from) {
      conditions.push(sql`recorded_at >= ${args.from.toISOString()}`)
    }
    if (args.to) {
      conditions.push(sql`recorded_at <= ${args.to.toISOString()}`)
    }

    const whereClause = conditions.length > 0
      ? conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`)
      : sql`TRUE`

    const sqlFragment = sql`SELECT
        document_id,
        ST_X(value::geometry) AS lng,
        ST_Y(value::geometry) AS lat,
        recorded_at,
        ST_Distance(value::geography, ${refPoint}) AS distance
      FROM ${qualifiedTable}
      WHERE ${whereClause}
      ORDER BY distance
      LIMIT ${limit}`

    return {
      sqlFragment,
      parse: (rows: any[]) => ({
        docs: rows.map((r) => ({
          documentId: r.document_id,
          value: [Number(r.lng), Number(r.lat)] as [number, number],
          recorded_at: r.recorded_at,
          distance: Number(r.distance),
        })),
      }),
      validate: () => {
        if (!args.point || !Array.isArray(args.point) || args.point.length !== 2) {
          throw new Error('[hypervalue] nearby() requires a point argument as [lng, lat].')
        }
      },
      accessCheck: { collection: args.collection },
    } as HypervalueDescriptor<NearbyResult>
  },

  endpoint: {
    path: '/hypervalue/:collection/nearby',
    method: 'get',
    parseRequest: (params, query) => {
      const lng = parseFloat(query.get('lng') || '0')
      const lat = parseFloat(query.get('lat') || '0')
      const args: NearbyArgs = {
        collection: params.collection,
        point: [lng, lat],
      }
      const maxDistance = query.get('maxDistance')
      if (maxDistance) args.maxDistance = parseFloat(maxDistance)
      const minDistance = query.get('minDistance')
      if (minDistance) args.minDistance = parseFloat(minDistance)
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
