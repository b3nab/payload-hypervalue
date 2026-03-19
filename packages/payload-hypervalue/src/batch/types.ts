import type { HypervalueDescriptor, MethodDefinition } from '../registry/types.js'

export type Deferred<T> = {
  readonly __brand: 'Deferred'
  readonly __type: T
  readonly _descriptor: HypervalueDescriptor<T>
}

export type BatchSettledItem<T> =
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; reason: Error }

export type DeferredNamespace<T extends Record<string, MethodDefinition>> = {
  [K in keyof T]: T[K] extends MethodDefinition<infer TArgs, infer TResult>
    ? (args: TArgs) => Deferred<TResult>
    : never
}

export interface BatchOptions {
  maxConcurrency?: number
  failFast?: boolean
  transaction?: boolean
}

// The batch function supports multiple overloads:
// 1. Callback returning tuple: batch((hv) => [...] as const)
// 2. Callback returning record: batch((hv) => ({...}))
// 3. Scoped with callback: batch({ scope, fn })
export type BatchFunction = {
  // Tuple form
  <const T extends readonly Deferred<any>[]>(
    fn: (hv: DeferredNamespace<any>) => T,
    options?: BatchOptions,
  ): Promise<{ [K in keyof T]: T[K] extends Deferred<infer R> ? BatchSettledItem<R> : never }>

  // Record form
  <T extends Record<string, Deferred<any>>>(
    fn: (hv: DeferredNamespace<any>) => T,
    options?: BatchOptions,
  ): Promise<{ [K in keyof T]: T[K] extends Deferred<infer R> ? BatchSettledItem<R> : never }>

  // Scoped form
  <T extends Record<string, Deferred<any>>>(opts: {
    scope?: Record<string, any>
    fn: (hv: DeferredNamespace<any>) => T
    options?: BatchOptions
  }): Promise<{ [K in keyof T]: T[K] extends Deferred<infer R> ? BatchSettledItem<R> : never }>
}
