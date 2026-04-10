/**
 * Fetches GET /api/dev/dump from production and runs scripts/seed-local.mjs.
 * Requires in .env.local (or environment): PROD_APP_URL, DEV_DUMP_SECRET, TRAIL_DB_*.
 */
import { readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const envPath = join(root, '.env.local')

try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=["']?(.+?)["']?\s*$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
} catch {
  console.error('Could not read .env.local — copy env vars or create the file.')
  process.exit(1)
}

const base = process.env.PROD_APP_URL?.replace(/\/$/, '')
const secret = process.env.DEV_DUMP_SECRET
if (!base || !secret) {
  console.error('Set PROD_APP_URL and DEV_DUMP_SECRET (e.g. in .env.local).')
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
