import type { CollectionConfig, Field, PayloadRequest } from 'payload'

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

export type HypervalueQueryArgs = {
  collection: string
  id: string | number
  field: string
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

export type HypervalueResult = {
  docs: HypervalueRecord[]
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

/** Scan collections for fields marked with custom.hypervalue */
export function discoverHypervalueFields(collections: CollectionConfig[]): DiscoveredField[] {
  const discovered: DiscoveredField[] = []

  for (const collection of collections) {
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

      discovered.push({
        collectionSlug: collection.slug,
        fieldName: field.name,
        fieldType: field.type,
        tableName,
        sqlValueType: inferSqlType({ fieldType: field.type, hypervalueConfig }),
        hypervalueConfig,
      })
    }
  }

  return discovered
}
