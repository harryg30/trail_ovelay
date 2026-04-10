/**
 * Shared Postgres env helpers for Next.js (lib/db.ts) and Node scripts (migrate/seed).
 * Keep logic in sync — single source for DATABASE_URL bridging and SSL mode.
 */

/**
 * Align `TRAIL_DB_PGSSLMODE` with the URL so leftover `disable` (e.g. from Docker) does not
 * break cloud hosts like Neon (`sslmode=require` or hostname `.neon.tech`).
 */
function applySslFromPostgresUrl(u) {
  const fromQuery = u.searchParams.get('sslmode')
  if (fromQuery) {
    process.env.TRAIL_DB_PGSSLMODE = fromQuery
    return
  }
  if (u.hostname.includes('neon.tech')) {
    process.env.TRAIL_DB_PGSSLMODE = 'require'
  }
}

/**
 * When `DATABASE_URL` is set, always derive `TRAIL_DB_*` from it (overwrite).
 * Stale discrete vars (e.g. left by a removed AWS integration on Vercel) must not win over Neon.
 * Local Docker-only setups typically omit `DATABASE_URL` and use `TRAIL_DB_*` alone.
 */
export function applyDatabaseUrlFallback() {
  const urlStr = process.env.DATABASE_URL
  if (!urlStr) return
  try {
    const u = new URL(urlStr)
    process.env.TRAIL_DB_PGHOST = u.hostname
    process.env.TRAIL_DB_PGPORT = u.port || '5432'
    process.env.TRAIL_DB_PGUSER = decodeURIComponent(u.username)
    process.env.TRAIL_DB_PGPASSWORD = decodeURIComponent(u.password || '')
    const db = u.pathname.replace(/^\//, '')
    if (db) process.env.TRAIL_DB_PGDATABASE = db
    applySslFromPostgresUrl(u)
  } catch {
    // ignore invalid DATABASE_URL
  }
}

/**
 * If `DATABASE_URL_MIGRATE` is set, parse it and overwrite `TRAIL_DB_*`.
 * Use Neon’s direct (non-pooler) URL for migration scripts while the app uses a pooled `DATABASE_URL`.
 */
export function applyDatabaseUrlMigrateOverride() {
  const urlStr = process.env.DATABASE_URL_MIGRATE
  if (!urlStr) return
  try {
    const u = new URL(urlStr)
    process.env.TRAIL_DB_PGHOST = u.hostname
    process.env.TRAIL_DB_PGPORT = u.port || '5432'
    process.env.TRAIL_DB_PGUSER = decodeURIComponent(u.username)
    process.env.TRAIL_DB_PGPASSWORD = decodeURIComponent(u.password || '')
    const db = u.pathname.replace(/^\//, '')
    if (db) process.env.TRAIL_DB_PGDATABASE = db
    applySslFromPostgresUrl(u)
  } catch {
    // ignore invalid DATABASE_URL_MIGRATE
  }
}

/** SSL options for `pg` Pool — password auth and cloud Postgres (e.g. Neon). */
export function poolSsl() {
  if (process.env.TRAIL_DB_SSL === 'false') return false
  const mode = (process.env.TRAIL_DB_PGSSLMODE || '').toLowerCase()
  if (mode === 'disable') return false
  if (mode === 'verify-ca' || mode === 'verify-full') {
    return { rejectUnauthorized: true }
  }
  return { rejectUnauthorized: false }
}
