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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: networkId } = await params
    const rows = await query<TaskRow>(
      `SELECT id, network_id, map_overlay_id, kind, label, description, sort_order,
              completed_trail_id, completed_at, completed_by_user_id, created_at
       FROM network_digitization_tasks
       WHERE network_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [networkId]
    )
    return NextResponse.json({ tasks: rows.map(rowToTask) })
  } catch (e) {
    console.error('GET digitization-tasks error:', e)
    return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: networkId } = await params
    const net = await queryOne<{ id: string }>(`SELECT id FROM networks WHERE id = $1`, [networkId])
    if (!net) {
      return NextResponse.json({ error: 'Network not found' }, { status: 404 })
    }

    const body = (await request.json()) as {
      kind?: string
      label?: string
      description?: string
      sortOrder?: number
      mapOverlayId?: string | null
    }

    if (!body.label?.trim()) {
      return NextResponse.json({ error: 'label required' }, { status: 400 })
    }
    const kind = body.kind as DigitizationTaskKind
    if (!kind || !KINDS.includes(kind)) {
      return NextResponse.json({ error: 'invalid kind' }, { status: 400 })
    }

    const sortOrder =
      typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)
        ? Math.floor(body.sortOrder)
        : 0

    const row = await queryOne<TaskRow>(
      `INSERT INTO network_digitization_tasks (
         network_id, map_overlay_id, kind, label, description, sort_order
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, network_id, map_overlay_id, kind, label, description, sort_order,
                 completed_trail_id, completed_at, completed_by_user_id, created_at`,
      [
        networkId,
        body.mapOverlayId ?? null,
        kind,
        body.label.trim(),
        body.description?.trim() || null,
        sortOrder,
      ]
    )

    if (!row) {
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }
    return NextResponse.json({ task: rowToTask(row) })
  } catch (e) {
    console.error('POST digitization-tasks error:', e)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
