import type { MethodDefinition, HypervalueDescriptor } from '../registry/types.js'
import type { DiscoveryResult } from '../types.js'
import type { Deferred } from './types.js'

export type CollectedEntry =
  | { ok: true; descriptor: HypervalueDescriptor; overrideAccess: boolean; args: Record<string, unknown>; methodDef: MethodDefinition }
  | { ok: false; error: Error }

function buildEntry(
  method: MethodDefinition,
  discovery: DiscoveryResult,
  args: Record<string, unknown>,
): CollectedEntry {
  try {
    const descriptor = method.build(discovery, args)
    return { ok: true, descriptor, overrideAccess: (args.overrideAccess as boolean) ?? false, args, methodDef: method }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

export function createBatchProxy(
  registry: Record<string, MethodDefinition>,
  discovery: DiscoveryResult,
): { proxy: Record<string, Function>; collected: CollectedEntry[] } {
  const collected: CollectedEntry[] = []
  const proxy: Record<string, Function> = {}

  for (const [name, method] of Object.entries(registry)) {
    proxy[name] = (args: Record<string, unknown>): Deferred<unknown> => {
      const entry = buildEntry(method, discovery, args)
      collected.push(entry)
      const descriptor = entry.ok ? entry.descriptor : null
      return { __brand: 'Deferred' as const, _descriptor: descriptor } as Deferred<unknown>
    }
  }

  return { proxy, collected }
}

export function createScopedBatchProxy(
  registry: Record<string, MethodDefinition>,
  discovery: DiscoveryResult,
  scope: Record<string, unknown>,
): { proxy: Record<string, Function>; collected: CollectedEntry[] } {
  const collected: CollectedEntry[] = []
  const proxy: Record<string, Function> = {}

  for (const [name, method] of Object.entries(registry)) {
    proxy[name] = (args: Record<string, unknown>): Deferred<unknown> => {
      const mergedArgs = { ...scope, ...args }
      const entry = buildEntry(method, discovery, mergedArgs)
      collected.push(entry)
      const descriptor = entry.ok ? entry.descriptor : null
      return { __brand: 'Deferred' as const, _descriptor: descriptor } as Deferred<unknown>
    }
  }

  return { proxy, collected }
}
