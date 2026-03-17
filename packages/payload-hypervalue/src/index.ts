import type { PostgresAdapter } from '@payloadcms/db-postgres'
import type { Config, DatabaseAdapterObj, Plugin } from 'payload'

import './augment.js'
import { createAfterChangeHook, createCollectionAfterChangeHook } from './hooks.js'
import { queryHypervalue } from './query.js'
import { setupHypertables, setupWideHypertables, verifyTimescaleVersion } from './timescale.js'
import type { HypervaluePluginConfig } from './types.js'
import { discoverHypervalueFields } from './types.js'
import { createHypervalueEndpoint } from './endpoints/hypervalueEndpoint.js'

export type { HypervaluePluginConfig, HypervalueQueryArgs, HypervalueResult } from './types.js'

export const payloadHypervalue =
  (pluginConfig: HypervaluePluginConfig = {}): Plugin =>
  (config: Config): Config => {
    if (!config.collections) {
      config.collections = []
    }

    // Discover all hypervalue fields and collections
    const { collections: discoveredCollections, fields: discoveredFields } = discoverHypervalueFields(config.collections)

    if (discoveredCollections.length === 0 && discoveredFields.length === 0) {
      console.warn('[hypervalue] No fields or collections with custom.hypervalue found. Plugin has nothing to do.')
      return config
    }

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

    const endpointHandler = createHypervalueEndpoint(discoveredCollections, discoveredFields)
    config.endpoints.push(
      { handler: endpointHandler, method: 'get', path: '/hypervalue/:collection/:id/:field' },
      { handler: endpointHandler, method: 'get', path: '/hypervalue/:collection/:id' },
    )

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

      // Attach payload.hypervalue() method
      payload.hypervalue = (args) =>
        queryHypervalue(payload, discoveredCollections, discoveredFields, args)
    }

    return config
  }
