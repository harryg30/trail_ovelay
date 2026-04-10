import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createScriptPool } from './db-script-pool.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const seedFile = process.argv[2]
if (!seedFile) {
  console.error('Usage: node scripts/seed-local.mjs path/to/seed-data.json')
  process.exit(1)
}

const payload = JSON.parse(readFileSync(seedFile, 'utf8'))
const {
  trails,
  networks,
  networkTrails,
  mapOverlays,
  mapOverlayAlignmentPoints,
  networkDigitizationTasks,
} = payload
const syncMapOverlayTables = Object.prototype.hasOwnProperty.call(
  payload,
  'mapOverlays'
)

let pool
try {
  pool = createScriptPool()
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

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

  if (syncMapOverlayTables) {
    await client.query('DELETE FROM network_digitization_tasks')
    await client.query('DELETE FROM map_overlays')

    for (const o of mapOverlays ?? []) {
      await client.query(
        `INSERT INTO map_overlays (
          id, network_id, blob_url, source_url, title, printed_date,
          image_width, image_height, transform, opacity, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,
        [
          o.id,
          o.network_id,
          o.blob_url,
          o.source_url ?? null,
          o.title ?? null,
          o.printed_date ?? null,
          o.image_width,
          o.image_height,
          o.transform != null ? JSON.stringify(o.transform) : null,
          o.opacity ?? 0.55,
          o.created_at,
        ]
      )
    }

    for (const p of mapOverlayAlignmentPoints ?? []) {
      await client.query(
        `INSERT INTO map_overlay_alignment_points (id, map_overlay_id, seq, img_x, img_y, lat, lon)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [p.id, p.map_overlay_id, p.seq, p.img_x, p.img_y, p.lat, p.lon]
      )
    }

    for (const t of networkDigitizationTasks ?? []) {
      await client.query(
        `INSERT INTO network_digitization_tasks (
          id, network_id, map_overlay_id, kind, label, description, sort_order,
          completed_trail_id, completed_at, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          t.id,
          t.network_id,
          t.map_overlay_id ?? null,
          t.kind,
          t.label,
          t.description ?? null,
          t.sort_order ?? 0,
          t.completed_trail_id ?? null,
          t.completed_at ?? null,
          t.created_at,
        ]
      )
    }
  }

  await client.query('COMMIT')
  const mo = syncMapOverlayTables ? mapOverlays?.length ?? 0 : '—'
  const dt = syncMapOverlayTables ? networkDigitizationTasks?.length ?? 0 : '—'
  console.log(
    `Seeded: ${trails?.length ?? 0} trails, ${networks?.length ?? 0} networks` +
      (syncMapOverlayTables
        ? `, ${mo} map overlays, ${dt} digitization tasks`
        : '')
  )
} catch (err) {
  await client.query('ROLLBACK')
  console.error('Seed failed:', err.message)
  process.exit(1)
} finally {
  client.release()
  await pool.end()
}
