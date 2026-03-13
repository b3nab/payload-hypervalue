import type { PostgresAdapter } from '@payloadcms/db-postgres'
import type { Config, DatabaseAdapterObj, Plugin } from 'payload'

import './augment.js'
import { createAfterChangeHook } from './hooks.js'
import { queryHypervalue } from './query.js'
import { setupHypertables, verifyTimescaleVersion } from './timescale.js'
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

    // Discover all hypervalue fields across collections
    const discoveredFields = discoverHypervalueFields(config.collections)

    if (discoveredFields.length === 0) {
      console.warn('[hypervalue] No fields with custom.hypervalue found. Plugin has nothing to do.')
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

    // Register REST endpoint
    if (!config.endpoints) {
      config.endpoints = []
    }

    config.endpoints.push({
      handler: createHypervalueEndpoint(discoveredFields),
      method: 'get',
      path: '/hypervalue/:collection/:id/:field',
    })

    // Register afterChange hooks per collection
    const fieldsByCollection = new Map<string, typeof discoveredFields>()
    for (const field of discoveredFields) {
      const existing = fieldsByCollection.get(field.collectionSlug) || []
      existing.push(field)
      fieldsByCollection.set(field.collectionSlug, existing)
    }

    for (const collection of config.collections) {
      const collectionFields = fieldsByCollection.get(collection.slug)
      if (!collectionFields) continue

      if (!collection.hooks) {
        collection.hooks = {}
      }
      if (!collection.hooks.afterChange) {
        collection.hooks.afterChange = []
      }

      collection.hooks.afterChange.push(createAfterChangeHook(collectionFields, pluginConfig))
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
      await setupHypertables(payload, discoveredFields, pluginConfig)
      console.log(`[hypervalue] ${discoveredFields.length} hypertable(s) configured.`)

      // Attach payload.hypervalue() method
      payload.hypervalue = (args) =>
        queryHypervalue(payload, discoveredFields, args)
    }

    return config
  }
