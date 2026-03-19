import type { Payload } from 'payload'

import { sql } from '@payloadcms/db-postgres/drizzle'

import type { DiscoveredCollection, DiscoveredField, HypervaluePluginConfig } from './types.js'

/**
 * Verify TimescaleDB version >= 2.15.0
 */
export async function verifyTimescaleVersion(payload: Payload): Promise<string> {
  const adapter = payload.db
  const drizzle = adapter.drizzle

  // Ensure the extension is created (idempotent)
  await drizzle.execute(sql`CREATE EXTENSION IF NOT EXISTS timescaledb`)

  const result = await drizzle.execute(
    sql`SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'`,
  )

  const rows = result.rows ?? result
  if (!rows || rows.length === 0) {
    throw new Error(
      '[hypervalue] TimescaleDB extension not found. Ensure the extension is created: CREATE EXTENSION IF NOT EXISTS timescaledb',
    )
  }

  const version = rows[0].extversion
  const [major, minor] = version.split('.').map(Number)
  if (major < 2 || (major === 2 && minor < 15)) {
    throw new Error(
      `[hypervalue] TimescaleDB >= 2.15.0 required (found ${version}). FK support on compressed chunks requires 2.15.0+.`,
    )
  }

  return version
}

/**
 * Detect whether the timescaledb_toolkit extension is available.
 */
export async function detectToolkit(payload: Payload): Promise<boolean> {
  try {
    const drizzle = (payload.db as any).drizzle
    const result = await drizzle.execute(
      sql`SELECT extversion FROM pg_extension WHERE extname = 'timescaledb_toolkit'`,
    )
    const rows = result.rows ?? result
    return rows.length > 0
  } catch {
    return false
  }
}

/**
 * Convert tables to hypertables, reconcile chunk intervals and policies.
 */
export async function setupHypertables(
  payload: Payload,
  discoveredFields: DiscoveredField[],
  config: HypervaluePluginConfig,
): Promise<void> {
  const adapter = payload.db
  const drizzle = adapter.drizzle
  const schema = adapter.schemaName ?? 'public'
  const chunkInterval = config.chunkInterval ?? '3 months'

  for (const hvField of discoveredFields) {
    const qualifiedTable = sql.raw(`"${schema}"."${hvField.tableName}"`)
    const parentTableName = adapter.tableNameMap?.get(hvField.collectionSlug) ?? hvField.collectionSlug
    const qualifiedParent = sql.raw(`"${schema}"."${parentTableName}"`)
    const hypertableRef = sql.raw(`'${schema}.${hvField.tableName}'`)
    const indexName = sql.raw(`"${hvField.tableName}_query_idx"`)

    // 0. Detect parent ID column type
    const idTypeResult = await drizzle.execute(
      sql`SELECT data_type FROM information_schema.columns
        WHERE table_schema = ${schema} AND table_name = ${parentTableName} AND column_name = 'id'`,
    )
    const idTypeRows = idTypeResult.rows ?? idTypeResult
    const idType = sql.raw(idTypeRows[0]?.data_type === 'uuid' ? 'UUID' : 'INTEGER')

    // Ensure table exists (in case push/migrate didn't create it)
    await drizzle.execute(
      sql`CREATE TABLE IF NOT EXISTS ${qualifiedTable} (
        recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
        document_id ${idType} NOT NULL REFERENCES ${qualifiedParent} (id) ON DELETE CASCADE,
        value ${sql.raw(hvField.sqlValueType)} NOT NULL
      )`,
    )

    // Create index if not exists
    await drizzle.execute(
      sql`CREATE INDEX IF NOT EXISTS ${indexName} ON ${qualifiedTable} (document_id, recorded_at)`,
    )

    // 1. Convert to hypertable (idempotent)
    await drizzle.execute(
      sql`SELECT create_hypertable(
        ${hypertableRef}, 'recorded_at',
        chunk_time_interval => ${sql.raw(`INTERVAL '${chunkInterval}'`)},
        if_not_exists => TRUE
      )`,
    )

    // 2. Check and fix chunk interval drift
    const intervalResult = await drizzle.execute(
      sql`SELECT d.time_interval
        FROM timescaledb_information.dimensions d
        WHERE d.hypertable_name = ${hvField.tableName} AND d.hypertable_schema = ${schema}`,
    )

    const intervalRows = intervalResult.rows ?? intervalResult
    if (intervalRows.length > 0) {
      const currentInterval = intervalRows[0].time_interval
      const currentIntervalStr = currentInterval?.toString() ?? '3 mons'
      // PostgreSQL interval comparison — convert config to interval and compare
      const driftCheck = await drizzle.execute(
        sql`SELECT ${sql.raw(`'${currentIntervalStr}'::interval`)} <> ${sql.raw(`'${chunkInterval}'::interval`)} AS drifted`,
      )
      const driftRows = driftCheck.rows ?? driftCheck
      if (driftRows[0]?.drifted) {
        await drizzle.execute(
          sql`SELECT set_chunk_time_interval(${hypertableRef}, ${sql.raw(`INTERVAL '${chunkInterval}'`)})`,
        )
        console.log(
          `[hypervalue] Updated chunk interval for ${hvField.tableName} to '${chunkInterval}' (affects future chunks only)`,
        )
      }
    }

    // 3. Reconcile compression policy
    if (config.compressionAfter) {
      // Enable compression on the hypertable
      await drizzle.execute(
        sql`ALTER TABLE ${qualifiedTable} SET (
          timescaledb.compress,
          timescaledb.compress_segmentby = 'document_id',
          timescaledb.compress_orderby = 'recorded_at DESC'
        )`,
      )

      // Check existing compression policy
      const existingCompression = await drizzle.execute(
        sql`SELECT j.config::text
          FROM timescaledb_information.jobs j
          WHERE j.hypertable_name = ${hvField.tableName}
            AND j.hypertable_schema = ${schema}
            AND j.proc_name = 'policy_compression'`,
      )

      const compRows = existingCompression.rows ?? existingCompression
      const needsUpdate = compRows.length === 0 ||
        !compRows[0]?.config?.includes(config.compressionAfter)

      if (needsUpdate) {
        // Remove existing policy if any
        if (compRows.length > 0) {
          await drizzle.execute(
            sql`SELECT remove_compression_policy(${hypertableRef}, if_exists => true)`,
          )
        }
        await drizzle.execute(
          sql`SELECT add_compression_policy(${hypertableRef},
            compress_after => ${sql.raw(`INTERVAL '${config.compressionAfter}'`)})`,
        )
      }
    }

    // 4. Reconcile retention policy
    if (config.retentionAfter) {
      const existingRetention = await drizzle.execute(
        sql`SELECT j.config::text
          FROM timescaledb_information.jobs j
          WHERE j.hypertable_name = ${hvField.tableName}
            AND j.hypertable_schema = ${schema}
            AND j.proc_name = 'policy_retention'`,
      )

      const retRows = existingRetention.rows ?? existingRetention
      const needsRetentionUpdate = retRows.length === 0 ||
        !retRows[0]?.config?.includes(config.retentionAfter)

      if (needsRetentionUpdate) {
        if (retRows.length > 0) {
          await drizzle.execute(
            sql`SELECT remove_retention_policy(${hypertableRef}, if_exists => true)`,
          )
        }
        await drizzle.execute(
          sql`SELECT add_retention_policy(${hypertableRef},
            drop_after => ${sql.raw(`INTERVAL '${config.retentionAfter}'`)})`,
        )
      }
    }
  }
}

