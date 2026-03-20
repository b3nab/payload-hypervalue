import type { Payload } from 'payload'
import type { MethodDefinition } from '../registry/types.js'
import type { DiscoveryResult } from '../types.js'
import type { BatchOptions, BatchSettledItem } from './types.js'
import { createBatchProxy, createScopedBatchProxy } from './proxy.js'
import type { CollectedEntry } from './proxy.js'
import { checkAccess, resolveWhereIds } from '../registry/utils.js'

export async function executeBatch(
  payload: Payload,
  registry: Record<string, MethodDefinition>,
  discovery: DiscoveryResult,
  fnOrOpts: Function | { scope?: Record<string, any>; fn: Function; options?: BatchOptions },
  externalOptions?: BatchOptions,
): Promise<any> {
  // Resolve fn, scope, options from overloaded args
  let fn: Function
  let scope: Record<string, any> | undefined
  let options: BatchOptions = {}

  if (typeof fnOrOpts === 'function') {
    fn = fnOrOpts
    options = externalOptions ?? {}
  } else {
    fn = fnOrOpts.fn
    scope = fnOrOpts.scope
    options = fnOrOpts.options ?? {}
  }

  // Create proxy — if scope provided, merge into each call's args
  const { proxy, collected } = scope
    ? createScopedBatchProxy(registry, discovery, scope)
    : createBatchProxy(registry, discovery)

  // Call user's callback to collect descriptors
  const shape = fn(proxy)
  const isArray = Array.isArray(shape)
  const entries: any[] = isArray ? shape : Object.values(shape)
  const keys: string[] | null = isArray ? null : Object.keys(shape)

  // Resolve where-based scoping: convert Where clauses to document IDs
  // and rebuild affected descriptors with resolved IDs
  for (const entry of collected) {
    if (!entry.ok) continue
    if (entry.args.where && !entry.args.id) {
      const ids = await resolveWhereIds(payload, entry.args.collection as string, entry.args.where)
      entry.args._resolvedIds = ids
      // Rebuild descriptor with resolved IDs
      try {
        entry.descriptor = entry.methodDef.build(discovery, entry.args as never)
      } catch (err) {
        // Convert to failed entry in-place
        ;(entry as unknown as { ok: false; error: Error }).ok = false
        ;(entry as unknown as { ok: false; error: Error }).error = err instanceof Error ? err : new Error(String(err))
      }
    }
  }

  // Deduplicate access checks by (collection, id, overrideAccess)
  // Skip access checks where overrideAccess is true, and skip pre-failed entries
  const accessMap = new Map<string, Promise<void>>()
  for (const entry of collected) {
    if (!entry.ok) continue
    if (entry.overrideAccess) continue
    if (entry.descriptor.accessCheck.id) {
      const key = `${entry.descriptor.accessCheck.collection}::${entry.descriptor.accessCheck.id}`
      if (!accessMap.has(key)) {
        accessMap.set(
          key,
          checkAccess(payload, entry.descriptor.accessCheck, { overrideAccess: false }),
        )
      }
    }
  }
  await Promise.all(accessMap.values())

  // Execute with Promise.allSettled (or Promise.all if failFast)
  // Validate + execute are wrapped together so validation errors are per-item
  // Pre-failed entries (build errors) are immediately rejected
  const drizzle = (payload.db as any).drizzle
  const executeFn = async (entry: CollectedEntry): Promise<any> => {
    if (!entry.ok) {
      throw entry.error
    }
    entry.descriptor.validate()
    const result = await drizzle.execute(entry.descriptor.sqlFragment)
    const rows = result.rows ?? result
    return entry.descriptor.parse(rows)
  }

  let results: BatchSettledItem<any>[]

  if (options.failFast) {
    // Promise.all — first failure throws
    const values = await Promise.all(collected.map(executeFn))
    results = values.map((v) => ({ status: 'fulfilled' as const, value: v }))
  } else {
    // Promise.allSettled — all results returned
    const settled = await Promise.allSettled(collected.map(executeFn))
    results = settled.map((r) =>
      r.status === 'fulfilled'
        ? { status: 'fulfilled' as const, value: r.value }
        : {
            status: 'rejected' as const,
            reason: r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
          },
    )
  }

  // Map results back to original shape
  if (isArray) {
    return results
  }

  const obj: Record<string, any> = {}
  keys!.forEach((key, i) => {
    obj[key] = results[i]
  })
  return obj
}
