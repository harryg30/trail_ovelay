import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseAndApplyEnv(text) {
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!key) continue
    // Shell / CI / `vercel env run` wins over file (same as prior migrate.mjs behavior).
    if (process.env[key] !== undefined) continue
    process.env[key] = val
  }
}

/**
 * Loads repo-root `.env.local` (then `.env` if present) into `process.env`.
 * Does not override variables already set in the environment.
 */
export function loadEnvLocal() {
  const root = resolve(__dirname, '..')
  for (const name of ['.env.local', '.env']) {
    const envPath = resolve(root, name)
    if (!existsSync(envPath)) continue
    try {
      let text = readFileSync(envPath, 'utf8')
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
      parseAndApplyEnv(text)
    } catch {
      /* ignore missing or unreadable */
    }
  }
}

/** If `DATABASE_URL` is set but `TRAIL_DB_*` is missing, fill TRAIL_DB_* for local scripts. */
export function applyDatabaseUrlFallback() {
  const urlStr = process.env.DATABASE_URL
  if (!urlStr) return
  try {
    const u = new URL(urlStr)
    if (!process.env.TRAIL_DB_PGHOST) process.env.TRAIL_DB_PGHOST = u.hostname
    if (!process.env.TRAIL_DB_PGPORT && u.port)
      process.env.TRAIL_DB_PGPORT = u.port
    if (!process.env.TRAIL_DB_PGUSER && u.username)
      process.env.TRAIL_DB_PGUSER = decodeURIComponent(u.username)
    if (!process.env.TRAIL_DB_PGPASSWORD)
      process.env.TRAIL_DB_PGPASSWORD = decodeURIComponent(u.password || '')
    const db = u.pathname.replace(/^\//, '')
    if (!process.env.TRAIL_DB_PGDATABASE && db)
      process.env.TRAIL_DB_PGDATABASE = db
  } catch {
    // ignore invalid DATABASE_URL
  }
}
