'use client'

import { useRef, useState, useEffect } from 'react'
import type { Ride, Trail, TrimPoint, TrimSegment, TrimFormState, EditMode, Network } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'
import AuthButton from '@/components/AuthButton'

interface LeftDrawerProps {
  user: SessionUser | null
  rides: Ride[]
  trails: Trail[]
  hiddenRideIds: Set<string>
  onToggleRide: (id: string) => void
  onRidesUploaded: (rides: Ride[]) => void
  onSyncComplete: () => Promise<void>
  editMode: EditMode
  onEditModeChange: (mode: EditMode) => void
  trimStart: TrimPoint | null
  trimSegment: TrimSegment | null
  onSaveTrail: (form: TrimFormState) => Promise<string | null>
  onStepTrimPoint: (which: 'start' | 'end', delta: number) => void
  onClearTrimPoint: (which: 'start' | 'end') => void
  selectedTrail: Trail | null
  onSelectTrail: (trail: Trail | null) => void
  onUpdateTrail: (form: TrimFormState) => Promise<string | null>
  onDeleteTrail: () => Promise<string | null>
  onEnterRefineMode: () => void
  onSaveRefinedTrail: () => Promise<void>
  savingRefined: boolean
  refineError: string | null
  networks: Network[]
  selectedNetwork: Network | null
  drawNetworkPoints: [number, number][]
  onSelectNetwork: (network: Network | null) => void
  onSaveNetwork: (name: string, polygon: [number, number][], trailIds: string[]) => Promise<string | null>
  onUpdateNetwork: (name: string, polygon: [number, number][] | null, trailIds: string[]) => Promise<string | null>
  onDeleteNetwork: () => Promise<string | null>
  onStartRedrawNetwork: () => void
  showHeatmap: boolean
  onToggleHeatmap: () => void
  onOpenAnnouncement: () => void
}

