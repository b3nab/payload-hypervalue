import type { SQL } from '@payloadcms/db-postgres/drizzle'
import type { Where } from 'payload'
import type { DiscoveryResult } from '../types.js'

export interface HypervalueDescriptor<TResult = unknown> {
  sqlFragment: SQL
  parse: (rows: unknown[]) => TResult
  validate: () => void
  accessCheck: {
    collection: string
    id?: string | number
    where?: Where
  }
}

export interface EndpointConfig<TArgs = any> {
  path: string
  method: 'get' | 'post'
  parseRequest: (params: Record<string, string>, query: URLSearchParams) => TArgs
}

export interface MethodDefinition<TArgs = any, TResult = any> {
  build: (discovery: DiscoveryResult, args: TArgs) => HypervalueDescriptor<TResult>
  endpoint?: EndpointConfig<TArgs>
}

export type InferNamespace<T extends Record<string, MethodDefinition>> = {
  [K in keyof T]: T[K] extends MethodDefinition<infer TArgs, infer TResult>
    ? (args: TArgs) => Promise<TResult>
    : never
}
