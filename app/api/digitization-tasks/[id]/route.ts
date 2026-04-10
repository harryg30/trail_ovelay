import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import type { DigitizationTaskKind, NetworkDigitizationTask } from '@/lib/types'

type TaskRow = {
  id: string
  network_id: string
  map_overlay_id: string | null
  kind: string
  label: string
  description: string | null
  sort_order: number
  completed_trail_id: string | null
  completed_at: string | null
  completed_by_user_id: string | null
  created_at: string
}

function rowToTask(row: TaskRow): NetworkDigitizationTask {
  return {
    id: row.id,
    networkId: row.network_id,
    mapOverlayId: row.map_overlay_id ?? undefined,
    kind: row.kind as DigitizationTaskKind,
    label: row.label,
    description: row.description ?? undefined,
    sortOrder: row.sort_order,
    completedTrailId: row.completed_trail_id ?? undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    completedByUserId: row.completed_by_user_id ?? undefined,
    createdAt: new Date(row.created_at),
  }
}

const KINDS: DigitizationTaskKind[] = ['named_route', 'intersection_route', 'loop', 'other']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: taskId } = await params
    const body = (await request.json()) as {
      label?: string
      description?: string | null
      sortOrder?: number
      kind?: string
      completedTrailId?: string | null
      clearCompletion?: boolean
    }

    const existing = await queryOne<TaskRow>(
      `SELECT * FROM network_digitization_tasks WHERE id = $1`,
      [taskId]
    )
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let label = existing.label
    let description = existing.description
    let sortOrder = existing.sort_order
    let kind = existing.kind
    let completedTrailId = existing.completed_trail_id
    let completedAt: string | null = existing.completed_at
    let completedByUserId: string | null = existing.completed_by_user_id

    if (body.label !== undefined) {
      if (!body.label.trim()) {
        return NextResponse.json({ error: 'label empty' }, { status: 400 })
      }
      label = body.label.trim()
    }
    if (body.description !== undefined) {
      description = body.description === null || body.description === '' ? null : body.description.trim()
    }
    if (body.sortOrder !== undefined && Number.isFinite(body.sortOrder)) {
      sortOrder = Math.floor(body.sortOrder)
    }
    if (body.kind !== undefined) {
      if (!KINDS.includes(body.kind as DigitizationTaskKind)) {
        return NextResponse.json({ error: 'invalid kind' }, { status: 400 })
      }
      kind = body.kind
    }

    if (body.clearCompletion) {
      completedTrailId = null
      completedAt = null
      completedByUserId = null
    } else if (body.completedTrailId !== undefined) {
      if (body.completedTrailId === null) {
        completedTrailId = null
        completedAt = null
        completedByUserId = null
      } else {
        const trail = await queryOne<{ id: string }>(
          `SELECT id FROM trails WHERE id = $1`,
          [body.completedTrailId]
        )
        if (!trail) {
          return NextResponse.json({ error: 'Trail not found' }, { status: 400 })
        }
        completedTrailId = body.completedTrailId
        completedAt = new Date().toISOString()
        completedByUserId = userId
      }
    }

    const row = await queryOne<TaskRow>(
      `UPDATE network_digitization_tasks SET
         label = $2,
         description = $3,
         sort_order = $4,
         kind = $5,
         completed_trail_id = $6,
         completed_at = $7,
         completed_by_user_id = $8
       WHERE id = $1
       RETURNING id, network_id, map_overlay_id, kind, label, description, sort_order,
                 completed_trail_id, completed_at, completed_by_user_id, created_at`,
      [
        taskId,
        label,
        description,
        sortOrder,
        kind,
        completedTrailId,
        completedAt,
        completedByUserId,
      ]
    )

    if (!row) {
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    if (completedTrailId) {
      await query(
        `INSERT INTO network_trails (network_id, trail_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [row.network_id, completedTrailId]
      )
    }

    return NextResponse.json({ task: rowToTask(row) })
  } catch (e) {
    console.error('PATCH digitization-task error:', e)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: taskId } = await params
    const deleted = await queryOne<{ id: string }>(
      `DELETE FROM network_digitization_tasks WHERE id = $1 RETURNING id`,
      [taskId]
    )
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE digitization-task error:', e)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
