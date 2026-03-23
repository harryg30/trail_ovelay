import { readFileSync, readdirSync } from 'fs'
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

// Read DATABASE_URL from .env.local
const envPath = resolve(__dirname, '../.env.local')
const envContents = readFileSync(envPath, 'utf8')
const dbUrlMatch = envContents.match(/^DATABASE_URL=(.+)$/m)
if (!dbUrlMatch) {
  console.error('DATABASE_URL not found in .env.local')
  process.exit(1)
}
const DATABASE_URL = dbUrlMatch[1].trim()

const { Pool } = require('pg')
const pool = new Pool({ connectionString: DATABASE_URL })

const migrationsDir = resolve(__dirname, '../migrations')
const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort()

console.log(`Running ${files.length} migration(s) against ${DATABASE_URL}\n`)

for (const file of files) {
  const sql = readFileSync(resolve(migrationsDir, file), 'utf8')
  process.stdout.write(`  ${file} ... `)
  try {
    await pool.query(sql)
    console.log('OK')
  } catch (err) {
    console.log('FAILED')
    console.error(`  Error: ${err.message}`)
    process.exit(1)
  }
}

await pool.end()
console.log('\nAll migrations complete.')
