import type { PayloadHandler } from 'payload'
import type { MethodDefinition } from './types.js'
import type { DiscoveryResult } from '../types.js'
import { executeDescriptor } from './execute.js'

export function createEndpointsFromRegistry(
  registry: Record<string, MethodDefinition>,
  discovery: DiscoveryResult,
) {
  const endpoints: Array<{
    path: string
    method: 'get' | 'post'
    handler: PayloadHandler
  }> = []

  for (const [, method] of Object.entries(registry)) {
    if (!method.endpoint) continue

    const { path, method: httpMethod, parseRequest } = method.endpoint

    const handler: PayloadHandler = async (req) => {
      try {
        const url = new URL(req.url!)
        const pathSegments = url.pathname.split('/').filter(Boolean)
        const hvIdx = pathSegments.indexOf('hypervalue')

        // Extract path params from URL segments after 'hypervalue'
        // Parse the path template to find param positions
        const templateSegments = path
          .replace(/^\/hypervalue\//, '')
          .split('/')
          .filter(Boolean)
        const params: Record<string, string> = {}
        templateSegments.forEach((seg: string, i: number) => {
          if (seg.startsWith(':')) {
            const paramName = seg.replace(/\?$/, '').slice(1)
            const value = pathSegments[hvIdx + 1 + i]
            if (value) {
              params[paramName] = value
            }
          }
        })

        const args = parseRequest(params, url.searchParams)
        const descriptor = method.build(discovery, { ...args, req })

        // executeDescriptor handles validate + access check + execute + parse
        // REST endpoints always enforce access control (overrideAccess: false)
        const result = await executeDescriptor(req.payload, descriptor, {
          ...args,
          req,
          overrideAccess: false,
        })
        return Response.json(result)
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error))
        if (
          err.name === 'NotFound' ||
          err.message?.includes('not found') ||
          err.message?.includes('Not Found')
        ) {
          return Response.json({ errors: [{ message: err.message }] }, { status: 404 })
        }
        if (err.name === 'Forbidden' || err.message?.includes('not allowed')) {
          return Response.json({ errors: [{ message: 'Forbidden' }] }, { status: 403 })
        }
        return Response.json({ errors: [{ message: err.message }] }, { status: 500 })
      }
    }

    endpoints.push({ path, method: httpMethod, handler })
  }

  return endpoints
}
