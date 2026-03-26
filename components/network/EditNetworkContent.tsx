'use client'

import { useState, useEffect } from 'react'
import type { Trail, Network } from '@/lib/types'
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton'
import { SearchableDropdown } from '@/components/shared/SearchableDropdown'

export function EditNetworkContent({
  trails,
  networks,
  selectedNetwork,
  onSelectNetwork,
  onUpdate,
  onDelete,
  onRedraw,
  onCancel,
}: {
  trails: Trail[]
  networks: Network[]
  selectedNetwork: Network | null
  onSelectNetwork: (network: Network | null) => void
  onUpdate: (name: string, polygon: [number, number][] | null, trailIds: string[]) => Promise<string | null>
  onDelete: () => Promise<string | null>
  onRedraw: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(selectedNetwork?.name ?? '')
  const [selectedTrailIds, setSelectedTrailIds] = useState<Set<string>>(
    new Set(selectedNetwork?.trailIds ?? [])
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedNetwork) {
      setName(selectedNetwork.name)
      setSelectedTrailIds(new Set(selectedNetwork.trailIds))
      setSaveError(null)
    }
  }, [selectedNetwork?.id])

  const toggleTrail = (id: string) => {
    setSelectedTrailIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    if (!selectedNetwork || !name.trim()) return
    setSaving(true)
    setSaveError(null)
    const err = await onUpdate(name.trim(), null, Array.from(selectedTrailIds))
    if (err) setSaveError(err)
    setSaving(false)
  }

  const inputCls = 'w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 focus:outline-none focus:border-blue-400'
  const disabled = !selectedNetwork

  return (
    <div className="flex flex-col gap-3">
      <SearchableDropdown
        items={networks}
        selectedItem={selectedNetwork}
        onSelect={onSelectNetwork}
        onClear={() => onSelectNetwork(null)}
        getSearchText={(n) => n.name}
        renderItem={(network, isSelected) => (
          <span className={`px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2 ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-zinc-800'}`}>
            <span className="truncate">{network.name}</span>
            <span className="text-xs text-zinc-400 shrink-0">{network.trailIds.length} trails</span>
          </span>
        )}
        placeholder="Search networks…"
        inputCls={inputCls}
      />

      {!selectedNetwork && (
        <p className="text-xs text-zinc-500">Search above or click a network on the map.</p>
      )}

      <div className={`flex flex-col gap-3${disabled ? ' opacity-50 pointer-events-none' : ''}`}>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-500">Trails</label>
          {trails.length === 0 ? (
            <p className="text-xs text-zinc-400">No trails yet.</p>
          ) : (
            <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto">
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
            disabled={disabled || saving || !name.trim()}
            className="flex-1 py-2 rounded-md bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-2 rounded-md border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>

        <button
          type="button"
          onClick={onRedraw}
          disabled={disabled || saving}
          className="w-full py-2 rounded-md border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
        >
          Redraw Polygon
        </button>

        <ConfirmDeleteButton onDelete={onDelete} disabled={disabled || saving} entityLabel="Network" />
      </div>
    </div>
  )
}