/**
 * Create wide hypertables for collection-level tracking, reconcile schema evolution and policies.
 */
export async function setupWideHypertables(
  payload: Payload,
  discoveredCollections: DiscoveredCollection[],
  config: HypervaluePluginConfig,
): Promise<void> {
  const adapter = payload.db
  const drizzle = adapter.drizzle
  const schema = adapter.schemaName ?? 'public'
  const chunkInterval = config.chunkInterval ?? '3 months'

  for (const hvCollection of discoveredCollections) {
    const qualifiedTable = sql.raw(`"${schema}"."${hvCollection.tableName}"`)
    const parentTableName = adapter.tableNameMap?.get(hvCollection.collectionSlug) ?? hvCollection.collectionSlug
    const qualifiedParent = sql.raw(`"${schema}"."${parentTableName}"`)
    const hypertableRef = sql.raw(`'${schema}.${hvCollection.tableName}'`)
    const indexName = sql.raw(`"${hvCollection.tableName}_query_idx"`)

    // 0. Detect parent ID column type
    const idTypeResult = await drizzle.execute(
      sql`SELECT data_type FROM information_schema.columns
        WHERE table_schema = ${schema} AND table_name = ${parentTableName} AND column_name = 'id'`,
    )
    const idTypeRows = idTypeResult.rows ?? idTypeResult
    const idType = sql.raw(idTypeRows[0]?.data_type === 'uuid' ? 'UUID' : 'INTEGER')

    // 1. Build column definitions for all value fields (all nullable)
    const columnDefs = hvCollection.fields
      .map((f) => `"${f.columnName}" ${f.sqlValueType}`)
      .join(',\n        ')

    // 2. CREATE TABLE IF NOT EXISTS with all value columns nullable
    await drizzle.execute(
      sql`CREATE TABLE IF NOT EXISTS ${qualifiedTable} (
        recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
        document_id ${idType} NOT NULL REFERENCES ${qualifiedParent} (id) ON DELETE CASCADE,
        ${sql.raw(columnDefs)}
      )`,
    )

    // 3. Create index if not exists
    await drizzle.execute(
      sql`CREATE INDEX IF NOT EXISTS ${indexName} ON ${qualifiedTable} (document_id, recorded_at)`,
    )

    // 4. Schema evolution: detect missing columns, ALTER TABLE ADD COLUMN
    const existingColsResult = await drizzle.execute(
      sql`SELECT column_name FROM information_schema.columns
        WHERE table_schema = ${schema} AND table_name = ${hvCollection.tableName}`,
    )
    const existingColRows = existingColsResult.rows ?? existingColsResult
    const existingCols = new Set(existingColRows.map((r: any) => r.column_name))

    for (const field of hvCollection.fields) {
      if (!existingCols.has(field.columnName)) {
        await drizzle.execute(
          sql`ALTER TABLE ${qualifiedTable} ADD COLUMN ${sql.raw(`"${field.columnName}" ${field.sqlValueType}`)}`,
        )
      }
    }

    // 5. Convert to hypertable (idempotent)
    await drizzle.execute(
      sql`SELECT create_hypertable(
        ${hypertableRef}, 'recorded_at',
        chunk_time_interval => ${sql.raw(`INTERVAL '${chunkInterval}'`)},
        if_not_exists => TRUE
      )`,
    )

    // 6. Check and fix chunk interval drift
    const intervalResult = await drizzle.execute(
      sql`SELECT d.time_interval
        FROM timescaledb_information.dimensions d
        WHERE d.hypertable_name = ${hvCollection.tableName} AND d.hypertable_schema = ${schema}`,
    )

    const intervalRows = intervalResult.rows ?? intervalResult
    if (intervalRows.length > 0) {
      const currentInterval = intervalRows[0].time_interval
      const currentIntervalStr = currentInterval?.toString() ?? '3 mons'
      const driftCheck = await drizzle.execute(
        sql`SELECT ${sql.raw(`'${currentIntervalStr}'::interval`)} <> ${sql.raw(`'${chunkInterval}'::interval`)} AS drifted`,
      )
      const driftRows = driftCheck.rows ?? driftCheck
      if (driftRows[0]?.drifted) {
        await drizzle.execute(
          sql`SELECT set_chunk_time_interval(${hypertableRef}, ${sql.raw(`INTERVAL '${chunkInterval}'`)})`,
        )
        console.log(
          `[hypervalue] Updated chunk interval for ${hvCollection.tableName} to '${chunkInterval}' (affects future chunks only)`,
        )
      }
    }

    // 7. Reconcile compression policy
    if (config.compressionAfter) {
      await drizzle.execute(
        sql`ALTER TABLE ${qualifiedTable} SET (
          timescaledb.compress,
          timescaledb.compress_segmentby = 'document_id',
          timescaledb.compress_orderby = 'recorded_at DESC'
        )`,
      )

      const existingCompression = await drizzle.execute(
        sql`SELECT j.config::text
          FROM timescaledb_information.jobs j
          WHERE j.hypertable_name = ${hvCollection.tableName}
            AND j.hypertable_schema = ${schema}
            AND j.proc_name = 'policy_compression'`,
      )

      const compRows = existingCompression.rows ?? existingCompression
      const needsUpdate = compRows.length === 0 ||
        !compRows[0]?.config?.includes(config.compressionAfter)

      if (needsUpdate) {
        if (compRows.length > 0) {
          await drizzle.execute(
            sql`SELECT remove_compression_policy(${hypertableRef}, if_exists => true)`,
          )
        }
        await drizzle.execute(
          sql`SELECT add_compression_policy(${hypertableRef},
            compress_after => ${sql.raw(`INTERVAL '${config.compressionAfter}'`)})`,
        )
      }
    }

    // 8. Reconcile retention policy
    if (config.retentionAfter) {
      const existingRetention = await drizzle.execute(
        sql`SELECT j.config::text
          FROM timescaledb_information.jobs j
          WHERE j.hypertable_name = ${hvCollection.tableName}
            AND j.hypertable_schema = ${schema}
            AND j.proc_name = 'policy_retention'`,
      )

      const retRows = existingRetention.rows ?? existingRetention
      const needsRetentionUpdate = retRows.length === 0 ||
        !retRows[0]?.config?.includes(config.retentionAfter)

      if (needsRetentionUpdate) {
        if (retRows.length > 0) {
          await drizzle.execute(
            sql`SELECT remove_retention_policy(${hypertableRef}, if_exists => true)`,
          )
        }
        await drizzle.execute(
          sql`SELECT add_retention_policy(${hypertableRef},
            drop_after => ${sql.raw(`INTERVAL '${config.retentionAfter}'`)})`,
        )
      }
    }
  }
}
