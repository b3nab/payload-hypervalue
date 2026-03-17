import type { CollectionAfterChangeHook } from 'payload'

import { sql } from '@payloadcms/db-postgres/drizzle'

import type { DiscoveredCollection, DiscoveredField, HypervaluePluginConfig } from './types.js'

/**
 * Get the transaction-scoped drizzle instance from the request,
 * falling back to the main drizzle instance.
 */
function getDrizzle(adapter: any, req: any): any {
  if (req.transactionID && adapter.sessions?.[req.transactionID]?.db) {
    return adapter.sessions[req.transactionID].db
  }
  return adapter.drizzle
}

/** Traverse nested object using a path array */
function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/**
 * Create an afterChange hook that records full snapshots to a wide hypertable.
 */
export function createCollectionAfterChangeHook(
  collection: DiscoveredCollection,
  config: HypervaluePluginConfig,
): CollectionAfterChangeHook {
  return async ({ doc, req }) => {
    // Skip drafts unless configured to track them
    if (doc._status && doc._status !== 'published' && !config.trackDrafts) return doc

    const adapter = req.payload.db
    const schema = adapter.schemaName ?? 'public'
    const drizzle = getDrizzle(adapter, req)
    const qualifiedTable = sql.raw(`"${schema}"."${collection.tableName}"`)
    const recordedAt = new Date().toISOString()

    // Build column names and parameterized values for full snapshot
    const columnNames = collection.fields.map((f) => sql.raw(`"${f.columnName}"`))
    const fieldValues = collection.fields.map((field) => {
      const raw = getNestedValue(doc, field.fieldPath)
      if (field.sqlValueType === 'jsonb' && raw != null) return sql`${JSON.stringify(raw)}`
      return sql`${raw ?? null}`
    })

    const columns = sql.join(columnNames, sql`, `)
    const values = sql.join(fieldValues, sql`, `)

    await drizzle.execute(
      sql`INSERT INTO ${qualifiedTable} (recorded_at, document_id, ${columns})
          VALUES (${recordedAt}, ${doc.id}, ${values})`,
    )

    return doc
  }
}

/**
 * Create an afterChange hook that records value changes to the hypertable.
 */
export function createAfterChangeHook(
  fields: DiscoveredField[],
  config: HypervaluePluginConfig,
): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, operation, req }) => {
    const adapter = req.payload.db
    const schema = adapter.schemaName ?? 'public'
    const drizzle = getDrizzle(adapter, req)

    for (const hvField of fields) {
      const fieldValue = doc[hvField.fieldName]
      const prevValue = previousDoc?.[hvField.fieldName]

      // Skip if value didn't change (updates only)
      if (operation !== 'create' && fieldValue === prevValue) continue

      // Skip if null/undefined
      if (fieldValue == null) continue

      // Skip drafts unless configured to track them
      if (doc._status && doc._status !== 'published' && !config.trackDrafts) continue

      const recordedAt = new Date().toISOString()
      const serializedValue = hvField.sqlValueType === 'jsonb' ? JSON.stringify(fieldValue) : fieldValue

      const qualifiedTable = sql.raw(`"${schema}"."${hvField.tableName}"`)
      await drizzle.execute(
        sql`INSERT INTO ${qualifiedTable} (recorded_at, document_id, value)
            VALUES (${recordedAt}, ${doc.id}, ${serializedValue})`
      )
    }

    return doc
  }
}
