import type { HypervalueDescriptor, EndpointConfig, MethodDefinition } from './types.js'
import type { DiscoveryResult } from '../types.js'

export function defineMethod<TArgs, TResult>(def: {
  build: (discovery: DiscoveryResult, args: TArgs) => HypervalueDescriptor<TResult>
  endpoint?: EndpointConfig<TArgs>
}): MethodDefinition<TArgs, TResult> {
  return def
}
