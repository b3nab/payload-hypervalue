import type { MethodDefinition, HypervalueDescriptor } from '../registry/types.js'
import type { DiscoveryResult } from '../types.js'
import type { Deferred } from './types.js'

export type CollectedEntry =
  | { ok: true; descriptor: HypervalueDescriptor; overrideAccess: boolean }
  | { ok: false; error: Error }

export function createBatchProxy(
  registry: Record<string, MethodDefinition>,
  discovery: DiscoveryResult,
): { proxy: Record<string, Function>; collected: CollectedEntry[] } {
  const collected: CollectedEntry[] = []
  const proxy: Record<string, Function> = {}

  for (const [name, method] of Object.entries(registry)) {
    proxy[name] = (args: any): Deferred<any> => {
      try {
        const descriptor = method.build(discovery, args)
        collected.push({
          ok: true,
          descriptor,
          overrideAccess: args?.overrideAccess ?? false,
        })
        return { __brand: 'Deferred' as const, _descriptor: descriptor } as any
      } catch (err) {
        collected.push({
          ok: false,
          error: err instanceof Error ? err : new Error(String(err)),
        })
        return { __brand: 'Deferred' as const, _descriptor: null } as any
      }
    }
  }

  return { proxy, collected }
}

export function createScopedBatchProxy(
  registry: Record<string, MethodDefinition>,
  discovery: DiscoveryResult,
  scope: Record<string, any>,
): { proxy: Record<string, Function>; collected: CollectedEntry[] } {
  const collected: CollectedEntry[] = []
  const proxy: Record<string, Function> = {}

  for (const [name, method] of Object.entries(registry)) {
    proxy[name] = (args: any): Deferred<any> => {
      try {
        const mergedArgs = { ...scope, ...args }
        const descriptor = method.build(discovery, mergedArgs)
        collected.push({
          ok: true,
          descriptor,
          overrideAccess: mergedArgs?.overrideAccess ?? false,
        })
        return { __brand: 'Deferred' as const, _descriptor: descriptor } as any
      } catch (err) {
        collected.push({
          ok: false,
          error: err instanceof Error ? err : new Error(String(err)),
        })
        return { __brand: 'Deferred' as const, _descriptor: null } as any
      }
    }
  }

  return { proxy, collected }
}
