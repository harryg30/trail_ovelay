'use client'

import { useRef, useState, useEffect } from 'react'
import type { Ride, Trail, TrimPoint, TrimSegment, TrimFormState, EditMode, Network } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'
import AuthButton from '@/components/AuthButton'
import { AddTrailContent } from '@/components/trail/AddTrailContent'
import { EditTrailContent } from '@/components/trail/EditTrailContent'
import { NetworkRow } from '@/components/network/NetworkRow'
import { DrawNetworkContent } from '@/components/network/DrawNetworkContent'
import { EditNetworkContent } from '@/components/network/EditNetworkContent'

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
  averagedTrimPolyline: [number, number][] | null
  averagedRideCount: number
  onClearAveragedTrim: () => void
  corridorRadiusKm: number
  onCorridorRadiusChange: (v: number) => void
  outputSpacingKm: number
  onOutputSpacingChange: (v: number) => void
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
  highResRideIds: Set<string>
  onFetchHighRes: (id: string) => Promise<void>
  fetchingHighResId: string | null
  corridorRidesAvailable: number
  onFetchHighResForCorridor: () => Promise<void>
  fetchingHighResForCorridor: boolean
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
  averagedTrimPolyline,
  averagedRideCount,
  onClearAveragedTrim,
  corridorRadiusKm,
  onCorridorRadiusChange,
  outputSpacingKm,
  onOutputSpacingChange,
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
  highResRideIds,
  onFetchHighRes,
  fetchingHighResId,
  corridorRidesAvailable,
  onFetchHighResForCorridor,
  fetchingHighResForCorridor,
}: LeftDrawerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pendingHighResRideId, setPendingHighResRideId] = useState<string | null>(null)
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
                    const isHighRes = highResRideIds.has(ride.id)
                    const isFetching = fetchingHighResId === ride.id
                    const isPending = pendingHighResRideId === ride.id
                    return (
                      <li key={ride.id} className="flex flex-col rounded-md bg-zinc-50">
                        <div className={`flex items-center justify-between py-2 px-3 text-sm ${hidden ? 'opacity-50' : ''}`}>
                          <span className="text-zinc-800 truncate pr-2">{ride.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-zinc-400 text-xs">
                              {(ride.distance / 1000).toFixed(1)} km
                            </span>
                            {ride.stravaActivityId && (
                              <button
                                type="button"
                                onClick={() => isHighRes ? undefined : setPendingHighResRideId(isPending ? null : ride.id)}
                                disabled={isFetching || isHighRes}
                                title={isHighRes ? 'High-res loaded' : 'Download high-res polyline from Strava'}
                                className="text-zinc-400 hover:text-blue-500 transition-colors disabled:opacity-40 disabled:cursor-default"
                              >
                                {isFetching ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.364-6.364l-2.121 2.121M8.757 15.243l-2.121 2.121M18.364 18.364l-2.121-2.121M8.757 8.757L6.636 6.636" />
                                  </svg>
                                ) : isHighRes ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                                    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                                  </svg>
                                )}
                              </button>
                            )}
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
                        </div>
                        {isPending && (
                          <div className="px-3 pb-2 flex flex-col gap-1.5">
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                              Uses 1 Strava API call (limit 200/day). High-res data is only stored in memory for this session.
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => { setPendingHighResRideId(null); onFetchHighRes(ride.id) }}
                                className="flex-1 py-1 rounded bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition-colors"
                              >
                                Fetch
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingHighResRideId(null)}
                                className="px-3 py-1 rounded border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
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
            averagedTrimPolyline={averagedTrimPolyline}
            averagedRideCount={averagedRideCount}
            onClearAveragedTrim={onClearAveragedTrim}
            corridorRadiusKm={corridorRadiusKm}
            onCorridorRadiusChange={onCorridorRadiusChange}
            outputSpacingKm={outputSpacingKm}
            onOutputSpacingChange={onOutputSpacingChange}
            corridorRidesAvailable={corridorRidesAvailable}
            onFetchHighResForCorridor={onFetchHighResForCorridor}
            fetchingHighResForCorridor={fetchingHighResForCorridor}
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
