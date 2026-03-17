import type { PayloadHandler } from 'payload'

import type { DiscoveredCollection, DiscoveredField } from '../types.js'
import { queryHypervalue } from '../query.js'

/**
 * Factory to create the hypervalue REST endpoint handler.
 * Routes:
 *   GET /api/hypervalue/:collection/:id/:field  (single field history)
 *   GET /api/hypervalue/:collection/:id          (full snapshot history)
 */
export function createHypervalueEndpoint(
  discoveredCollections: DiscoveredCollection[],
  discoveredFields: DiscoveredField[],
): PayloadHandler {
  return async (req) => {
    try {
      const url = new URL(req.url!)
      const pathParts = url.pathname.split('/').filter(Boolean)

      // Expected: ['api', 'hypervalue', collection, id] or ['api', 'hypervalue', collection, id, field]
      const hypervalueIdx = pathParts.indexOf('hypervalue')
      if (hypervalueIdx === -1 || pathParts.length < hypervalueIdx + 3) {
        return Response.json(
          { error: 'Invalid path. Expected /api/hypervalue/:collection/:id[/:field]' },
          { status: 400 },
        )
      }

      const collection = pathParts[hypervalueIdx + 1]
      const id = pathParts[hypervalueIdx + 2]
      const field = pathParts[hypervalueIdx + 3] // undefined for collection-level queries

      const at = url.searchParams.get('at')
      const from = url.searchParams.get('from')
      const to = url.searchParams.get('to')
      const limit = url.searchParams.get('limit')
      const offset = url.searchParams.get('offset')

      const result = await queryHypervalue(req.payload, discoveredCollections, discoveredFields, {
        collection,
        id,
        field,
        at: at ? new Date(at) : undefined,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        req,
        overrideAccess: false,
      })

      return Response.json(result)
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      if (err.name === 'NotFound' || err.message?.includes('not found')) {
        return Response.json({ error: 'Not found' }, { status: 404 })
      }
      if (err.name === 'Forbidden' || err.message?.includes('not allowed')) {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
      return Response.json({ error: err.message }, { status: 500 })
    }
  }
}
