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
  return async ({ doc, previousDoc, operation, req }) => {
    // Skip drafts unless configured to track them
    if (doc._status && doc._status !== 'published' && !config.trackDrafts) return doc

    // Determine which tracked fields actually changed.
    // On create: all fields are new.
    // On update: compare doc vs previousDoc for each tracked field.
    const changedFields = operation === 'create'
      ? collection.fields
      : collection.fields.filter((field) => {
          const current = getNestedValue(doc, field.fieldPath)
          const previous = getNestedValue(previousDoc, field.fieldPath)

          if (field.sqlValueType === 'geometry(POINT, 4326)') {
            if (Array.isArray(current) && Array.isArray(previous)) {
              return current[0] !== previous[0] || current[1] !== previous[1]
            }
            return current !== previous
          }
          if (field.sqlValueType === 'jsonb' || (typeof current === 'object' && current !== null)) {
            return JSON.stringify(current) !== JSON.stringify(previous)
          }
          return current !== previous
        })

    // Nothing tracked changed
    if (changedFields.length === 0) return doc

    const adapter = req.payload.db
    const schema = adapter.schemaName ?? 'public'
    const drizzle = getDrizzle(adapter, req)
    const qualifiedTable = sql.raw(`"${schema}"."${collection.tableName}"`)
    const recordedAt = new Date().toISOString()

    // Only write columns that actually changed — not a full snapshot
    const columnNames = changedFields.map((f) => sql.raw(`"${f.columnName}"`))
    const fieldValues = changedFields.map((field) => {
      const raw = getNestedValue(doc, field.fieldPath)
      if (raw == null) return sql`${null}`
      if (field.sqlValueType === 'jsonb') return sql`${JSON.stringify(raw)}`
      if (field.sqlValueType === 'geometry(POINT, 4326)' && Array.isArray(raw)) {
        return sql`ST_SetSRID(ST_MakePoint(${raw[0]}, ${raw[1]}), 4326)`
      }
      return sql`${raw}`
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
      let fieldValue = doc[hvField.fieldName]
      const prevValue = previousDoc?.[hvField.fieldName]

      // Payload omits point fields from the doc returned by afterChange on update — re-fetch
      if (hvField.sqlValueType === 'geometry(POINT, 4326)' && fieldValue == null && operation === 'update') {
        const fresh = await req.payload.findByID({
          collection: hvField.collectionSlug as any,
          id: doc.id,
          overrideAccess: true,
          req,
        })
        fieldValue = fresh?.[hvField.fieldName]
      }

      // Skip if value didn't change (updates only)
      if (operation !== 'create') {
        if (hvField.sqlValueType === 'geometry(POINT, 4326)') {
          // Compare point arrays by value
          if (Array.isArray(fieldValue) && Array.isArray(prevValue) &&
              fieldValue[0] === prevValue[0] && fieldValue[1] === prevValue[1]) continue
        } else if (fieldValue === prevValue) continue
      }

      // Skip if null/undefined
      if (fieldValue == null) continue

      // Skip drafts unless configured to track them
      if (doc._status && doc._status !== 'published' && !config.trackDrafts) continue

      const recordedAt = new Date().toISOString()
      const qualifiedTable = sql.raw(`"${schema}"."${hvField.tableName}"`)

      if (hvField.sqlValueType === 'geometry(POINT, 4326)' && Array.isArray(fieldValue)) {
        await drizzle.execute(
          sql`INSERT INTO ${qualifiedTable} (recorded_at, document_id, value)
              VALUES (${recordedAt}, ${doc.id}, ST_SetSRID(ST_MakePoint(${fieldValue[0]}, ${fieldValue[1]}), 4326))`
        )
      } else {
        const serializedValue = hvField.sqlValueType === 'jsonb' ? JSON.stringify(fieldValue) : fieldValue
        await drizzle.execute(
          sql`INSERT INTO ${qualifiedTable} (recorded_at, document_id, value)
              VALUES (${recordedAt}, ${doc.id}, ${serializedValue})`
        )
      }
    }

    return doc
  }
}
