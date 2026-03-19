import { sql } from '@payloadcms/db-postgres/drizzle'
import type { SQL } from '@payloadcms/db-postgres/drizzle'
import type { Payload } from 'payload'
import type { DiscoveryResult } from '../types.js'

const NUMERIC_SQL_TYPES = new Set(['numeric', 'double precision', 'bigint'])

export type ResolvedTable = {
  tableName: string
  valueColumn: string
  isWide: boolean
  sqlValueType: string
}

/**
 * Resolve which hypertable and column to query for a given collection + field.
 * Narrow tables (field-level) take precedence over wide tables (collection-level).
 */
export function resolveTable(
  discovery: DiscoveryResult,
  args: { collectionSlug: string; fieldName: string },
): ResolvedTable {
  // Check narrow tables first (field-level tracking)
  const narrowField = discovery.fields.find(
    (f) => f.collectionSlug === args.collectionSlug && f.fieldName === args.fieldName,
  )
  if (narrowField) {
    return {
      tableName: narrowField.tableName,
      valueColumn: 'value',
      isWide: false,
      sqlValueType: narrowField.sqlValueType,
    }
  }

  // Check wide tables (collection-level tracking)
  const wideCollection = discovery.collections.find(
    (c) => c.collectionSlug === args.collectionSlug,
  )
  if (wideCollection) {
    const field = wideCollection.fields.find((f) => f.fieldName === args.fieldName)
    if (field) {
      return {
        tableName: wideCollection.tableName,
        valueColumn: field.columnName,
        isWide: true,
        sqlValueType: field.sqlValueType,
      }
    }
  }

  throw new Error(
    `[hypervalue] Field "${args.fieldName}" on collection "${args.collectionSlug}" is not tracked. ` +
      `Ensure it has hypervalue enabled in the collection or field config.`,
  )
}

/**
 * Validate that a field exists in the discovery result.
 * Throws if the field is not found.
 */
export function validateField(
  discovery: DiscoveryResult,
  args: { collectionSlug: string; fieldName: string },
): void {
  // Will throw if not found
  resolveTable(discovery, args)
}

/**
 * Validate that a field has a numeric SQL type.
 * Throws with a descriptive message if the field is non-numeric.
 */
export function validateNumeric(
  discovery: DiscoveryResult,
  args: { collectionSlug: string; fieldName: string },
  methodName: string,
): void {
  const resolved = resolveTable(discovery, args)
  if (!NUMERIC_SQL_TYPES.has(resolved.sqlValueType)) {
    throw new Error(
      `[hypervalue] Method "${methodName}" requires a numeric field, but "${args.fieldName}" ` +
        `on "${args.collectionSlug}" has SQL type "${resolved.sqlValueType}".`,
    )
  }
}

export type WhereClauseArgs = {
  id?: string | number
  from?: Date
  to?: Date
  where?: unknown
}

/**
 * Build a SQL WHERE clause from id, from, and to arguments.
 * The `where` parameter is reserved but not yet implemented.
 */
export function buildWhereClause(args: WhereClauseArgs): SQL {
  if (args.where) {
    throw new Error('[hypervalue] Custom "where" scoping is not yet implemented.')
  }

  const conditions: SQL[] = []

  if (args.id !== undefined) {
    conditions.push(sql`parent_id = ${args.id}`)
  }

  if (args.from) {
    conditions.push(sql`recorded_at >= ${args.from.toISOString()}`)
  }

  if (args.to) {
    conditions.push(sql`recorded_at <= ${args.to.toISOString()}`)
  }

  if (conditions.length === 0) {
    return sql`TRUE`
  }

  // Join conditions with AND
  return conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`)
}

/**
 * Run access control check via payload.findByID.
 * Skipped when overrideAccess is true.
 */
export async function checkAccess(
  payload: Payload,
  accessCheck: { collection: string; id?: string | number },
  args: { overrideAccess?: boolean; req?: unknown },
): Promise<void> {
  if (args.overrideAccess) return

  if (!accessCheck.id) return

  // This will throw if the user does not have read access
  await payload.findByID({
    collection: accessCheck.collection as any,
    id: accessCheck.id,
    req: args.req as any,
  })
}
