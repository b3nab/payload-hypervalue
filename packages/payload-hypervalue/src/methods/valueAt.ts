import { sql } from '@payloadcms/db-postgres/drizzle'
import type { PayloadRequest } from 'payload'

import { defineMethod } from '../registry/define.js'
import type { HypervalueDescriptor } from '../registry/types.js'
import type { HypervalueRecord, HypervalueSnapshotRecord } from '../types.js'

export type ValueAtArgs = {
  collection: string
  field?: string
  id: string | number
  /** The point in time to query */
  at: Date
  /** Request object for access control */
  req?: PayloadRequest
  /** Bypass access control. Default: false */
  overrideAccess?: boolean
}

type ValueAtResult = { doc: HypervalueRecord | HypervalueSnapshotRecord | null }

export const valueAtMethod = defineMethod<ValueAtArgs, ValueAtResult>({
  build: (discovery, args) => {
    const schema = discovery._schemaName ?? 'public'

    // Route 1: field provided — narrow table first, wide table fallback
    if (args.field) {
      const narrowField = discovery.fields.find(
        (f) => f.collectionSlug === args.collection && f.fieldName === args.field,
      )

      if (narrowField) {
        return buildNarrowValueAt(schema, narrowField.tableName, args)
      }

      // Fallback: single field from wide table
      const wideCollection = discovery.collections.find(
        (c) => c.collectionSlug === args.collection,
      )
      const wideField = wideCollection?.fields.find((f) => f.fieldName === args.field)

      if (wideCollection && wideField) {
        return buildWideFieldValueAt(schema, wideCollection.tableName, wideField.columnName, args)
      }

      throw new Error(
        `[hypervalue] Field "${args.field}" on collection "${args.collection}" is not a hypervalue field.`,
      )
    }

    // Route 2: no field — wide table full snapshot
    const wideCollection = discovery.collections.find(
      (c) => c.collectionSlug === args.collection,
    )

    if (!wideCollection) {
      throw new Error(
        `[hypervalue] Collection "${args.collection}" is not a collection-level hypervalue collection.`,
      )
    }

    return buildWideSnapshotValueAt(schema, wideCollection.tableName, args)
  },

  endpoint: {
    path: '/hypervalue/:collection/:field/valueAt',
    method: 'get',
    parseRequest: (params, query) => {
      const args: ValueAtArgs = {
        collection: params.collection,
        field: params.field || undefined,
        id: params.id || query.get('id') || '',
        at: new Date(query.get('at') || ''),
      }
      return args
    },
  },
})

function buildNarrowValueAt(
  schema: string,
  tableName: string,
  args: ValueAtArgs,
): HypervalueDescriptor<ValueAtResult> {
  const qualifiedTable = sql.raw(`"${schema}"."${tableName}"`)

  const sqlFragment = sql`SELECT value, recorded_at
    FROM ${qualifiedTable}
    WHERE document_id = ${args.id}
      AND recorded_at <= ${args.at.toISOString()}
    ORDER BY recorded_at DESC
    LIMIT 1`

  return {
    sqlFragment,
    parse: (rows) => ({ doc: rows.length > 0 ? (rows[0] as HypervalueRecord) : null }),
    validate: () => {},
    accessCheck: { collection: args.collection, id: args.id },
  }
}

function buildWideFieldValueAt(
  schema: string,
  tableName: string,
  columnName: string,
  args: ValueAtArgs,
): HypervalueDescriptor<ValueAtResult> {
  const qualifiedTable = sql.raw(`"${schema}"."${tableName}"`)
  const columnRef = sql.raw(`"${columnName}"`)

  const sqlFragment = sql`SELECT ${columnRef} AS value, recorded_at
    FROM ${qualifiedTable}
    WHERE document_id = ${args.id}
      AND recorded_at <= ${args.at.toISOString()}
    ORDER BY recorded_at DESC
    LIMIT 1`

  return {
    sqlFragment,
    parse: (rows) => ({ doc: rows.length > 0 ? (rows[0] as HypervalueRecord) : null }),
    validate: () => {},
    accessCheck: { collection: args.collection, id: args.id },
  }
}

function buildWideSnapshotValueAt(
  schema: string,
  tableName: string,
  args: ValueAtArgs,
): HypervalueDescriptor<ValueAtResult> {
  const qualifiedTable = sql.raw(`"${schema}"."${tableName}"`)

  const sqlFragment = sql`SELECT *
    FROM ${qualifiedTable}
    WHERE document_id = ${args.id}
      AND recorded_at <= ${args.at.toISOString()}
    ORDER BY recorded_at DESC
    LIMIT 1`

  return {
    sqlFragment,
    parse: (rows) => ({ doc: rows.length > 0 ? (rows[0] as HypervalueSnapshotRecord) : null }),
    validate: () => {},
    accessCheck: { collection: args.collection, id: args.id },
  }
}
