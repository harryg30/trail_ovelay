'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SessionUser } from '@/lib/auth'
import type {
  MapOverlayAlignmentPoint,
  MapOverlayRecord,
  NetworkDigitizationTask,
  OfficialMapLayerPayload,
  PendingDigitizationTask,
  Trail,
  DigitizationTaskKind,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type AlignPhase = 'idle' | 'img1' | 'map1' | 'img2' | 'map2'

type AlignDraft = {
  overlayId: string
  phase: AlignPhase
  img1?: { x: number; y: number }
  map1?: [number, number]
  img2?: { x: number; y: number }
}

const KIND_OPTIONS: { value: DigitizationTaskKind; label: string }[] = [
  { value: 'named_route', label: 'Named route' },
  { value: 'intersection_route', label: 'Intersection route' },
  { value: 'loop', label: 'Loop' },
  { value: 'other', label: 'Other' },
]

export function OfficialMapAndTasksPanel({
  networkId,
  user,
  trails,
  onOfficialMapLayerChange,
  onAlignmentMapPickChange,
  pendingDigitizationTask,
  onPendingDigitizationTaskChange,
  onRefetchNetworks,
}: {
  networkId: string
  user: SessionUser | null
  trails: Trail[]
  onOfficialMapLayerChange: (layer: OfficialMapLayerPayload | null) => void
  onAlignmentMapPickChange: (handler: null | ((latlng: [number, number]) => void)) => void
  pendingDigitizationTask: PendingDigitizationTask | null
  onPendingDigitizationTaskChange: (task: PendingDigitizationTask | null) => void
  onRefetchNetworks: () => void
}) {
  const [overlay, setOverlay] = useState<MapOverlayRecord | null>(null)
  const [alignmentPoints, setAlignmentPoints] = useState<MapOverlayAlignmentPoint[]>([])
  const [tasks, setTasks] = useState<NetworkDigitizationTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(true)
  const [alignDraft, setAlignDraft] = useState<AlignDraft | null>(null)
  const [newTaskKind, setNewTaskKind] = useState<DigitizationTaskKind>('loop')
  const [newTaskLabel, setNewTaskLabel] = useState('')

  const pushLayer = useCallback(
    (o: MapOverlayRecord | null, visible: boolean) => {
      if (!o) {
        onOfficialMapLayerChange(null)
        return
      }
      onOfficialMapLayerChange({
        blobUrl: o.blobUrl,
        opacity: o.opacity,
        transform: o.transform,
        visible: visible && !!o.transform,
      })
    },
    [onOfficialMapLayerChange]
  )

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [mapRes, taskRes] = await Promise.all([
        fetch(`/api/networks/${networkId}/map-overlay`),
        fetch(`/api/networks/${networkId}/digitization-tasks`),
      ])
      const mapData = await mapRes.json()
      const taskData = await taskRes.json()
      if (!mapRes.ok) throw new Error(mapData.error || 'Failed to load map')
      if (!taskRes.ok) throw new Error(taskData.error || 'Failed to load tasks')
      const nextOverlay = mapData.overlay as MapOverlayRecord | null
      const pts = (mapData.alignmentPoints || []) as MapOverlayAlignmentPoint[]
      setOverlay(nextOverlay)
      setAlignmentPoints(pts)
      setTasks(taskData.tasks || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
      setOverlay(null)
      onOfficialMapLayerChange(null)
    } finally {
      setLoading(false)
    }
  }, [networkId, onOfficialMapLayerChange])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    pushLayer(overlay, overlayVisible)
  }, [overlay, overlayVisible, pushLayer])

  const cancelAlignment = useCallback(() => {
    setAlignDraft(null)
    onAlignmentMapPickChange(null)
  }, [onAlignmentMapPickChange])

  const startAlignment = useCallback(
    (overlayId: string) => {
      setAlignDraft({ overlayId, phase: 'img1' })
      onAlignmentMapPickChange(null)
    },
    [onAlignmentMapPickChange]
  )

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!alignDraft || (alignDraft.phase !== 'img1' && alignDraft.phase !== 'img2')) return
      const img = e.currentTarget
      const rect = img.getBoundingClientRect()
      const nw = img.naturalWidth || overlay?.imageWidth || 1
      const nh = img.naturalHeight || overlay?.imageHeight || 1
      const sx = nw / rect.width
      const sy = nh / rect.height
      const x = (e.clientX - rect.left) * sx
      const y = (e.clientY - rect.top) * sy

      if (alignDraft.phase === 'img1') {
        const draft = { ...alignDraft, img1: { x, y }, phase: 'map1' as const }
        setAlignDraft(draft)
        onAlignmentMapPickChange((latlng) => {
          setAlignDraft((d) =>
            d && d.phase === 'map1' && d.overlayId === draft.overlayId
              ? { ...d, map1: latlng, phase: 'img2' }
              : d
          )
          onAlignmentMapPickChange(null)
        })
        return
      }

      if (alignDraft.phase === 'img2') {
        const overlayId = alignDraft.overlayId
        const img1 = alignDraft.img1
        const map1 = alignDraft.map1
        if (!img1 || !map1) return
        setAlignDraft({ ...alignDraft, phase: 'map2' })
        onAlignmentMapPickChange((latlng) => {
          void (async () => {
            const pairs = [
              { img: { x: img1.x, y: img1.y }, ll: { lat: map1[0], lon: map1[1] } },
              { img: { x, y }, ll: { lat: latlng[0], lon: latlng[1] } },
            ]
            const res = await fetch(`/api/map-overlays/${overlayId}/alignment`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pairs }),
            })
            const data = await res.json()
            if (!res.ok) {
              setError(data.error || 'Alignment failed')
            } else {
              setOverlay(data.overlay)
              setAlignmentPoints([
                {
                  seq: 1,
                  imgX: pairs[0].img.x,
                  imgY: pairs[0].img.y,
                  lat: pairs[0].ll.lat,
                  lon: pairs[0].ll.lon,
                },
                {
                  seq: 2,
                  imgX: pairs[1].img.x,
                  imgY: pairs[1].img.y,
                  lat: pairs[1].ll.lat,
                  lon: pairs[1].ll.lon,
                },
              ])
            }
            setAlignDraft(null)
            onAlignmentMapPickChange(null)
          })()
        })
      }
    },
    [alignDraft, onAlignmentMapPickChange, overlay]
  )

  const handleOpacityChange = async (next: number) => {
    if (!overlay) return
    const res = await fetch(`/api/map-overlays/${overlay.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opacity: next }),
    })
    const data = await res.json()
    if (res.ok && data.overlay) {
      setOverlay(data.overlay)
    }
  }

  const handleUpload = async (file: File | null) => {
    if (!file || !user) return
    const img = new Image()
    const url = URL.createObjectURL(file)
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      img.onload = () => {
        resolve({ w: img.naturalWidth, h: img.naturalHeight })
        URL.revokeObjectURL(url)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Could not read image dimensions'))
      }
      img.src = url
    })
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('imageWidth', String(dims.w))
      fd.set('imageHeight', String(dims.h))
      const res = await fetch(`/api/networks/${networkId}/map-overlay`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setOverlay(data.overlay)
      setAlignmentPoints([])
      cancelAlignment()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const addTask = async () => {
    if (!newTaskLabel.trim()) return
    const res = await fetch(`/api/networks/${networkId}/digitization-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: newTaskKind,
        label: newTaskLabel.trim(),
        mapOverlayId: overlay?.id ?? null,
      }),
    })
    const data = await res.json()
    if (res.ok && data.task) {
      setTasks((t) => [...t, data.task])
      setNewTaskLabel('')
    } else {
      setError(data.error || 'Could not add task')
    }
  }

  const completeTaskWithTrail = async (taskId: string, trailId: string | null) => {
    const res = await fetch(`/api/digitization-tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        trailId ? { completedTrailId: trailId } : { clearCompletion: true }
      ),
    })
    const data = await res.json()
    if (res.ok && data.task) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)))
      if (trailId) onRefetchNetworks()
    }
  }

  const deleteTask = async (taskId: string) => {
    const res = await fetch(`/api/digitization-tasks/${taskId}`, { method: 'DELETE' })
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      if (pendingDigitizationTask?.id === taskId) onPendingDigitizationTaskChange(null)
    }
  }

  if (!user) {
    return (
      <p className="text-xs text-muted-foreground">
        Sign in to upload an official map and manage trace tasks.
      </p>
    )
  }

  const inputCls =
    'w-full rounded border border-border bg-mud/45 px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-ring'

  const alignHint =
    alignDraft?.phase === 'img1'
      ? 'Click point 1 on the map image…'
      : alignDraft?.phase === 'map1'
        ? 'Click the same feature on the basemap…'
        : alignDraft?.phase === 'img2'
          ? 'Click point 2 on the map image…'
          : alignDraft?.phase === 'map2'
            ? 'Click the same feature on the basemap…'
            : null

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3 mt-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Official map & trace tasks
      </p>

      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {!loading && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted-foreground">Upload map image (PNG / JPEG / WebP)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              className="text-xs"
              onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
            />
            {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
          </div>

          {overlay && (
            <>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overlayVisible}
                    onChange={(e) => setOverlayVisible(e.target.checked)}
                    className="accent-primary"
                  />
                  Show aligned map on basemap
                </label>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Overlay opacity ({Math.round((overlay.opacity ?? 0.55) * 100)}%)
                </label>
                <input
                  type="range"
                  min={0.15}
                  max={1}
                  step={0.05}
                  value={overlay.opacity ?? 0.55}
                  onChange={(e) => void handleOpacityChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {alignHint && (
                <p className="text-xs font-medium text-electric bg-primary/10 border border-primary/30 rounded px-2 py-1.5">
                  {alignHint}
                </p>
              )}

              <div className="relative rounded border border-border overflow-hidden bg-mud/30">
                {/* Official map preview / align target — external Blob URL, not next/image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={overlay.blobUrl}
                  alt="Official map reference"
                  className={`w-full h-auto max-h-48 object-contain bg-black/5 ${
                    alignDraft?.phase === 'img1' || alignDraft?.phase === 'img2'
                      ? 'cursor-crosshair ring-2 ring-electric'
                      : ''
                  }`}
                  onClick={handleImageClick}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {!overlay.transform ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!!alignDraft}
                    onClick={() => startAlignment(overlay.id)}
                  >
                    Align map (2 points)
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => startAlignment(overlay.id)}>
                    Re-align
                  </Button>
                )}
                {alignDraft && (
                  <Button type="button" size="sm" variant="ghost" onClick={cancelAlignment}>
                    Cancel align
                  </Button>
                )}
              </div>

              {alignmentPoints.length > 0 && !alignDraft && (
                <p className="text-xs text-muted-foreground">
                  {alignmentPoints.length} alignment point{alignmentPoints.length === 1 ? '' : 's'} saved.
                </p>
              )}
            </>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-foreground">Digitization tasks</p>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Kind</label>
                <select
                  className={inputCls}
                  value={newTaskKind}
                  onChange={(e) => setNewTaskKind(e.target.value as DigitizationTaskKind)}
                >
                  {KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-[2] flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Label</label>
                <Input
                  className={inputCls}
                  value={newTaskLabel}
                  onChange={(e) => setNewTaskLabel(e.target.value)}
                  placeholder="e.g. Yellow triangle loop"
                />
              </div>
              <Button type="button" size="sm" onClick={() => void addTask()}>
                Add
              </Button>
            </div>

            {tasks.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                <input
                  type="radio"
                  name="pending-task"
                  checked={pendingDigitizationTask === null}
                  onChange={() => onPendingDigitizationTaskChange(null)}
                  className="accent-primary"
                />
                No linked task for next drawn trail
              </label>
            )}

            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tasks yet.</p>
            ) : (
              <ul className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                {tasks.map((t) => (
                  <li
                    key={t.id}
                    className="rounded border border-border bg-mud/25 px-2 py-2 text-xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={t.completedTrailId ? 'line-through text-muted-foreground' : ''}>
                        <span className="font-medium">{t.label}</span>
                        <span className="text-muted-foreground ml-1">({t.kind})</span>
                      </span>
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => void deleteTask(t.id)}>
                        ×
                      </Button>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-muted-foreground">Link trail</label>
                      <select
                        className={inputCls}
                        value={t.completedTrailId ?? ''}
                        onChange={(e) =>
                          void completeTaskWithTrail(t.id, e.target.value || null)
                        }
                      >
                        <option value="">— Not done —</option>
                        {trails.map((tr) => (
                          <option key={tr.id} value={tr.id}>
                            {tr.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="pending-task"
                        checked={pendingDigitizationTask?.id === t.id}
                        disabled={!!t.completedTrailId}
                        onChange={() =>
                          onPendingDigitizationTaskChange({ id: t.id, label: t.label, networkId })
                        }
                        className="accent-primary"
                      />
                      <span>Offer to complete when I save next drawn trail</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
