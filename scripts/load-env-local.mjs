import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { applyDatabaseUrlFallback as applyDatabaseUrlFallbackFromLib } from '../lib/pg-connection-env.mjs'

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

/** Delegates to shared helper in `lib/pg-connection-env.mjs` (also used by Next `lib/db.ts`). */
export function applyDatabaseUrlFallback() {
  applyDatabaseUrlFallbackFromLib()
}
