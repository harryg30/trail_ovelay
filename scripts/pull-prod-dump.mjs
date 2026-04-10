/**
 * Fetches GET /api/dev/dump from production and runs scripts/seed-local.mjs.
 * Requires in .env.local (or environment): PROD_APP_URL, DEV_DUMP_SECRET, TRAIL_DB_*.
 */
import { writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'
import { loadEnvLocal, applyDatabaseUrlFallback } from './load-env-local.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

loadEnvLocal()
applyDatabaseUrlFallback()

const base = (
  process.env.PROD_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  ''
).replace(/\/$/, '')
const secret = process.env.DEV_DUMP_SECRET
if (!base || !secret) {
  console.error(
    'Set DEV_DUMP_SECRET and PROD_APP_URL (or NEXT_PUBLIC_APP_URL) in .env.local.'
  )
  process.exit(1)
}

const url = `${base}/api/dev/dump`
const res = await fetch(url, { headers: { 'x-dev-dump-secret': secret } })
if (!res.ok) {
  const text = await res.text()
  console.error(`Dump failed (${res.status}):`, text)
  process.exit(1)
}

const data = await res.json()
const out = join(tmpdir(), `trail-overlay-seed-${Date.now()}.json`)
writeFileSync(out, JSON.stringify(data, null, 0), 'utf8')
console.log('Saved dump to', out)

const r = spawnSync(process.execPath, ['scripts/seed-local.mjs', out], {
  cwd: root,
  stdio: 'inherit',
})
process.exit(r.status ?? 1)
