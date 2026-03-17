import type { CollectionConfig, Field, PayloadRequest } from 'payload'
import { fieldAffectsData, fieldIsPresentationalOnly, tabHasName } from 'payload/shared'

export type HypervaluePluginConfig = {
  /** TimescaleDB chunk interval. Default: '3 months' */
  chunkInterval?: string
  /** Enable compression after this interval. Optional. */
  compressionAfter?: string
  /** Enable retention (auto-drop) after this interval. Optional. */
  retentionAfter?: string
  /** Track draft saves. Default: false */
  trackDrafts?: boolean
  /** Disable the plugin while keeping schema consistent. */
  disabled?: boolean
}

export type HypervalueFieldConfig = true | {
  /** Override SQL type for number fields: 'numeric' (default) | 'float' | 'integer' */
  valueType?: 'numeric' | 'float' | 'integer'
}

export type DiscoveredField = {
  collectionSlug: string
  fieldName: string
  fieldType: string
  tableName: string
  sqlValueType: string
  hypervalueConfig: HypervalueFieldConfig
}

export type DiscoveredCollectionField = {
  fieldName: string
  columnName: string
  fieldType: string
  sqlValueType: string
  fieldPath: string[]
}

export type DiscoveredCollection = {
  collectionSlug: string
  tableName: string
  fields: DiscoveredCollectionField[]
}

export type DiscoveryResult = {
  collections: DiscoveredCollection[]
  fields: DiscoveredField[]
}

export type HypervalueQueryArgs = {
  collection: string
  id: string | number
  field?: string
  /** Point-in-time query */
  at?: Date
  /** Range query start */
  from?: Date
  /** Range query end */
  to?: Date
  /** Pagination limit. Default: 100 */
  limit?: number
  /** Pagination offset. Default: 0 */
  offset?: number
  /** Request object for access control */
  req?: PayloadRequest
  /** Bypass access control. Default: false */
  overrideAccess?: boolean
}

export type HypervalueRecord = {
  value: unknown
  recorded_at: string
}

export type HypervalueSnapshotRecord = {
  recorded_at: string
  [fieldName: string]: unknown
}

export type HypervalueResult = {
  docs: HypervalueRecord[] | HypervalueSnapshotRecord[]
  totalDocs?: number
}

/** Map Payload field type to SQL column type */
export function inferSqlType(field: { fieldType: string; hypervalueConfig: HypervalueFieldConfig }): string {
  if (field.fieldType === 'number') {
    const config = typeof field.hypervalueConfig === 'object' ? field.hypervalueConfig : {}
    switch (config.valueType) {
      case 'float': return 'double precision'
      case 'integer': return 'bigint'
      default: return 'numeric'
    }
  }

  const typeMap: Record<string, string> = {
    text: 'text',
    select: 'text',
    checkbox: 'boolean',
    date: 'timestamp with time zone',
    json: 'jsonb',
    relationship: 'uuid',
  }

  return typeMap[field.fieldType] || 'text'
}

/** Supported scalar field types */
const SUPPORTED_FIELD_TYPES = new Set([
  'number', 'text', 'select', 'checkbox', 'date', 'json', 'relationship',
])

/** Recursively walk fields to discover scalar columns for wide tables */
function walkCollectionFields(
  fields: Field[],
  parentPath: string[] = [],
): DiscoveredCollectionField[] {
  const result: DiscoveredCollectionField[] = []

  for (const field of fields) {
    // Skip presentational-only fields (ui type)
    if (fieldIsPresentationalOnly(field)) continue

    // Skip array and blocks — not scalar, can't be a column in a wide table
    if (field.type === 'array' || field.type === 'blocks') continue

    // Per-field opt-out from wide table
    if ('custom' in field && field.custom?.hypervalue === false) continue

    // Layout fields: recurse without nesting
    if (field.type === 'row' || field.type === 'collapsible') {
      result.push(...walkCollectionFields(field.fields, parentPath))
      continue
    }

    // Tabs: named tabs create nesting, unnamed tabs are flat
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        if (tabHasName(tab)) {
          result.push(...walkCollectionFields(tab.fields as Field[], [...parentPath, tab.name]))
        } else {
          result.push(...walkCollectionFields(tab.fields as Field[], parentPath))
        }
      }
      continue
    }

    // Groups: named groups create nesting, unnamed groups are flat
    if (field.type === 'group') {
      if ('name' in field && field.name) {
        result.push(...walkCollectionFields(field.fields, [...parentPath, field.name]))
      } else {
        result.push(...walkCollectionFields(field.fields, parentPath))
      }
      continue
    }

    // Scalar data field
    if (fieldAffectsData(field) && SUPPORTED_FIELD_TYPES.has(field.type)) {
      const fieldPath = [...parentPath, field.name]
      const columnName = fieldPath.join('_')
      const hypervalueConfig: HypervalueFieldConfig =
        typeof field.custom?.hypervalue === 'object' ? field.custom.hypervalue : true

      result.push({
        fieldName: field.name,
        columnName,
        fieldType: field.type,
        sqlValueType: inferSqlType({ fieldType: field.type, hypervalueConfig }),
        fieldPath,
      })
    }
  }

  return result
}

/** Two-phase discovery: collection-level (wide tables) and field-level (narrow tables) */
export function discoverHypervalueFields(collections: CollectionConfig[]): DiscoveryResult {
  const discoveredCollections: DiscoveredCollection[] = []
  const discoveredFields: DiscoveredField[] = []

  for (const collection of collections) {
    // Phase 1: Collection-level tracking (wide tables)
    if (collection.custom?.hypervalue) {
      const fields = walkCollectionFields(collection.fields as Field[])
      if (fields.length > 0) {
        discoveredCollections.push({
          collectionSlug: collection.slug,
          tableName: `hv_${collection.slug}`,
          fields,
        })
      }
    }

    // Phase 2: Field-level tracking (narrow tables)
    for (const field of collection.fields) {
      if (!('name' in field) || !field.custom?.hypervalue) continue
      if (!SUPPORTED_FIELD_TYPES.has(field.type)) {
        console.warn(
          `[hypervalue] Unsupported field type "${field.type}" on ${collection.slug}.${field.name}. Skipping.`,
        )
        continue
      }

      const hypervalueConfig: HypervalueFieldConfig = field.custom.hypervalue
      const tableName = `hv_${collection.slug}_${field.name}`

      discoveredFields.push({
        collectionSlug: collection.slug,
        fieldName: field.name,
        fieldType: field.type,
        tableName,
        sqlValueType: inferSqlType({ fieldType: field.type, hypervalueConfig }),
        hypervalueConfig,
      })
    }
  }

  return { collections: discoveredCollections, fields: discoveredFields }
}