export default function LeftDrawer({
  user,
  rides,
  trails,
  hiddenRideIds,
  onToggleRide,
  onRidesUploaded,
  onSyncComplete,
  editMode,
  onEditModeChange,
  trimStart,
  trimSegment,
  onSaveTrail,
  onStepTrimPoint,
  onClearTrimPoint,
  selectedTrail,
  onSelectTrail,
  onUpdateTrail,
  onDeleteTrail,
  onEnterRefineMode,
  onSaveRefinedTrail,
  savingRefined,
  refineError,
  networks,
  selectedNetwork,
  drawNetworkPoints,
  onSelectNetwork,
  onSaveNetwork,
  onUpdateNetwork,
  onDeleteNetwork,
  onStartRedrawNetwork,
  showHeatmap,
  onToggleHeatmap,
  onOpenAnnouncement,
}: LeftDrawerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [ridesQuery, setRidesQuery] = useState('')
  const [ridesPageSize, setRidesPageSize] = useState(() => {
    if (typeof window === 'undefined') return 10
    const saved = localStorage.getItem('ridesPageSize')
    return saved ? Number(saved) : 10
  })
  const [ridesPage, setRidesPage] = useState(0)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setUploading(true)
    setUploadError(null)
    setUploadProgress({ done: 0, total: files.length })

    const allRides: Ride[] = []
    const errors: string[] = []

    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ done: i, total: files.length })
      try {
        const formData = new FormData()
        formData.append('file', files[i])
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.success) {
          allRides.push(...data.rides)
        } else {
          errors.push(`${files[i].name}: ${data.error ?? 'failed'}`)
        }
      } catch {
        errors.push(`${files[i].name}: network error`)
      }
    }

    if (allRides.length > 0) onRidesUploaded(allRides)
    if (errors.length > 0) setUploadError(errors.join(', '))
    setUploading(false)
    setUploadProgress(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/strava/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSyncMessage(data.error ?? 'Sync failed')
      } else {
        await onSyncComplete()
        setSyncMessage(`Synced ${data.synced} ride${data.synced !== 1 ? 's' : ''}`)
      }
    } catch {
      setSyncMessage('Network error — sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleModeClick = (mode: EditMode) => {
    onEditModeChange(editMode === mode ? null : mode)
  }

  return (
    <div className="w-80 h-screen bg-white border-r border-zinc-200 shadow-lg flex flex-col overflow-y-auto shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-zinc-100">
        <h1 className="text-base font-semibold text-zinc-900">Trail Overlay</h1>
        <AuthButton user={user} />
      </div>

      {/* Upload section */}
      <div className="px-4 py-4 border-b border-zinc-100 flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".gpx,.zip"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        {user ? (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="w-full py-2 px-3 rounded-md bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadProgress
                ? `Uploading ${uploadProgress.done} / ${uploadProgress.total}…`
                : 'Upload GPX / ZIP'}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full py-2 px-3 rounded-md bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {syncing ? 'Syncing...' : 'Sync Strava Rides'}
            </button>
            {syncMessage && <p className="text-xs text-zinc-500">{syncMessage}</p>}
          </>
        ) : (
          <p className="text-xs text-zinc-400">Connect with Strava to upload rides.</p>
        )}
        {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
      </div>

      {/* Rides list */}
      <div className="px-4 py-4 border-b border-zinc-100 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            Rides ({rides.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleHeatmap}
              title={showHeatmap ? 'Hide heatmap' : 'Show heatmap'}
              className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                showHeatmap
                  ? 'bg-orange-500 text-white'
                  : 'border border-zinc-200 text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M12.316 3.051a1 1 0 01.633 1.265 4 4 0 00-.382 1.558c0 1.192.59 2.247 1.504 2.895a1 1 0 01-.416 1.791 5 5 0 01-5.343-1.888A7 7 0 003 13.5C3 16.538 5.463 19 8.5 19h3C14.538 19 17 16.538 17 13.5c0-3.316-1.74-6.224-4.362-7.946a1 1 0 01-.322-2.503z" />
              </svg>
            </button>
            <select
              value={ridesPageSize}
              onChange={(e) => { const v = Number(e.target.value); setRidesPageSize(v); localStorage.setItem('ridesPageSize', String(v)); setRidesPage(0) }}
              className="text-xs border border-zinc-200 rounded px-1 py-0.5 text-zinc-600 bg-white"
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
            </select>
          </div>
        </div>
        {rides.length === 0 ? (
          <p className="text-xs text-zinc-400">No rides uploaded yet.</p>
        ) : (() => {
          const filteredRides = ridesQuery.trim()
            ? rides.filter(r => r.name.toLowerCase().includes(ridesQuery.toLowerCase()))
            : rides
          const totalPages = Math.max(1, Math.ceil(filteredRides.length / ridesPageSize))
          const safePage = Math.min(ridesPage, totalPages - 1)
          const pagedRides = filteredRides.slice(safePage * ridesPageSize, (safePage + 1) * ridesPageSize)
          return (
            <>
              <input
                type="text"
                value={ridesQuery}
                onChange={(e) => { setRidesQuery(e.target.value); setRidesPage(0) }}
                placeholder="Search rides…"
                className="w-full border border-zinc-200 rounded-md px-3 py-1.5 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300"
              />
              {pagedRides.length === 0 ? (
                <p className="text-xs text-zinc-400">No rides match.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {pagedRides.map((ride) => {
                    const hidden = hiddenRideIds.has(ride.id)
                    return (
                      <li
                        key={ride.id}
                        className={`flex items-center justify-between py-2 px-3 rounded-md text-sm ${hidden ? 'bg-zinc-50 opacity-50' : 'bg-zinc-50'}`}
                      >
                        <span className="text-zinc-800 truncate pr-2">{ride.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-zinc-400 text-xs">
                            {(ride.distance / 1000).toFixed(1)} km
                          </span>
                          <button
                            type="button"
                            onClick={() => onToggleRide(ride.id)}
                            title={hidden ? 'Show on map' : 'Hide from map'}
                            className="text-zinc-400 hover:text-zinc-700 transition-colors"
                          >
                            {hidden ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" clipRule="evenodd" />
                                <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                                <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setRidesPage(p => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="text-xs px-2 py-1 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <span className="text-xs text-zinc-400">
                    Page {safePage + 1} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRidesPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage === totalPages - 1}
                    className="text-xs px-2 py-1 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )
        })()}
      </div>

      {/* Trails list */}
      <div className="px-4 py-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            Trails ({trails.length})
          </h2>
          {user && (
            <button
              type="button"
              onClick={() => handleModeClick('add-trail')}
              title={editMode === 'add-trail' ? 'Cancel' : 'Add new trail'}
              className={`w-6 h-6 flex items-center justify-center rounded text-base font-light transition-colors ${
                editMode === 'add-trail'
                  ? 'bg-orange-500 text-white'
                  : 'border border-zinc-200 text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              {editMode === 'add-trail' ? '×' : '+'}
            </button>
          )}
        </div>

        {editMode === 'add-trail' && (
          <AddTrailContent
            trimStart={trimStart}
            trimSegment={trimSegment}
            onSaveTrail={onSaveTrail}
            onCancel={() => onEditModeChange(null)}
            onStepTrimPoint={onStepTrimPoint}
            onClearTrimPoint={onClearTrimPoint}
          />
        )}

        {trails.length === 0 ? (
          <p className="text-xs text-zinc-400">No trails saved yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {trails.map((trail) => (
              <li
                key={trail.id}
                className={`flex items-center justify-between py-2 px-3 rounded-md bg-zinc-50 text-sm ${
                  selectedTrail?.id === trail.id && editMode === 'edit-trail' ? 'ring-1 ring-orange-400' : ''
                }`}
              >
                <span className="text-zinc-800 truncate pr-2">{trail.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-zinc-400 text-xs">{trail.distanceKm.toFixed(1)} km</span>
                  {trail.difficulty !== 'not_set' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      trail.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                      trail.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {trail.difficulty[0].toUpperCase() + trail.difficulty.slice(1)}
                    </span>
                  )}
                  {user && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTrail(trail)
                        onEditModeChange('edit-trail')
                      }}
                      title="Edit trail"
                      className="text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                        <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {editMode === 'edit-trail' && (
          <EditTrailContent
            trails={trails}
            selectedTrail={selectedTrail}
            onSelectTrail={onSelectTrail}
            onUpdateTrail={onUpdateTrail}
            onDeleteTrail={onDeleteTrail}
            onEnterRefineMode={selectedTrail ? onEnterRefineMode : undefined}
          />
        )}

        {editMode === 'refine-trail' && selectedTrail && (
          <div className="flex flex-col gap-3">
            <div className="py-2 px-2.5 rounded-md bg-orange-50 border border-orange-100">
              <p className="text-xs font-medium text-orange-800 mb-0.5">{selectedTrail.name}</p>
              <p className="text-xs text-orange-700">Drag nodes on the map to reposition the line.</p>
            </div>
            {refineError && <p className="text-xs text-red-500">{refineError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSaveRefinedTrail}
                disabled={savingRefined}
                className="flex-1 py-2 rounded-md bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingRefined ? 'Saving…' : 'Save Refinement'}
              </button>
              <button
                type="button"
                onClick={() => onEditModeChange('edit-trail')}
                disabled={savingRefined}
                className="px-3 py-2 rounded-md border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Networks section */}
      <div className="px-4 py-4 border-t border-zinc-100 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            Networks ({networks.length})
          </h2>
          {user && (
            <button
              type="button"
              onClick={() => onEditModeChange(editMode === 'add-network' ? null : 'add-network')}
              title={editMode === 'add-network' ? 'Cancel' : 'Add new network'}
              className={`w-6 h-6 flex items-center justify-center rounded text-base font-light transition-colors ${
                editMode === 'add-network'
                  ? 'bg-blue-500 text-white'
                  : 'border border-zinc-200 text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              {editMode === 'add-network' ? '×' : '+'}
            </button>
          )}
        </div>

        {(editMode === 'add-network') && (
          <DrawNetworkContent
            trails={trails}
            drawNetworkPoints={drawNetworkPoints}
            selectedNetwork={selectedNetwork}
            onSave={onSaveNetwork}
            onUpdate={onUpdateNetwork}
            onCancel={() => onEditModeChange(null)}
          />
        )}

        {editMode === 'edit-network' && (
          <EditNetworkContent
            trails={trails}
            networks={networks}
            selectedNetwork={selectedNetwork}
            onSelectNetwork={onSelectNetwork}
            onUpdate={onUpdateNetwork}
            onDelete={onDeleteNetwork}
            onRedraw={onStartRedrawNetwork}
            onCancel={() => { onSelectNetwork(null); onEditModeChange(null) }}
          />
        )}

        {networks.length === 0 ? (
          <p className="text-xs text-zinc-400">No networks yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {networks.map((network) => (
              <NetworkRow
                key={network.id}
                network={network}
                trails={trails}
                isSelected={selectedNetwork?.id === network.id && editMode === 'edit-network'}
                onEdit={() => {
                  onSelectNetwork(network)
                  onEditModeChange('edit-network')
                }}
                user={user}
              />
            ))}
          </ul>
        )}
      </div>

      {/* About footer */}
      <div className="mt-auto px-4 py-3 border-t border-zinc-100">
        <button
          type="button"
          onClick={onOpenAnnouncement}
          className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          About Trail Overlay
        </button>
      </div>
    </div>
  )
}

function NetworkRow({
  network,
  trails,
  isSelected,
  onEdit,
  user,
}: {
  network: Network
  trails: Trail[]
  isSelected: boolean
  onEdit: () => void
  user: SessionUser | null
}) {
  const [expanded, setExpanded] = useState(false)
  const networkTrails = trails.filter((t) => network.trailIds.includes(t.id))

  return (
    <li className={`flex flex-col rounded-md bg-zinc-50 text-sm ${isSelected ? 'ring-1 ring-blue-400' : ''}`}>
      <div className="flex items-center justify-between py-2 px-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-zinc-800 truncate text-left min-w-0"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-3 h-3 shrink-0 text-zinc-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
          <span className="truncate">{network.name}</span>
        </button>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-zinc-400 text-xs">{network.trailIds.length} trails</span>
          {user && (
            <button
              type="button"
              onClick={onEdit}
              title="Edit network"
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-2 flex flex-col gap-0.5">
          {networkTrails.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">No trails assigned</p>
          ) : (
            networkTrails.map((t) => (
              <p key={t.id} className="text-xs text-zinc-600 truncate pl-4">• {t.name}</p>
            ))
          )}
        </div>
      )}
    </li>
  )
}

function DrawNetworkContent({
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

function EditNetworkContent({
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
  const [query, setQuery] = useState(selectedNetwork?.name ?? '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState(selectedNetwork?.name ?? '')
  const [selectedTrailIds, setSelectedTrailIds] = useState<Set<string>>(
    new Set(selectedNetwork?.trailIds ?? [])
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedNetwork) {
      setQuery(selectedNetwork.name)
      setName(selectedNetwork.name)
      setSelectedTrailIds(new Set(selectedNetwork.trailIds))
      setSaveError(null)
      setConfirmDelete(false)
    }
  }, [selectedNetwork?.id])

  const filtered = query.trim()
    ? networks.filter((n) => n.name.toLowerCase().includes(query.toLowerCase()))
    : networks

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (network: Network) => {
    onSelectNetwork(network)
    setQuery(network.name)
    setOpen(false)
  }

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

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    setSaveError(null)
    const err = await onDelete()
    if (err) { setSaveError(err); setDeleting(false); setConfirmDelete(false) }
  }

  const inputCls = 'w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 focus:outline-none focus:border-blue-400'
  const disabled = !selectedNetwork

  return (
    <div className="flex flex-col gap-3">
      <div ref={containerRef} className="relative">
        <div className="flex gap-1">
          <input
            type="text"
            placeholder="Search networks…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            className={inputCls}
          />
          {selectedNetwork && (
            <button
              type="button"
              onClick={() => { onSelectNetwork(null); setQuery('') }}
              className="px-2 rounded border border-zinc-200 text-zinc-400 text-xs hover:border-red-300 hover:text-red-500 transition-colors"
              title="Clear selection"
            >
              ✕
            </button>
          )}
        </div>
        {open && filtered.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-md">
            {filtered.map((network) => (
              <li key={network.id}>
                <button
                  type="button"
                  onMouseDown={() => handleSelect(network)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2 ${
                    selectedNetwork?.id === network.id ? 'bg-blue-50 text-blue-700' : 'text-zinc-800'
                  }`}
                >
                  <span className="truncate">{network.name}</span>
                  <span className="text-xs text-zinc-400 shrink-0">{network.trailIds.length} trails</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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
            disabled={disabled || saving || deleting || !name.trim()}
            className="flex-1 py-2 rounded-md bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving || deleting}
            className="px-3 py-2 rounded-md border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>

        <button
          type="button"
          onClick={onRedraw}
          disabled={disabled || saving || deleting}
          className="w-full py-2 rounded-md border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
        >
          Redraw Polygon
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={disabled || saving || deleting}
          className={`w-full py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            confirmDelete
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'border border-red-200 text-red-500 hover:bg-red-50'
          }`}
        >
          {deleting ? 'Deleting…' : confirmDelete ? 'Confirm Delete' : 'Delete Network'}
        </button>
        {confirmDelete && !deleting && (
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="text-xs text-zinc-400 hover:text-zinc-600 text-center -mt-2"
          >
            Cancel delete
          </button>
        )}
      </div>
    </div>
  )
}

function AddTrailContent({
  trimStart,
  trimSegment,
  onSaveTrail,
  onCancel,
  onStepTrimPoint,
  onClearTrimPoint,
}: {
  trimStart: TrimPoint | null
  trimSegment: TrimSegment | null
  onSaveTrail: (form: TrimFormState) => Promise<string | null>
  onCancel: () => void
  onStepTrimPoint: (which: 'start' | 'end', delta: number) => void
  onClearTrimPoint: (which: 'start' | 'end') => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {!trimStart && (
        <p className="text-xs text-zinc-500">Click a ride on the map to set the start point.</p>
      )}
      {trimStart && !trimSegment && (
        <p className="text-xs text-orange-600 font-medium">
          Start set — click to set the end point.
        </p>
      )}
      {trimSegment && (
        <EndpointControls onStep={onStepTrimPoint} onClear={onClearTrimPoint} />
      )}
      <TrimForm
        trimSegment={trimSegment}
        onSave={onSaveTrail}
        onCancel={onCancel}
        disabled={!trimSegment}
      />
    </div>
  )
}

function EndpointControls({
  onStep,
  onClear,
}: {
  onStep: (which: 'start' | 'end', delta: number) => void
  onClear: (which: 'start' | 'end') => void
}) {
  const stepBtn =
    'w-7 h-7 flex items-center justify-center rounded border border-zinc-200 text-zinc-600 text-xs hover:bg-zinc-50 active:bg-zinc-100 transition-colors'
  const clearBtn =
    'ml-auto px-2 h-7 flex items-center rounded border border-zinc-200 text-zinc-400 text-xs hover:border-red-300 hover:text-red-500 transition-colors'

  const row = (label: string, which: 'start' | 'end') => (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-zinc-500 w-8 shrink-0">{label}</span>
      <button type="button" className={stepBtn} onClick={() => onStep(which, -1)} title="Step back">
        ←
      </button>
      <button type="button" className={stepBtn} onClick={() => onStep(which, 1)} title="Step forward">
        →
      </button>
      <button type="button" className={clearBtn} onClick={() => onClear(which)}>
        Clear
      </button>
    </div>
  )

  return (
    <div className="flex flex-col gap-1.5 py-2 px-2.5 rounded-md bg-zinc-50 border border-zinc-100">
      {row('Start', 'start')}
      {row('End', 'end')}
    </div>
  )
}

function TrimForm({
  trimSegment,
  onSave,
  onCancel,
  disabled,
}: {
  trimSegment: TrimSegment | null
  onSave: (form: TrimFormState) => Promise<string | null>
  onCancel: () => void
  disabled: boolean
}) {
  const [form, setForm] = useState<TrimFormState>({
    name: '',
    difficulty: 'not_set',
    direction: 'not_set',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Reset form name when segment is set or changes
  useEffect(() => {
    if (!trimSegment) return
    setForm((prev) => ({ ...prev, name: trimSegment.ride.name + ' Trail' }))
    setSaveError(null)
  }, [trimSegment])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled || !trimSegment || !form.name.trim()) return
    setSaving(true)
    setSaveError(null)
    const err = await onSave(form)
    if (err) setSaveError(err)
    setSaving(false)
  }

  const field = (label: string, children: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500">{label}</label>
      {children}
    </div>
  )

  const inputCls =
    'w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 focus:outline-none focus:border-orange-400 disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-3${disabled ? ' opacity-50' : ''}`}>
      {/* Read-only stats */}
      <div className="flex gap-3 text-xs text-zinc-500">
        {trimSegment ? (
          <>
            <span>{trimSegment.distanceKm.toFixed(2)} km</span>
            <span>~{Math.round(trimSegment.elevationGainFt)} ft gain</span>
          </>
        ) : (
          <span>— km &nbsp; — ft gain</span>
        )}
      </div>

      {field(
        'Name *',
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className={inputCls}
          disabled={disabled}
          required
        />
      )}

      {field(
        'Difficulty',
        <select
          value={form.difficulty}
          onChange={(e) =>
            setForm((p) => ({ ...p, difficulty: e.target.value as TrimFormState['difficulty'] }))
          }
          className={inputCls}
          disabled={disabled}
        >
          <option value="not_set">Not set</option>
          <option value="easy">Easy</option>
          <option value="intermediate">Intermediate</option>
          <option value="hard">Hard</option>
        </select>
      )}

      {field(
        'Direction',
        <select
          value={form.direction}
          onChange={(e) =>
            setForm((p) => ({ ...p, direction: e.target.value as TrimFormState['direction'] }))
          }
          className={inputCls}
          disabled={disabled}
        >
          <option value="not_set">Not set</option>
          <option value="one-way">One-way</option>
          <option value="out-and-back">Out and back</option>
          <option value="loop">Loop</option>
        </select>
      )}

      {field(
        'Notes',
        <textarea
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          rows={2}
          className={inputCls + ' resize-none'}
          placeholder="Optional"
          disabled={disabled}
        />
      )}

      {saveError && <p className="text-xs text-red-500">{saveError}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={disabled || saving || !form.name.trim()}
          className="flex-1 py-2 rounded-md bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Trail'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-md border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function EditTrailContent({
  trails,
  selectedTrail,
  onSelectTrail,
  onUpdateTrail,
  onDeleteTrail,
  onEnterRefineMode,
}: {
  trails: Trail[]
  selectedTrail: Trail | null
  onSelectTrail: (trail: Trail | null) => void
  onUpdateTrail: (form: TrimFormState) => Promise<string | null>
  onDeleteTrail: () => Promise<string | null>
  onEnterRefineMode?: () => void
}) {
  const [query, setQuery] = useState(selectedTrail?.name ?? '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync input when trail is selected externally (e.g. map click)
  useEffect(() => {
    if (selectedTrail) setQuery(selectedTrail.name)
  }, [selectedTrail?.id])

  const filtered = query.trim()
    ? trails.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : trails

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (trail: Trail) => {
    onSelectTrail(trail)
    setQuery(trail.name)
    setOpen(false)
  }

  const handleClear = () => {
    onSelectTrail(null)
    setQuery('')
  }

  const inputCls =
    'w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 focus:outline-none focus:border-orange-400'

  return (
    <div className="flex flex-col gap-3">
      <div ref={containerRef} className="relative">
        <div className="flex gap-1">
          <input
            type="text"
            placeholder="Search trails…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            className={inputCls}
          />
          {selectedTrail && (
            <button
              type="button"
              onClick={handleClear}
              className="px-2 rounded border border-zinc-200 text-zinc-400 text-xs hover:border-red-300 hover:text-red-500 transition-colors"
              title="Clear selection"
            >
              ✕
            </button>
          )}
        </div>
        {open && filtered.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-md">
            {filtered.map((trail) => (
              <li key={trail.id}>
                <button
                  type="button"
                  onMouseDown={() => handleSelect(trail)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 flex items-center justify-between gap-2 ${
                    selectedTrail?.id === trail.id ? 'bg-orange-50 text-orange-700' : 'text-zinc-800'
                  }`}
                >
                  <span className="truncate">{trail.name}</span>
                  <span className="text-xs text-zinc-400 shrink-0">{trail.distanceKm.toFixed(1)} km</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && query.trim() !== '' && filtered.length === 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-md px-3 py-2 text-xs text-zinc-400">
            No trails match &ldquo;{query}&rdquo;
          </div>
        )}
      </div>
      {!selectedTrail && (
        <p className="text-xs text-zinc-500">Search above or click a trail on the map.</p>
      )}
      <EditTrailForm
        selectedTrail={selectedTrail}
        onSave={onUpdateTrail}
        onDelete={onDeleteTrail}
        onCancel={handleClear}
        disabled={!selectedTrail}
      />
      {selectedTrail && onEnterRefineMode && (
        <button
          type="button"
          onClick={onEnterRefineMode}
          className="w-full py-2 rounded-md border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          Refine Line
        </button>
      )}
    </div>
  )
}

function EditTrailForm({
  selectedTrail,
  onSave,
  onDelete,
  onCancel,
  disabled,
}: {
  selectedTrail: Trail | null
  onSave: (form: TrimFormState) => Promise<string | null>
  onDelete: () => Promise<string | null>
  onCancel: () => void
  disabled: boolean
}) {
  const [form, setForm] = useState<TrimFormState>({
    name: '',
    difficulty: 'not_set',
    direction: 'not_set',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedTrail) return
    setForm({
      name: selectedTrail.name,
      difficulty: selectedTrail.difficulty,
      direction: selectedTrail.direction,
      notes: selectedTrail.notes ?? '',
    })
    setSaveError(null)
    setConfirmDelete(false)
  }, [selectedTrail])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled || !selectedTrail || !form.name.trim()) return
    setSaving(true)
    setSaveError(null)
    const err = await onSave(form)
    if (err) setSaveError(err)
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    setSaveError(null)
    const err = await onDelete()
    if (err) { setSaveError(err); setDeleting(false); setConfirmDelete(false) }
  }

  const field = (label: string, children: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500">{label}</label>
      {children}
    </div>
  )

  const inputCls =
    'w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 focus:outline-none focus:border-orange-400 disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-3${disabled ? ' opacity-50' : ''}`}>
      {/* Read-only stats */}
      <div className="flex gap-3 text-xs text-zinc-500">
        {selectedTrail ? (
          <>
            <span>{selectedTrail.distanceKm.toFixed(2)} km</span>
            <span>~{Math.round(selectedTrail.elevationGainFt)} ft gain</span>
          </>
        ) : (
          <span>— km &nbsp; — ft gain</span>
        )}
      </div>

      {field(
        'Name *',
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className={inputCls}
          disabled={disabled}
          required
        />
      )}

      {field(
        'Difficulty',
        <select
          value={form.difficulty}
          onChange={(e) =>
            setForm((p) => ({ ...p, difficulty: e.target.value as TrimFormState['difficulty'] }))
          }
          className={inputCls}
          disabled={disabled}
        >
          <option value="not_set">Not set</option>
          <option value="easy">Easy</option>
          <option value="intermediate">Intermediate</option>
          <option value="hard">Hard</option>
        </select>
      )}

      {field(
        'Direction',
        <select
          value={form.direction}
          onChange={(e) =>
            setForm((p) => ({ ...p, direction: e.target.value as TrimFormState['direction'] }))
          }
          className={inputCls}
          disabled={disabled}
        >
          <option value="not_set">Not set</option>
          <option value="one-way">One-way</option>
          <option value="out-and-back">Out and back</option>
          <option value="loop">Loop</option>
        </select>
      )}

      {field(
        'Notes',
        <textarea
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          rows={2}
          className={inputCls + ' resize-none'}
          placeholder="Optional"
          disabled={disabled}
        />
      )}

      {saveError && <p className="text-xs text-red-500">{saveError}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={disabled || saving || deleting || !form.name.trim()}
          className="flex-1 py-2 rounded-md bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="px-3 py-2 rounded-md border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
      </div>

      <button
        type="button"
        onClick={handleDelete}
        disabled={disabled || saving || deleting}
        className={`w-full py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          confirmDelete
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'border border-red-200 text-red-500 hover:bg-red-50'
        }`}
      >
        {deleting ? 'Deleting...' : confirmDelete ? 'Confirm Delete' : 'Delete Trail'}
      </button>
      {confirmDelete && !deleting && (
        <button
          type="button"
          onClick={() => setConfirmDelete(false)}
          className="text-xs text-zinc-400 hover:text-zinc-600 text-center -mt-2"
        >
          Cancel delete
        </button>
      )}
    </form>
  )
}
