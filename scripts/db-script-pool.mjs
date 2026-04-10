/**
 * Shared Postgres pool for CLI scripts (migrate + seed).
 * Password auth if TRAIL_DB_PGPASSWORD is non-empty; else IAM RDS auth when AWS env is set.
 */
import { Signer } from '@aws-sdk/rds-signer'
import { awsCredentialsProvider } from '@vercel/functions/oidc'
import { Pool } from 'pg'
import {
  loadEnvLocal,
  applyDatabaseUrlFallback,
} from './load-env-local.mjs'

export function poolSsl() {
  if (process.env.TRAIL_DB_SSL === 'false') return false
  const mode = (process.env.TRAIL_DB_PGSSLMODE || '').toLowerCase()
  if (mode === 'disable') return false
  if (mode === 'verify-ca' || mode === 'verify-full') {
    return { rejectUnauthorized: true }
  }
  return { rejectUnauthorized: false }
}

/** Load env files then optional DATABASE_URL → TRAIL_DB_* mapping. */
export function loadScriptEnv() {
  loadEnvLocal()
  applyDatabaseUrlFallback()
}

/**
 * @param {{ skipEnv?: boolean }} [options]
 * @returns {import('pg').Pool}
 */
export function createScriptPool(options = {}) {
  const { skipEnv = false } = options
  if (!skipEnv) loadScriptEnv()

  const hasPassword = Boolean(process.env.TRAIL_DB_PGPASSWORD?.length)

  const signer =
    !hasPassword &&
    process.env.TRAIL_DB_PGHOST &&
    process.env.TRAIL_DB_PGUSER &&
    process.env.TRAIL_DB_AWS_REGION &&
    process.env.TRAIL_DB_AWS_ROLE_ARN
      ? new Signer({
          hostname: process.env.TRAIL_DB_PGHOST,
          port: Number(process.env.TRAIL_DB_PGPORT),
          username: process.env.TRAIL_DB_PGUSER,
          region: process.env.TRAIL_DB_AWS_REGION,
          credentials: awsCredentialsProvider({
            roleArn: process.env.TRAIL_DB_AWS_ROLE_ARN,
            clientConfig: { region: process.env.TRAIL_DB_AWS_REGION },
          }),
        })
      : null

  if (!hasPassword && !signer) {
    throw new Error(
      'Database auth not configured. Set a non-empty TRAIL_DB_PGPASSWORD for local Postgres, ' +
        'or set TRAIL_DB_PGHOST, TRAIL_DB_PGUSER, TRAIL_DB_AWS_REGION, TRAIL_DB_AWS_ROLE_ARN for IAM RDS auth.'
    )
  }

  if (hasPassword) {
    return new Pool({
      host: process.env.TRAIL_DB_PGHOST || 'localhost',
      user: process.env.TRAIL_DB_PGUSER || 'trail_user',
      database: process.env.TRAIL_DB_PGDATABASE || 'trail_overlay',
      password: process.env.TRAIL_DB_PGPASSWORD,
      port: Number(process.env.TRAIL_DB_PGPORT) || 5432,
      ssl: poolSsl(),
    })
  }

  return new Pool({
    host: process.env.TRAIL_DB_PGHOST,
    user: process.env.TRAIL_DB_PGUSER,
    database: process.env.TRAIL_DB_PGDATABASE || 'postgres',
    password: async () => signer.getAuthToken(),
    port: Number(process.env.TRAIL_DB_PGPORT),
    ssl: poolSsl(),
  })
}
