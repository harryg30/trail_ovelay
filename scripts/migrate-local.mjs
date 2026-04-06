import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local
const envPath = resolve(__dirname, '../.env.local')
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=["']?(.+?)["']?\s*$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
} catch {
  // .env.local is optional when vars are already in the environment
}

if (!process.env.TRAIL_DB_PGPASSWORD) {
  console.error('TRAIL_DB_PGPASSWORD is not set.')
  console.error('This script requires a static password (local Postgres).')
  console.error('For production (IAM auth), use: node scripts/migrate.mjs')
  process.exit(1)
}

const pool = new Pool({
  host: process.env.TRAIL_DB_PGHOST || 'localhost',
  user: process.env.TRAIL_DB_PGUSER || 'trail_user',
  database: process.env.TRAIL_DB_PGDATABASE || 'trail_overlay',
  password: process.env.TRAIL_DB_PGPASSWORD,
  port: Number(process.env.TRAIL_DB_PGPORT) || 5432,
  ssl: false,
})

const migrationsDir = resolve(__dirname, '../migrations')
const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort()

console.log(`Running ${files.length} migration(s) against ${pool.options.host}:${pool.options.port}/${pool.options.database}\n`)

const client = await pool.connect()
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `)

  for (const file of files) {
    const { rows } = await client.query(
      'SELECT 1 FROM _migrations WHERE filename = $1',
      [file]
    )
    if (rows.length > 0) {
      console.log(`  skip  ${file}`)
      continue
    }

    const sql = readFileSync(resolve(migrationsDir, file), 'utf8')
    process.stdout.write(`  apply ${file} ... `)
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log('OK')
    } catch (err) {
      await client.query('ROLLBACK')
      console.log('FAILED')
      console.error(`  Error: ${err.message}`)
      process.exit(1)
    }
  }
} finally {
  client.release()
  await pool.end()
}

console.log('\nAll migrations complete.')
