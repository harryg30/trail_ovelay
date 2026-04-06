import { readFileSync } from 'fs'
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

const seedFile = process.argv[2]
if (!seedFile) {
  console.error('Usage: node scripts/seed-local.mjs path/to/seed-data.json')
  process.exit(1)
}

const { trails, networks, networkTrails } = JSON.parse(readFileSync(seedFile, 'utf8'))

const pool = new Pool({
  host: process.env.TRAIL_DB_PGHOST || 'localhost',
  user: process.env.TRAIL_DB_PGUSER || 'trail_user',
  database: process.env.TRAIL_DB_PGDATABASE || 'trail_overlay',
  password: process.env.TRAIL_DB_PGPASSWORD,
  port: Number(process.env.TRAIL_DB_PGPORT) || 5432,
  ssl: false,
})

const client = await pool.connect()
try {
  await client.query('BEGIN')

  for (const t of trails ?? []) {
    await client.query(
      `INSERT INTO trails
        (id, name, difficulty, direction, polyline, distance_km, elevation_gain_ft, notes, source, source_ride_id, uploaded_by_email, created_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [t.id, t.name, t.difficulty, t.direction, JSON.stringify(t.polyline),
       t.distance_km, t.elevation_gain_ft, t.notes, t.source, t.source_ride_id,
       t.uploaded_by_email, t.created_at]
    )
  }

  for (const n of networks ?? []) {
    await client.query(
      `INSERT INTO networks (id, name, polygon, created_at)
       VALUES ($1,$2,$3::jsonb,$4)
       ON CONFLICT (id) DO NOTHING`,
      [n.id, n.name, JSON.stringify(n.polygon), n.created_at]
    )
  }

  for (const nt of networkTrails ?? []) {
    await client.query(
      `INSERT INTO network_trails (network_id, trail_id)
       VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [nt.network_id, nt.trail_id]
    )
  }

  await client.query('COMMIT')
  console.log(`Seeded: ${trails?.length ?? 0} trails, ${networks?.length ?? 0} networks`)
} catch (err) {
  await client.query('ROLLBACK')
  console.error('Seed failed:', err.message)
  process.exit(1)
} finally {
  client.release()
  await pool.end()
}
