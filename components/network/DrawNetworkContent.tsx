'use client'

import { useState } from 'react'
import type { Trail, Network } from '@/lib/types'

export function DrawNetworkContent({
  trails,
  drawNetworkPoints,
  selectedNetwork,
  onSave,
  onUpdate,
  onCancel,
}: {
  trails: Trail[]
  drawNetworkPoints: [number, number][]
  selectedNetwork: Network | null
  onSave: (name: string, polygon: [number, number][], trailIds: string[]) => Promise<string | null>
  onUpdate: (name: string, polygon: [number, number][] | null, trailIds: string[]) => Promise<string | null>
  onCancel: () => void
}) {
  const isRedraw = selectedNetwork !== null
  const [phase, setPhase] = useState<'draw' | 'name'>('draw')
  const [name, setName] = useState(isRedraw ? selectedNetwork.name : '')
  const [selectedTrailIds, setSelectedTrailIds] = useState<Set<string>>(
    new Set(isRedraw ? selectedNetwork.trailIds : [])
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const canClose = drawNetworkPoints.length >= 3

  const toggleTrail = (id: string) => {
    setSelectedTrailIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    if (!name.trim() || !canClose) return
    setSaving(true)
    setSaveError(null)
    const fn = isRedraw ? onUpdate : onSave
    const err = await fn(name.trim(), drawNetworkPoints, Array.from(selectedTrailIds))
    if (err) { setSaveError(err); setSaving(false) }
  }

  const inputCls = 'w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 focus:outline-none focus:border-blue-400'

  if (phase === 'draw') {
    return (
      <div className="flex flex-col gap-3">
        <div className="py-2 px-2.5 rounded-md bg-blue-50 border border-blue-100">
          <p className="text-xs font-medium text-blue-800 mb-0.5">
            {isRedraw ? `Redrawing "${selectedNetwork.name}"` : 'Draw network boundary'}
          </p>
          <p className="text-xs text-blue-700">Click on the map to place polygon vertices.</p>
          {drawNetworkPoints.length > 0 && (
            <p className="text-xs text-blue-600 mt-1">{drawNetworkPoints.length} point{drawNetworkPoints.length !== 1 ? 's' : ''} placed</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPhase('name')}
            disabled={!canClose}
            className="flex-1 py-2 rounded-md bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {canClose ? 'Name Network →' : `Need ${3 - drawNetworkPoints.length} more point${3 - drawNetworkPoints.length !== 1 ? 's' : ''}`}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-md border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Network name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Highland Trails"
          className={inputCls}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-zinc-500">Trails in this network</label>
        {trails.length === 0 ? (
          <p className="text-xs text-zinc-400">No trails yet.</p>
        ) : (
          <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
            {trails.map((trail) => (
              <label key={trail.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-zinc-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTrailIds.has(trail.id)}
                  onChange={() => toggleTrail(trail.id)}
                  className="accent-blue-500"
                />
                <span className="text-xs text-zinc-700 truncate">{trail.name}</span>
                <span className="text-xs text-zinc-400 ml-auto shrink-0">{trail.distanceKm.toFixed(1)} km</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {saveError && <p className="text-xs text-red-500">{saveError}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="flex-1 py-2 rounded-md bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : isRedraw ? 'Update Network' : 'Save Network'}
        </button>
        <button
          type="button"
          onClick={() => setPhase('draw')}
          disabled={saving}
          className="px-3 py-2 rounded-md border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
