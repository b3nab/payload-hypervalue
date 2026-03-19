import type { Payload } from 'payload'
import type { HypervalueDescriptor } from './types.js'
import { checkAccess } from './utils.js'

/**
 * Execute a hypervalue descriptor: validate, check access, run SQL, parse.
 * Generic version preserves the result type.
 */
export async function executeDescriptor<TResult>(
  payload: Payload,
  descriptor: HypervalueDescriptor<TResult>,
  args: { overrideAccess?: boolean; req?: unknown },
): Promise<TResult> {
  return runDescriptor(payload, descriptor, args) as Promise<TResult>
}

/**
 * Internal execution that accepts any descriptor.
 * Used by the namespace loop where descriptor type is a union.
 */
export async function runDescriptor(
  payload: Payload,
  descriptor: HypervalueDescriptor<unknown>,
  args: { overrideAccess?: boolean; req?: unknown },
): Promise<unknown> {
  descriptor.validate()
  await checkAccess(payload, descriptor.accessCheck, args)
  const drizzle = (payload.db as unknown as { drizzle: { execute: (sql: unknown) => Promise<{ rows?: unknown[] }> } }).drizzle
  const result = await drizzle.execute(descriptor.sqlFragment)
  const rows = (result.rows ?? result) as unknown[]
  return descriptor.parse(rows)
}
