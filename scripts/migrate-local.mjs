import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createScriptPool } from './db-script-pool.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

let pool
try {
  pool = createScriptPool()
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

console.log(
  process.env.DATABASE_URL_MIGRATE
    ? 'Using DATABASE_URL_MIGRATE (direct connection) for migrations.\n'
    : 'Using DATABASE_URL / TRAIL_DB_* password auth for migrations.\n'
)

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
