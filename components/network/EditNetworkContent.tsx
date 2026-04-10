'use client'

import { useState, useEffect } from 'react'
import type { Trail, Network, OfficialMapLayerPayload, PendingDigitizationTask } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton'
import { SearchableDropdown } from '@/components/shared/SearchableDropdown'
import { OfficialMapAndTasksPanel } from '@/components/network/OfficialMapAndTasksPanel'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMap } from '@fortawesome/free-solid-svg-icons'

export function EditNetworkContent({
  variant = 'full',
  trails,
  networks,
  selectedNetwork,
  onSelectNetwork,
  onUpdate,
  onDelete,
  onRedraw,
  onCancel,
  user,
  onOfficialMapLayerChange,
  onAlignmentMapPickChange,
  pendingDigitizationTask,
  onPendingDigitizationTaskChange,
  onRefetchNetworks,
  officialMapLayer,
  onNetworkOfficialMapClick,
}: {
  /** `map-only`: upload, align, tasks — no name/trails/polygon edit. */
  variant?: 'full' | 'map-only'
  trails: Trail[]
  networks: Network[]
  selectedNetwork: Network | null
  onSelectNetwork: (network: Network | null) => void
  onUpdate: (name: string, polygon: [number, number][] | null, trailIds: string[]) => Promise<string | null>
  onDelete: () => Promise<string | null>
  onRedraw: () => void
  onCancel: () => void
  user: SessionUser | null
  onOfficialMapLayerChange: (layer: OfficialMapLayerPayload | null) => void
  onAlignmentMapPickChange: (handler: null | ((latlng: [number, number]) => void)) => void
  pendingDigitizationTask: PendingDigitizationTask | null
  onPendingDigitizationTaskChange: (task: PendingDigitizationTask | null) => void
  onRefetchNetworks: () => void
  officialMapLayer: OfficialMapLayerPayload | null
  onNetworkOfficialMapClick: (network: Network) => void
}) {
  const mapOnly = variant === 'map-only'
  const [name, setName] = useState(selectedNetwork?.name ?? '')
  const [selectedTrailIds, setSelectedTrailIds] = useState<Set<string>>(
    new Set(selectedNetwork?.trailIds ?? [])
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [trailsFilter, setTrailsFilter] = useState('')

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

  const inputCls = 'w-full rounded border border-border bg-mud/45 px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-ring'
  const disabled = !selectedNetwork

  const isOfficialMapVisibleOnMap = (network: Network) =>
    !!(
      officialMapLayer?.visible &&
      officialMapLayer.networkId === network.id &&
      officialMapLayer.transform
    )

  return (
    <div className="flex flex-col gap-3">
      {mapOnly && (
        <h3 className="font-display text-xs font-normal uppercase tracking-[0.15em] text-muted-foreground">
          Official map
        </h3>
      )}
      <SearchableDropdown
        items={networks}
        selectedItem={selectedNetwork}
        onSelect={onSelectNetwork}
        onClear={() => onSelectNetwork(null)}
        getSearchText={(n) => n.name}
        renderItem={(network, isSelected) => (
          <span className={`px-3 py-2 text-sm hover:bg-primary/10 flex items-center justify-between gap-2 ${isSelected ? 'bg-primary/10 text-electric' : 'text-foreground'}`}>
            <span className="truncate">{network.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">{network.trailIds.length} trails</span>
          </span>
        )}
        renderSideAction={(network, close) => {
          const aligned = network.officialMapAligned === true
          const showMapControl = aligned || !!user
          if (!showMapControl) return null
          const onMap = isOfficialMapVisibleOnMap(network)
          return (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onNetworkOfficialMapClick(network)
                close()
              }}
              title={
                aligned
                  ? onMap
                    ? 'Hide official map overlay'
                    : 'Show official map overlay'
                  : user
                    ? 'Upload or align official map'
                    : ''
              }
              className={
                aligned && onMap
                  ? 'flex size-8 items-center justify-center rounded-sm text-primary hover:bg-primary/15 transition-colors'
                  : 'flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-mud/80 hover:text-foreground transition-colors'
              }
            >
              <FontAwesomeIcon icon={faMap} className="w-3.5 h-3.5" />
            </button>
          )
        }}
        placeholder="Search networks…"
        inputCls={inputCls}
      />

      {!selectedNetwork && (
        <p className="text-xs text-muted-foreground">Search above or click a network on the map.</p>
      )}

      {mapOnly ? (
        <>
          {selectedNetwork && (
            <OfficialMapAndTasksPanel
              networkId={selectedNetwork.id}
              user={user}
              trails={trails}
              onOfficialMapLayerChange={onOfficialMapLayerChange}
              onAlignmentMapPickChange={onAlignmentMapPickChange}
              pendingDigitizationTask={pendingDigitizationTask}
              onPendingDigitizationTaskChange={onPendingDigitizationTaskChange}
              onRefetchNetworks={onRefetchNetworks}
            />
          )}
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-mud/45 transition-colors"
          >
            Close
          </button>
        </>
      ) : (
        <div className={`flex flex-col gap-3${disabled ? ' opacity-50 pointer-events-none' : ''}`}>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              disabled={disabled}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Trails</label>
            {trails.length === 0 ? (
              <p className="text-xs text-muted-foreground">No trails yet.</p>
            ) : (
              <>
                <input
                  type="search"
                  value={trailsFilter}
                  onChange={(e) => setTrailsFilter(e.target.value)}
                  placeholder="Filter trails…"
                  className={inputCls}
                  aria-label="Filter trails"
                />
                <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto">
                  {trails
                    .filter((trail) =>
                      trailsFilter.trim()
                        ? trail.name.toLowerCase().includes(trailsFilter.trim().toLowerCase())
                        : true
                    )
                    .map((trail) => (
                      <label
                        key={trail.id}
                        className="flex items-center gap-2 py-1 px-2 rounded hover:bg-mud/45 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTrailIds.has(trail.id)}
                          onChange={() => toggleTrail(trail.id)}
                          className="accent-primary"
                        />
                        <span className="text-xs text-foreground truncate">{trail.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          {trail.distanceKm.toFixed(1)} km
                        </span>
                      </label>
                    ))}
                </div>
              </>
            )}
          </div>

          {selectedNetwork && (
            <OfficialMapAndTasksPanel
              networkId={selectedNetwork.id}
              user={user}
              trails={trails}
              onOfficialMapLayerChange={onOfficialMapLayerChange}
              onAlignmentMapPickChange={onAlignmentMapPickChange}
              pendingDigitizationTask={pendingDigitizationTask}
              onPendingDigitizationTaskChange={onPendingDigitizationTaskChange}
              onRefetchNetworks={onRefetchNetworks}
            />
          )}

          {saveError && <p className="text-xs text-destructive">{saveError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={disabled || saving || !name.trim()}
              className="flex-1 py-2 rounded-md bg-primary/100 text-white text-sm font-medium hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-3 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-mud/45 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>

          <button
            type="button"
            onClick={onRedraw}
            disabled={disabled || saving}
            className="w-full py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-mud/45 disabled:opacity-50 transition-colors"
          >
            Redraw Polygon
          </button>

          <ConfirmDeleteButton onDelete={onDelete} disabled={disabled || saving} entityLabel="Network" />
        </div>
      )}
    </div>
  )
}
