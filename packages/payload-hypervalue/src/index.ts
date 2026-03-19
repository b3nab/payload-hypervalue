import type { PostgresAdapter } from '@payloadcms/db-postgres'
import type { Config, DatabaseAdapterObj, Plugin } from 'payload'

import './augment.js'
import { createAfterChangeHook, createCollectionAfterChangeHook } from './hooks.js'
import { builtinMethods } from './registry/index.js'
import { executeDescriptor } from './registry/execute.js'
import { createEndpointsFromRegistry } from './registry/endpoint.js'
import { createBatchFunction } from './batch/index.js'
import { detectToolkit, setupHypertables, setupWideHypertables, verifyTimescaleVersion } from './timescale.js'
import type { HypervaluePluginConfig } from './types.js'
import { discoverHypervalueFields } from './types.js'

export type { HypervaluePluginConfig, HypervalueQueryArgs, HypervalueResult } from './types.js'
export type {
  HypervalueFieldMap,
  HypervalueCollectionSlug,
  HypervalueFieldOf,
  BaseArgs,
  WithField,
  WithOptionalField,
  WithId,
  WithOptionalId,
  WithTimeRange,
  WithRequiredTimeRange,
  WithAt,
  WithPagination,
  WithInterval,
  WithOptionalInterval,
} from './registry/args.js'

export const payloadHypervalue =
  (pluginConfig: HypervaluePluginConfig = {}): Plugin =>
  (config: Config): Config => {
    if (!config.collections) {
      config.collections = []
    }

    // Discover all hypervalue fields and collections
    const discoveryResult = discoverHypervalueFields(config.collections)
    const { collections: discoveredCollections, fields: discoveredFields } = discoveryResult

    if (discoveredCollections.length === 0 && discoveredFields.length === 0) {
      console.warn('[hypervalue] No fields or collections with custom.hypervalue found. Plugin has nothing to do.')
      return config
    }

    // Inject HypervalueFieldMap into generated types via typescript.schema
    config.typescript = config.typescript || {}
    config.typescript.schema = config.typescript.schema || []

    config.typescript.schema.push(({ jsonSchema }) => {
      // Build field map: { books: ['price', 'status'], products: ['name', 'price', ...] }
      const fieldsByCollection: Record<string, string[]> = {}

      for (const col of discoveredCollections) {
        if (!fieldsByCollection[col.collectionSlug]) {
          fieldsByCollection[col.collectionSlug] = []
        }
        for (const f of col.fields) {
          if (!fieldsByCollection[col.collectionSlug].includes(f.fieldName)) {
            fieldsByCollection[col.collectionSlug].push(f.fieldName)
          }
        }
      }
      for (const field of discoveredFields) {
        if (!fieldsByCollection[field.collectionSlug]) {
          fieldsByCollection[field.collectionSlug] = []
        }
        if (!fieldsByCollection[field.collectionSlug].includes(field.fieldName)) {
          fieldsByCollection[field.collectionSlug].push(field.fieldName)
        }
      }

      // Inject hypervalueFields into the Config definition
      const configDef = jsonSchema.definitions?.Config as Record<string, unknown> | undefined
      if (configDef && typeof configDef === 'object') {
        const props = configDef.properties as Record<string, unknown> | undefined
        if (props) {
          const properties: Record<string, { type: string; enum: string[] }> = {}
          for (const [slug, fields] of Object.entries(fieldsByCollection)) {
            properties[slug] = { type: 'string', enum: fields }
          }
          props.hypervalueFields = {
            type: 'object',
            properties,
            required: Object.keys(properties),
            additionalProperties: false,
          }
        }
      }

      return jsonSchema
    })

    if (!config.db) {
      throw new Error('[hypervalue] No database adapter configured. The hypervalue plugin requires @payloadcms/db-postgres.')
    }

    const db = config.db as DatabaseAdapterObj<PostgresAdapter>
    const originalInit = db.init
    db.init = (initArgs) => {
      const adapter = originalInit(initArgs)
      adapter.extensions.timescaledb = true
      adapter.tablesFilter = [...(adapter.tablesFilter || []), '!hv_*']
      console.log('[hypervalue] tablesFilter:', adapter.tablesFilter)
      return adapter
    }

    // If disabled, keep schema but skip runtime behavior
    if (pluginConfig.disabled) {
      return config
    }

    // Register REST endpoints
    if (!config.endpoints) {
      config.endpoints = []
    }

    const registryEndpoints = createEndpointsFromRegistry(builtinMethods, discoveryResult)
    for (const ep of registryEndpoints) {
      config.endpoints.push(ep)
    }

    // Register afterChange hooks per collection
    const narrowFieldsByCollection = new Map<string, typeof discoveredFields>()
    for (const field of discoveredFields) {
      const existing = narrowFieldsByCollection.get(field.collectionSlug) || []
      existing.push(field)
      narrowFieldsByCollection.set(field.collectionSlug, existing)
    }

    const wideCollectionSlugs = new Set(discoveredCollections.map((c) => c.collectionSlug))

    for (const collection of config.collections) {
      const narrowFields = narrowFieldsByCollection.get(collection.slug)
      const wideCollection = wideCollectionSlugs.has(collection.slug)
        ? discoveredCollections.find((c) => c.collectionSlug === collection.slug)
        : undefined

      if (!narrowFields && !wideCollection) continue

      if (!collection.hooks) {
        collection.hooks = {}
      }
      if (!collection.hooks.afterChange) {
        collection.hooks.afterChange = []
      }

      // Wide table hook (collection-level)
      if (wideCollection) {
        collection.hooks.afterChange.push(createCollectionAfterChangeHook(wideCollection, pluginConfig))
      }

      // Narrow table hooks (field-level)
      if (narrowFields) {
        collection.hooks.afterChange.push(createAfterChangeHook(narrowFields, pluginConfig))
      }
    }

    // Wire up onInit for hypertable conversion + payload.hypervalue()
    const incomingOnInit = config.onInit

    config.onInit = async (payload) => {
      if (incomingOnInit) {
        await incomingOnInit(payload)
      }

      // Verify adapter is Drizzle-based
      const adapter = payload.db
      if (!adapter.drizzle) {
        throw new Error(
          '[hypervalue] The hypervalue plugin requires a Drizzle-based database adapter (db-postgres). MongoDB is not supported.',
        )
      }

      // Verify TimescaleDB version
      const version = await verifyTimescaleVersion(payload)
      console.log(`[hypervalue] TimescaleDB ${version} detected.`)

      // Convert tables to hypertables + reconcile policies
      await setupWideHypertables(payload, discoveredCollections, pluginConfig)
      await setupHypertables(payload, discoveredFields, pluginConfig)
      console.log(`[hypervalue] ${discoveredCollections.length} wide + ${discoveredFields.length} narrow hypertable(s) configured.`)

      // Store schema name on discovery result for use by method builders
      discoveryResult._schemaName = adapter.schemaName ?? 'public'

      // Detect toolkit availability
      discoveryResult._toolkitAvailable = await detectToolkit(payload)

      // Attach payload.hypervalue namespace
      const namespace = {} as Record<string, Function>
      for (const [name, method] of Object.entries(builtinMethods)) {
        namespace[name] = async (args: any) => {
          const descriptor = method.build(discoveryResult, args)
          return executeDescriptor(payload, descriptor, args)
        }
      }
      ;(namespace as any).batch = createBatchFunction(payload, builtinMethods, discoveryResult)
      payload.hypervalue = namespace as any
    }

    return config
  }
