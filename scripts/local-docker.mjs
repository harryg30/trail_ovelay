/**
 * Starts Postgres from docker-compose and prints TRAIL_DB_* for .env.local (matches compose file).
 */
import { spawnSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function runDockerUp() {
  const a = spawnSync('docker', ['compose', 'up', '-d'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  })
  if (a.status === 0) return true
  const b = spawnSync('docker-compose', ['up', '-d'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  })
  return b.status === 0
}

if (!runDockerUp()) {
  process.exit(1)
}

console.log(`
Postgres should be on localhost:5432. Add to .env.local (or merge with existing TRAIL_DB_*):

TRAIL_DB_PGHOST=localhost
TRAIL_DB_PGPORT=5432
TRAIL_DB_PGUSER=trail_user
TRAIL_DB_PGPASSWORD=localdevpassword
TRAIL_DB_PGDATABASE=trail_overlay
TRAIL_DB_PGSSLMODE=disable

Then: npm run db:migrate && npm run dev
`)
