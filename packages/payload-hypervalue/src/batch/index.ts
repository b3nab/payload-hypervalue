import type { Payload } from 'payload'
import type { MethodDefinition } from '../registry/types.js'
import type { DiscoveryResult } from '../types.js'
import type { BatchFunction } from './types.js'
import { executeBatch } from './execute.js'

export function createBatchFunction(
  payload: Payload,
  registry: Record<string, MethodDefinition>,
  discovery: DiscoveryResult,
): BatchFunction {
  return ((fnOrOpts: any, options?: any) => {
    return executeBatch(payload, registry, discovery, fnOrOpts, options)
  }) as BatchFunction
}
