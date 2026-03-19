import { sql } from '@payloadcms/db-postgres/drizzle'
import type { SQL } from '@payloadcms/db-postgres/drizzle'
import type { CollectionSlug, Payload } from 'payload'
import type { DiscoveryResult } from '../types.js'

const NUMERIC_SQL_TYPES = new Set(['numeric', 'double precision', 'bigint'])
const POINT_SQL_TYPE = 'geometry(POINT, 4326)'

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
    conditions.push(sql`document_id = ${args.id}`)
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
  accessCheck: { collection: CollectionSlug; id?: string | number },
  args: { overrideAccess?: boolean; req?: unknown },
): Promise<void> {
  if (args.overrideAccess) return

  if (!accessCheck.id) return

  // This will throw if the user does not have read access
  await payload.findByID({
    collection: accessCheck.collection,
    id: accessCheck.id,
    req: args.req as any,
  })
}

/**
 * Resolve the Point field for a given collection.
 * If `fieldName` is provided, resolves that specific field and validates it's a point.
 * If not provided, auto-detects the single Point field on the collection.
 * Throws if no point field found or multiple point fields found without specifying one.
 */
export function resolvePointField(
  discovery: DiscoveryResult,
  args: { collectionSlug: string; fieldName?: string },
): ResolvedTable {
  if (args.fieldName) {
    const resolved = resolveTable(discovery, { collectionSlug: args.collectionSlug, fieldName: args.fieldName })
    if (resolved.sqlValueType !== POINT_SQL_TYPE) {
      throw new Error(
        `[hypervalue] Field "${args.fieldName}" on "${args.collectionSlug}" is not a Point field (type: ${resolved.sqlValueType}).`,
      )
    }
    return resolved
  }

  // Auto-detect: find all point fields for this collection
  const pointFields = discovery.fields.filter(
    (f) => f.collectionSlug === args.collectionSlug && f.sqlValueType === POINT_SQL_TYPE,
  )

  if (pointFields.length === 1) {
    return {
      tableName: pointFields[0].tableName,
      valueColumn: 'value',
      isWide: false,
      sqlValueType: POINT_SQL_TYPE,
    }
  }

  if (pointFields.length === 0) {
    throw new Error(
      `[hypervalue] No Point field found on collection "${args.collectionSlug}". ` +
        `Ensure a point field has hypervalue enabled.`,
    )
  }

  throw new Error(
    `[hypervalue] Multiple Point fields found on collection "${args.collectionSlug}": ` +
      `${pointFields.map((f) => f.fieldName).join(', ')}. Specify which one with the "field" parameter.`,
  )
}
