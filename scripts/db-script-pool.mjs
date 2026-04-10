/**
 * Shared Postgres pool for CLI scripts (migrate + seed).
 * Password auth: `DATABASE_URL` and/or `TRAIL_DB_*` with non-empty `TRAIL_DB_PGPASSWORD`.
 * Optional `DATABASE_URL_MIGRATE` overwrites `TRAIL_DB_*` for direct (non-pooler) connections.
 */
import { Pool } from 'pg'
import {
  poolSsl,
  applyDatabaseUrlMigrateOverride,
} from '../lib/pg-connection-env.mjs'
import {
  loadEnvLocal,
  applyDatabaseUrlFallback,
} from './load-env-local.mjs'

export { poolSsl }

/** Load env files then DATABASE_URL → TRAIL_DB_* mapping, then optional migrate URL override. */
export function loadScriptEnv() {
  loadEnvLocal()
  applyDatabaseUrlFallback()
  applyDatabaseUrlMigrateOverride()
}

/**
 * @param {{ skipEnv?: boolean }} [options]
 * @returns {import('pg').Pool}
 */
export function createScriptPool(options = {}) {
  const { skipEnv = false } = options
  if (!skipEnv) loadScriptEnv()

  const host = process.env.TRAIL_DB_PGHOST
  const user = process.env.TRAIL_DB_PGUSER
  const password = process.env.TRAIL_DB_PGPASSWORD

  if (!host || !user || !password?.length) {
    throw new Error(
      'Database not configured. Set DATABASE_URL, or TRAIL_DB_* with a non-empty TRAIL_DB_PGPASSWORD. ' +
        'For production migrations from CI, set DATABASE_URL or discrete secrets (see README). ' +
        'Optional DATABASE_URL_MIGRATE uses a direct connection string (e.g. Neon non-pooler).'
    )
  }

  return new Pool({
    host,
    user,
    database: process.env.TRAIL_DB_PGDATABASE || 'trail_overlay',
    password,
    port: Number(process.env.TRAIL_DB_PGPORT) || 5432,
    ssl: poolSsl(),
  })
}
