/**
 * Shared helpers for inserting trail_revisions rows inside a transaction.
 */
import type { TxClient } from '@/lib/db'
import type { TrailRevisionAction, TrailRevisionPayload } from '@/lib/types'
import type { TrailRow } from './mappers'

/** Build a revision payload from a trail DB row. */
export function trailRowToPayload(row: TrailRow): TrailRevisionPayload {
  return {
    name: row.name,
    difficulty: row.difficulty,
    direction: row.direction,
    polyline: row.polyline,
    distanceKm: Number(row.distance_km),
    elevationGainFt: Number(row.elevation_gain_ft),
    notes: row.notes ?? undefined,
    source: row.source,
    sourceRideId: row.source_ride_id ?? undefined,
    osmWayId: row.osm_way_id ?? undefined,
  }
}

interface InsertRevisionOpts {
  tx: TxClient
  trailId: string
  userId: string | null
  action: TrailRevisionAction
  payload: TrailRevisionPayload
  summary?: string | null
  changeSetId?: string | null
  parentRevisionId?: string | null
}

/** Insert a single trail_revisions row and return its id. */
export async function insertRevision(opts: InsertRevisionOpts): Promise<string> {
  const { tx, trailId, userId, action, payload, summary, changeSetId, parentRevisionId } = opts
  const row = await tx.queryOne<{ id: string }>(
    `INSERT INTO trail_revisions
       (trail_id, created_by_user_id, change_set_id, parent_revision_id, action, summary, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id`,
    [
      trailId,
      userId ?? null,
      changeSetId ?? null,
      parentRevisionId ?? null,
      action,
      summary ?? null,
      JSON.stringify(payload),
    ]
  )
  if (!row) throw new Error('Failed to insert trail revision')
  return row.id
}
