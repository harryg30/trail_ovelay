import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Signer } from '@aws-sdk/rds-signer'
import { awsCredentialsProvider } from '@vercel/functions/oidc'
import { Pool } from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Optional .env.local — do not override vars already set (e.g. `vercel env run -e production`)
const envPath = resolve(__dirname, '../.env.local')
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=["']?(.+?)["']?\s*$/)
    if (!match) continue
    const key = match[1].trim()
    if (process.env[key] !== undefined) continue
    process.env[key] = match[2].trim()
  }
} catch {
  // no local file
}

function poolSsl() {
  if (process.env.TRAIL_DB_SSL === 'false') return false
  const mode = (process.env.TRAIL_DB_PGSSLMODE || '').toLowerCase()
  if (mode === 'disable') return false
  if (mode === 'verify-ca' || mode === 'verify-full') {
    return { rejectUnauthorized: true }
  }
  return { rejectUnauthorized: false }
}

const hasPassword = Boolean(process.env.TRAIL_DB_PGPASSWORD?.length)

const signer =
  !hasPassword && process.env.TRAIL_DB_PGHOST && process.env.TRAIL_DB_PGUSER
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

const pool = hasPassword
  ? new Pool({
      host: process.env.TRAIL_DB_PGHOST,
      user: process.env.TRAIL_DB_PGUSER,
      database: process.env.TRAIL_DB_PGDATABASE || 'postgres',
      password: process.env.TRAIL_DB_PGPASSWORD,
      port: Number(process.env.TRAIL_DB_PGPORT),
      ssl: poolSsl(),
    })
  : new Pool({
      host: process.env.TRAIL_DB_PGHOST,
      user: process.env.TRAIL_DB_PGUSER,
      database: process.env.TRAIL_DB_PGDATABASE || 'postgres',
      password: async () => {
        if (!signer) {
          throw new Error(
            'Missing IAM signer config. Set TRAIL_DB_PGPASSWORD or provide TRAIL_DB_AWS_REGION and TRAIL_DB_AWS_ROLE_ARN.'
          )
        }
        return signer.getAuthToken()
      },
      port: Number(process.env.TRAIL_DB_PGPORT),
      ssl: poolSsl(),
    })

console.log(
  hasPassword
    ? 'Using TRAIL_DB_PGPASSWORD for migrations.\n'
    : 'Using IAM RDS auth for migrations.\n'
)

const migrationsDir = resolve(__dirname, '../migrations')
const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort()

console.log(`Running ${files.length} migration(s)\n`)

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
