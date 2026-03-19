import type { Payload } from 'payload'
import type { HypervalueDescriptor } from './types.js'
import { checkAccess } from './utils.js'

export async function executeDescriptor<TResult>(
  payload: Payload,
  descriptor: HypervalueDescriptor<TResult>,
  args: { overrideAccess?: boolean; req?: unknown },
): Promise<TResult> {
  descriptor.validate()
  await checkAccess(payload, descriptor.accessCheck, args)
  const drizzle = (payload.db as any).drizzle
  const result = await drizzle.execute(descriptor.sqlFragment)
  const rows = result.rows ?? result
  return descriptor.parse(rows)
}
