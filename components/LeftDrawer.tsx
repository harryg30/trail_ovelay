'use client'

import { Fragment, useMemo, useRef, useState } from 'react'
import type { Ride, Trail, DraftTrail, TrimPoint, TrimSegment, TrimFormState, EditMode, Network, RidePhoto, TrailPhoto } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'
import type { MapBounds } from '@/lib/geo-utils'
import { polylineInBounds, pointInBounds, trailPhotoMapPoint } from '@/lib/geo-utils'
import AuthButton from '@/components/AuthButton'
import { AddTrailContent } from '@/components/trail/AddTrailContent'
import { TrailEditDrawer } from '@/components/trail/TrailEditDrawer'
import { NetworkRow } from '@/components/network/NetworkRow'
import { DrawNetworkContent } from '@/components/network/DrawNetworkContent'
import { EditNetworkContent } from '@/components/network/EditNetworkContent'
import { DraftsList } from '@/components/trail/DraftsList'
import { AddTrailPhotoContent } from '@/components/photo/AddTrailPhotoContent'
import type { TrailEditTool } from '@/lib/modes/types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCamera,
  faCheck,
  faChevronDown,
  faChevronRight,
  faDownload,
  faEye,
  faEyeSlash,
  faFolder,
  faPenToSquare,
  faPlus,
  faSpinner,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'

interface LeftDrawerProps {
  user: SessionUser | null
  rides: Ride[]
  trails: Trail[]
  hiddenRideIds: Set<string>
  onToggleRide: (id: string) => void
  onHideAllRides: () => void
  onRidesUploaded: (rides: Ride[]) => void
  onSyncComplete: () => Promise<void>
  editMode: EditMode
  onEditModeChange: (mode: EditMode) => void
  trimStart: TrimPoint | null
  trimSegment: TrimSegment | null
  onSaveTrail: (form: TrimFormState, publishOnSave: boolean) => Promise<string | null>
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
  onSaveEditedTrail: (form: TrimFormState) => Promise<string | null>
  onDeleteTrail: () => Promise<string | null>
  refineError: string | null
  refinedPolyline: [number, number][] | null
  trailEditTool: TrailEditTool
  onSetTrailEditTool: (t: TrailEditTool) => void
  canUndoDraw: boolean
  canRedoDraw: boolean
  onDrawUndo: () => void
  onDrawRedo: () => void
  onDrawClear: () => void
  canUndoRefine: boolean
  canRedoRefine: boolean
  onRefineUndo: () => void
  onRefineRedo: () => void
  onRefineClear: () => void
  networks: Network[]
  selectedNetwork: Network | null
  drawNetworkPoints: [number, number][]
  hiddenNetworkIds: Set<string>
  onToggleNetwork: (id: string) => void
  onSelectNetwork: (network: Network | null) => void
  onSaveNetwork: (name: string, polygon: [number, number][], trailIds: string[]) => Promise<string | null>
  onUpdateNetwork: (name: string, polygon: [number, number][] | null, trailIds: string[]) => Promise<string | null>
  onDeleteNetwork: () => Promise<string | null>
  onStartRedrawNetwork: () => void
  onOpenAnnouncement: () => void
  highResRideIds: Set<string>
  onFetchHighRes: (id: string) => Promise<void>
  fetchingHighResId: string | null
  hasUnfetchedStravaRides: boolean
  onAverageLine: () => void
  onFetchHighResForCorridor: () => Promise<void>
  fetchingHighResForCorridor: boolean
  ridePhotos: Record<string, RidePhoto[]>
  photosVisibleRideIds: Set<string>
  fetchingPhotosId: string | null
  onFetchAndTogglePhotos: (rideId: string) => Promise<void>
  draftTrails: DraftTrail[]
  onPublishDraft: (localId: string) => Promise<string | null>
  onDeleteDraft: (localId: string) => void
  drawTrailPoints: [number, number][]
  onSaveDrawnTrail: (form: TrimFormState, publishOnSave: boolean) => Promise<string | null>
  mapBounds: MapBounds | null
  showOnMapOnly: boolean
  onToggleShowOnMapOnly: () => void
  onTrailPhotoCreated: (photo: TrailPhoto) => void
  onEnterAddTrailPhoto: () => void
  /** Public pinned photos (for trail rows + reference). */
  communityTrailPhotos: TrailPhoto[]
  /** Current user’s unpinned + local demo photos. */
  unpinnedTrailPhotos: TrailPhoto[]
  placingPhoto: RidePhoto | null
  placingTrailPhoto: TrailPhoto | null
  onPlaceRidePhoto: (photo: RidePhoto) => void
  onPlaceTrailPhoto: (photo: TrailPhoto) => void
  onCancelPinOnMap: () => void
}

export default function LeftDrawer({
  user,
  rides,
  trails,
  hiddenRideIds,
  onToggleRide,
  onHideAllRides,
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
  onSaveEditedTrail,
  onDeleteTrail,
  refineError,
  refinedPolyline,
  trailEditTool,
  onSetTrailEditTool,
  canUndoDraw,
  canRedoDraw,
  onDrawUndo,
  onDrawRedo,
  onDrawClear,
  canUndoRefine,
  canRedoRefine,
  onRefineUndo,
  onRefineRedo,
  onRefineClear,
  networks,
  selectedNetwork,
  drawNetworkPoints,
  hiddenNetworkIds,
  onToggleNetwork,
  onSelectNetwork,
  onSaveNetwork,
  onUpdateNetwork,
  onDeleteNetwork,
  onStartRedrawNetwork,
  onOpenAnnouncement,
  highResRideIds,
  onFetchHighRes,
  fetchingHighResId,
  hasUnfetchedStravaRides,
  onAverageLine,
  onFetchHighResForCorridor,
  fetchingHighResForCorridor,
  ridePhotos,
  photosVisibleRideIds,
  fetchingPhotosId,
  onFetchAndTogglePhotos,
  draftTrails,
  onPublishDraft,
  onDeleteDraft,
  drawTrailPoints,
  onSaveDrawnTrail,
  mapBounds,
  showOnMapOnly,
  onToggleShowOnMapOnly,
  onTrailPhotoCreated,
  onEnterAddTrailPhoto,
  communityTrailPhotos,
  unpinnedTrailPhotos,
  placingPhoto,
  placingTrailPhoto,
  onPlaceRidePhoto,
  onPlaceTrailPhoto,
  onCancelPinOnMap,
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
  const [trailsQuery, setTrailsQuery] = useState('')
  const [trailsPageSize, setTrailsPageSize] = useState(() => {
    if (typeof window === 'undefined') return 10
    const saved = localStorage.getItem('trailsPageSize')
    return saved ? Number(saved) : 10
  })
  const [trailsPage, setTrailsPage] = useState(0)
  /** Ride photo chosen in drawer — prompt View vs Pin to map */
  const [ridePhotoForAction, setRidePhotoForAction] = useState<RidePhoto | null>(null)
  const [ridePhotoLightboxSrc, setRidePhotoLightboxSrc] = useState<string | null>(null)

  const ridePhotoNeedsMapPin = (p: RidePhoto) => !p.accepted && p.lat == null
  const trailPhotoNeedsMapPin = (p: TrailPhoto) => !p.accepted

  const [trailPhotoForAction, setTrailPhotoForAction] = useState<TrailPhoto | null>(null)
  const [expandedTrailPhotoTrails, setExpandedTrailPhotoTrails] = useState<Set<string>>(() => new Set())

  const visibleUnpinnedForPin = useMemo(() => {
    const pending = unpinnedTrailPhotos.filter((p) => trailPhotoNeedsMapPin(p))
    const activeBounds = showOnMapOnly && mapBounds ? mapBounds : null
    if (!activeBounds) return pending
    return pending.filter((p) => {
      const pt = trailPhotoMapPoint(p)
      return pt != null && pointInBounds(pt, activeBounds)
    })
  }, [unpinnedTrailPhotos, showOnMapOnly, mapBounds])
  const [trailPhotoLightboxSrc, setTrailPhotoLightboxSrc] = useState<string | null>(null)

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

  const focusedTrailSession =
    editMode === 'draw-trail' || (editMode === 'edit-trail' && !!selectedTrail)
  const showTrailFolderList =
    editMode !== 'draw-trail' && !(editMode === 'edit-trail' && selectedTrail)

  return (
    <div className="w-full max-w-[392px] sm:w-[392px] h-screen bg-white border-r border-zinc-200 shadow-lg flex flex-col overflow-y-auto shrink-0">
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

      {/* Viewport filter toggle */}
      <div className="px-4 py-2 border-b border-zinc-100 flex items-center gap-1">
        <button
          type="button"
          onClick={() => showOnMapOnly && onToggleShowOnMapOnly()}
          className={`flex-1 py-1.5 rounded-l-md text-xs font-medium border transition-colors ${
            !showOnMapOnly
              ? 'bg-zinc-800 text-white border-zinc-800'
              : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50'
          }`}
        >
          All data
        </button>
        <button
          type="button"
          onClick={() => !showOnMapOnly && onToggleShowOnMapOnly()}
          disabled={!mapBounds}
          className={`flex-1 py-1.5 rounded-r-md text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            showOnMapOnly
              ? 'bg-zinc-800 text-white border-zinc-800'
              : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50'
          }`}
        >
          On map
        </button>
      </div>

      {/* Trails list */}
      <div className="px-4 py-4 border-b border-zinc-100 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            Trails ({trails.length})
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleModeClick('draw-trail')}
              title={editMode === 'draw-trail' ? 'Cancel draw' : 'Draw a trail'}
              className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                editMode === 'draw-trail'
                  ? 'bg-orange-500 text-white'
                  : 'border border-zinc-200 text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              {editMode === 'draw-trail' ? (
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              ) : (
                <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleModeClick('add-trail')}
              title={editMode === 'add-trail' ? 'Cancel' : 'Trim trail from ride'}
              className={`w-6 h-6 flex items-center justify-center rounded text-base font-light transition-colors ${
                editMode === 'add-trail'
                  ? 'bg-orange-500 text-white'
                  : 'border border-zinc-200 text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              {editMode === 'add-trail' ? (
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              ) : (
                <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                if (editMode === 'add-trail-photo') onEditModeChange(null)
                else onEnterAddTrailPhoto()
              }}
              title={editMode === 'add-trail-photo' ? 'Cancel' : 'Add a trail photo'}
              className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                editMode === 'add-trail-photo'
                  ? 'bg-emerald-600 text-white'
                  : 'border border-zinc-200 text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              {editMode === 'add-trail-photo' ? (
                <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
              ) : (
                <FontAwesomeIcon icon={faCamera} className="w-4 h-4" />
              )}
            </button>
            {user && (
              <button
                type="button"
                onClick={() => handleModeClick('edit-trail')}
                title={editMode === 'edit-trail' ? 'Cancel edit' : 'Edit a trail'}
                className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                  editMode === 'edit-trail'
                    ? 'bg-orange-500 text-white'
                    : 'border border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                {editMode === 'edit-trail' ? (
                  <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
                ) : (
                  <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {editMode === 'draw-trail' && (
          <div className="flex flex-col gap-2">
            {refineError && <p className="text-xs text-red-500">{refineError}</p>}
            <TrailEditDrawer
              variant="draw"
              trailEditTool={trailEditTool}
              onSetTool={onSetTrailEditTool}
              canUndo={canUndoDraw}
              canRedo={canRedoDraw}
              onUndo={onDrawUndo}
              onRedo={onDrawRedo}
              onClear={onDrawClear}
              points={drawTrailPoints}
              selectedTrail={null}
              refinedPolyline={null}
              onSaveDraw={onSaveDrawnTrail}
              onSaveEdit={onSaveEditedTrail}
              onCancel={() => onEditModeChange(null)}
              networks={networks}
              canPublish={!!user}
            />
          </div>
        )}

        {editMode === 'edit-trail' && selectedTrail && (
          <div className="flex flex-col gap-2">
            {refineError && <p className="text-xs text-red-500">{refineError}</p>}
            <TrailEditDrawer
              variant="edit"
              trailEditTool={trailEditTool}
              onSetTool={onSetTrailEditTool}
              canUndo={canUndoRefine}
              canRedo={canRedoRefine}
              onUndo={onRefineUndo}
              onRedo={onRefineRedo}
              onClear={onRefineClear}
              points={selectedTrail.polyline}
              selectedTrail={selectedTrail}
              refinedPolyline={refinedPolyline}
              onSaveDraw={onSaveDrawnTrail}
              onSaveEdit={onSaveEditedTrail}
              onCancel={() => {
                onSelectTrail(null)
                onEditModeChange(null)
              }}
              onDeleteTrail={onDeleteTrail}
              networks={networks}
            />
          </div>
        )}

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
            hasUnfetchedStravaRides={hasUnfetchedStravaRides}
            onAverageLine={onAverageLine}
            onFetchHighResForCorridor={onFetchHighResForCorridor}
            fetchingHighResForCorridor={fetchingHighResForCorridor}
            networks={networks}
            canPublish={!!user}
          />
        )}

        {editMode === 'add-trail-photo' && (
          <AddTrailPhotoContent
            user={user}
            onCreated={(photo) => {
              onTrailPhotoCreated(photo)
              onEditModeChange(null)
            }}
            onCancel={() => onEditModeChange(null)}
          />
        )}

        {visibleUnpinnedForPin.length > 0 && (
          <div className="flex flex-col gap-2 px-4 py-3 border-t border-zinc-100">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
              {user ? 'My trail photos — pin on map' : 'Demo trail photos — pin on map'}
            </p>
            <p className="text-xs text-zinc-500">
              Tap a thumbnail, then tap a trail on the map. Demo photos are not saved for others.
            </p>
            <div className="flex flex-wrap gap-2">
              {visibleUnpinnedForPin.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setTrailPhotoForAction(photo)}
                    title="View or pin to trail"
                    className={`relative w-14 h-14 rounded-md overflow-hidden border-2 shrink-0 transition-all ${
                      placingTrailPhoto?.id === photo.id
                        ? 'border-emerald-500 ring-2 ring-emerald-200'
                        : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    <img
                      src={photo.thumbnailUrl || photo.blobUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-emerald-600/95 text-white text-[9px] font-medium text-center py-0.5 leading-none">
                      Pin
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {editMode === 'edit-trail' && !selectedTrail && (
          <p className="text-xs text-zinc-500">Select a trail from the list to edit its line and details.</p>
        )}

        {showTrailFolderList && (() => {
          const activeBounds = showOnMapOnly && mapBounds ? mapBounds : null
          const visibleTrails = activeBounds
            ? trails.filter(t => polylineInBounds(t.polyline, activeBounds))
            : trails
          const searchFiltered = trailsQuery.trim()
            ? visibleTrails.filter(t => t.name.toLowerCase().includes(trailsQuery.toLowerCase()))
            : visibleTrails

          type TrailRow =
            | { kind: 'header'; networkId: string; name: string; count: number }
            | { kind: 'trail'; trail: Trail; networkId: string | null }

          const rows: TrailRow[] = []
          const sortedNetworks = [...networks].sort((a, b) => a.name.localeCompare(b.name))
          for (const network of sortedNetworks) {
            const networkTrails = searchFiltered.filter(t => network.trailIds.includes(t.id))
            if (networkTrails.length > 0) {
              rows.push({ kind: 'header', networkId: network.id, name: network.name, count: networkTrails.length })
              for (const t of networkTrails) rows.push({ kind: 'trail', trail: t, networkId: network.id })
            }
          }
          const networkTrailIds = new Set(networks.flatMap(n => n.trailIds))
          const unassigned = searchFiltered.filter(t => !networkTrailIds.has(t.id))
          if (unassigned.length > 0) {
            rows.push({ kind: 'header', networkId: '__unassigned__', name: 'Unassigned', count: unassigned.length })
            for (const t of unassigned) rows.push({ kind: 'trail', trail: t, networkId: null })
          }

          if (rows.length === 0) {
            return <p className="text-xs text-zinc-400">{trails.length === 0 ? 'No trails saved yet.' : 'No trails match.'}</p>
          }

          const totalPages = Math.max(1, Math.ceil(rows.length / trailsPageSize))
          const safePage = Math.min(trailsPage, totalPages - 1)
          const pagedRows = rows.slice(safePage * trailsPageSize, (safePage + 1) * trailsPageSize)

          return (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={trailsQuery}
                  onChange={(e) => { setTrailsQuery(e.target.value); setTrailsPage(0) }}
                  placeholder="Search trails…"
                  className="flex-1 min-w-0 border border-zinc-200 rounded-md px-3 py-1.5 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300"
                />
                <select
                  value={trailsPageSize}
                  onChange={(e) => { const v = Number(e.target.value); setTrailsPageSize(v); localStorage.setItem('trailsPageSize', String(v)); setTrailsPage(0) }}
                  className="text-xs border border-zinc-200 rounded px-1 py-0.5 text-zinc-600 bg-white shrink-0"
                >
                  <option value={5}>5 / pg</option>
                  <option value={10}>10 / pg</option>
                  <option value={25}>25 / pg</option>
                </select>
              </div>
              <ul className="flex flex-col gap-0.5">
                {pagedRows.map((row, i) => {
                  if (row.kind === 'header') {
                    return (
                      <li key={`h-${row.networkId}-${i}`} className="flex items-center gap-1.5 px-1 pt-2 pb-0.5">
                        <FontAwesomeIcon icon={faFolder} className="w-3 h-3 text-zinc-400 shrink-0" />
                        <span className="text-xs font-semibold text-zinc-500 truncate">{row.name}</span>
                        <span className="ml-auto text-xs text-zinc-400 shrink-0">{row.count}</span>
                      </li>
                    )
                  }
                  const { trail } = row
                  const trailPub = communityTrailPhotos.filter(
                    (p) => p.trailId === trail.id && p.accepted
                  )
                  const visibleTrailPub = activeBounds
                    ? trailPub.filter((p) => {
                        const pt = trailPhotoMapPoint(p)
                        return pt != null && pointInBounds(pt, activeBounds)
                      })
                    : trailPub
                  const expanded = expandedTrailPhotoTrails.has(trail.id)
                  const hasPhotos = trailPub.length > 0
                  return (
                    <Fragment key={`t-wrap-${trail.id}-${row.networkId ?? 'u'}-${i}`}>
                      <li
                        className={`flex items-center gap-2 py-2 px-2 ml-3 rounded-md bg-zinc-50 text-sm ${
                          selectedTrail?.id === trail.id && editMode === 'edit-trail' ? 'ring-1 ring-orange-400' : ''
                        }`}
                      >
                        {hasPhotos ? (
                          <button
                            type="button"
                            className="text-zinc-400 hover:text-zinc-600 p-0.5 shrink-0"
                            aria-expanded={expanded}
                            title={expanded ? 'Hide photos' : 'Show photos on this trail'}
                            onClick={() => {
                              setExpandedTrailPhotoTrails((prev) => {
                                const n = new Set(prev)
                                if (n.has(trail.id)) n.delete(trail.id)
                                else n.add(trail.id)
                                return n
                              })
                            }}
                          >
                            <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="w-4 shrink-0" aria-hidden />
                        )}
                        <span className="text-zinc-800 truncate flex-1 min-w-0">{trail.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-zinc-400 text-xs">{trail.distanceKm.toFixed(1)} km</span>
                          {trail.difficulty !== 'not_set' && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              trail.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                              trail.difficulty === 'intermediate' ? 'bg-blue-100 text-blue-700' :
                              trail.difficulty === 'hard' ? 'bg-zinc-800 text-white' :
                              'bg-black text-white'
                            }`}>
                              {trail.difficulty === 'easy' ? '● Green' :
                               trail.difficulty === 'intermediate' ? '■ Blue' :
                               trail.difficulty === 'hard' ? '◆ Black' :
                               '◆◆ Dbl'}
                            </span>
                          )}
                          {user && (
                            <button
                              type="button"
                              onClick={() => { onSelectTrail(trail); onEditModeChange('edit-trail') }}
                              title="Edit trail"
                              className="text-zinc-400 hover:text-zinc-700 transition-colors"
                            >
                              <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </li>
                      {expanded && hasPhotos && (
                        <li className="ml-6 mr-1 mb-1">
                          <div className="rounded-md border border-zinc-100 bg-white px-2 py-2">
                            {visibleTrailPub.length === 0 ? (
                              <p className="text-xs text-zinc-400">No photos in current map view.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {visibleTrailPub.map((photo) => (
                                  <button
                                    key={photo.id}
                                    type="button"
                                    className="w-12 h-12 rounded overflow-hidden border border-zinc-200 shrink-0"
                                    onClick={() => setTrailPhotoForAction(photo)}
                                    title="View photo"
                                  >
                                    <img
                                      src={photo.thumbnailUrl || photo.blobUrl}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </li>
                      )}
                    </Fragment>
                  )
                })}
              </ul>
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setTrailsPage(p => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="text-xs px-2 py-1 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <span className="text-xs text-zinc-400">Page {safePage + 1} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setTrailsPage(p => Math.min(totalPages - 1, p + 1))}
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

      {/* Drafts section */}
      {!focusedTrailSession && draftTrails.length > 0 && (
        <div className="px-4 py-4 border-t border-zinc-100 flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            Drafts ({draftTrails.length})
          </h2>
          <DraftsList
            drafts={draftTrails}
            canPublish={!!user}
            onPublish={onPublishDraft}
            onDelete={onDeleteDraft}
          />
        </div>
      )}

      {/* Networks section */}
      {!focusedTrailSession && (
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

        {(() => {
          const activeBounds = showOnMapOnly && mapBounds ? mapBounds : null
          const visibleNetworks = activeBounds
            ? networks.filter(n =>
                polylineInBounds(n.polygon, activeBounds) ||
                trails.some(t => n.trailIds.includes(t.id) && polylineInBounds(t.polyline, activeBounds))
              )
            : networks
          if (visibleNetworks.length === 0) return <p className="text-xs text-zinc-400">{networks.length === 0 ? 'No networks yet.' : 'No networks in view.'}</p>
          return (
            <ul className="flex flex-col gap-1">
              {visibleNetworks.map((network) => (
                <NetworkRow
                  key={network.id}
                  network={network}
                  trails={trails}
                  isSelected={selectedNetwork?.id === network.id && editMode === 'edit-network'}
                  isHidden={hiddenNetworkIds.has(network.id)}
                  onToggleVisibility={() => onToggleNetwork(network.id)}
                  onEdit={() => {
                    onSelectNetwork(network)
                    onEditModeChange('edit-network')
                  }}
                  user={user}
                />
              ))}
            </ul>
          )
        })()}
      </div>
      )}

      {/* Rides list */}
      {!focusedTrailSession && (
      <div className="px-4 py-4 border-t border-zinc-100 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            Rides ({rides.length})
          </h2>
          <div className="flex items-center gap-2">
            {rides.some(r => !hiddenRideIds.has(r.id)) && (
              <button
                type="button"
                onClick={onHideAllRides}
                className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                title="Hide all rides"
              >
                Hide all
              </button>
            )}
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
        {(placingPhoto || placingTrailPhoto) && (
          <div className="mx-4 mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex items-center justify-between gap-2">
            <p className="text-xs text-amber-900">
              {placingTrailPhoto && !placingPhoto
                ? 'Tap the map on or near a trail line to pin this trail photo.'
                : 'Tap the map on or near a trail line to pin this photo.'}
            </p>
            <button
              type="button"
              onClick={onCancelPinOnMap}
              className="text-xs font-medium text-amber-900 hover:text-amber-950 shrink-0"
            >
              Cancel
            </button>
          </div>
        )}
        {rides.length === 0 ? (
          <p className="text-xs text-zinc-400">No rides uploaded yet.</p>
        ) : (() => {
          const activeBounds = showOnMapOnly && mapBounds ? mapBounds : null
          const filteredRides = (ridesQuery.trim()
            ? rides.filter(r => r.name.toLowerCase().includes(ridesQuery.toLowerCase()))
            : rides
          ).filter(r => !activeBounds || polylineInBounds(r.polyline, activeBounds))
           .slice().sort((a, b) => {
            const aVisible = !hiddenRideIds.has(a.id)
            const bVisible = !hiddenRideIds.has(b.id)
            return aVisible === bVisible ? 0 : aVisible ? -1 : 1
          })
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
                    const isFetchingPhotos = fetchingPhotosId === ride.id
                    const photos = ridePhotos[ride.id]
                    const photosLoaded = photos !== undefined
                    const photosVisible = photosVisibleRideIds.has(ride.id)
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
                                  <FontAwesomeIcon icon={faSpinner} spin className="w-4 h-4" />
                                ) : isHighRes ? (
                                  <FontAwesomeIcon icon={faCheck} className="w-4 h-4 text-blue-500" />
                                ) : (
                                  <FontAwesomeIcon icon={faDownload} className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            {ride.stravaActivityId && (
                              <button
                                type="button"
                                onClick={() => onFetchAndTogglePhotos(ride.id)}
                                disabled={isFetchingPhotos}
                                title={photosVisible ? 'Hide photos' : photosLoaded ? 'Show photos' : 'Fetch photos from Strava'}
                                className="relative text-zinc-400 hover:text-amber-500 transition-colors disabled:opacity-40 disabled:cursor-default"
                              >
                                {isFetchingPhotos ? (
                                  <FontAwesomeIcon icon={faSpinner} spin className="w-4 h-4" />
                                ) : (
                                  <FontAwesomeIcon icon={faCamera} className={`w-4 h-4 ${photosVisible ? 'text-amber-500' : ''}`} />
                                )}
                                {photosLoaded && photos.length > 0 && (
                                  <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[9px] leading-none rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                                    {photos.length > 9 ? '9+' : photos.length}
                                  </span>
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onToggleRide(ride.id)}
                              title={hidden ? 'Show on map' : 'Hide from map'}
                              className="text-zinc-400 hover:text-zinc-700 transition-colors"
                            >
                              <FontAwesomeIcon icon={hidden ? faEyeSlash : faEye} className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {photosVisible && photosLoaded && photos.length > 0 && (
                          <div className="px-3 pb-2 pt-1 border-t border-zinc-200/80">
                            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
                              Photos
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {photos.map((photo) => (
                                <button
                                  key={photo.id}
                                  type="button"
                                  onClick={() => setRidePhotoForAction(photo)}
                                  title={
                                    ridePhotoNeedsMapPin(photo)
                                      ? 'View or pin to trail'
                                      : 'View photo'
                                  }
                                  className={`relative w-14 h-14 rounded-md overflow-hidden border-2 shrink-0 transition-all ${
                                    placingPhoto?.id === photo.id
                                      ? 'border-amber-500 ring-2 ring-amber-200'
                                      : 'border-zinc-200 hover:border-zinc-400'
                                  }`}
                                >
                                  <img
                                    src={photo.thumbnailUrl || photo.blobUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                  {ridePhotoNeedsMapPin(photo) && (
                                    <span className="absolute bottom-0 inset-x-0 bg-amber-600/95 text-white text-[9px] font-medium text-center py-0.5 leading-none">
                                      Pin
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
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
      )}

      {ridePhotoForAction && (
        <div
          className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/40"
          role="presentation"
          onClick={() => setRidePhotoForAction(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ride-photo-action-title"
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-3">
              <img
                src={ridePhotoForAction.thumbnailUrl || ridePhotoForAction.blobUrl}
                alt=""
                className="w-20 h-20 rounded-md object-cover shrink-0 border border-zinc-100"
              />
              <div className="min-w-0">
                <p id="ride-photo-action-title" className="text-sm font-medium text-zinc-800">
                  Ride photo
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  View full size, or pin to a trail on the map.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setRidePhotoLightboxSrc(ridePhotoForAction.blobUrl)
                  setRidePhotoForAction(null)
                }}
                className="w-full py-2 px-3 rounded-md bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-900 transition-colors"
              >
                View
              </button>
              {ridePhotoNeedsMapPin(ridePhotoForAction) && (
                <button
                  type="button"
                  onClick={() => {
                    onPlaceRidePhoto(ridePhotoForAction)
                    setRidePhotoForAction(null)
                  }}
                  className="w-full py-2 px-3 rounded-md bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
                >
                  Pin to map…
                </button>
              )}
              <button
                type="button"
                onClick={() => setRidePhotoForAction(null)}
                className="w-full py-2 px-3 rounded-md border border-zinc-200 text-zinc-700 text-sm hover:bg-zinc-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {ridePhotoLightboxSrc && (
        <div
          className="fixed inset-0 z-[5001] bg-black/92 flex flex-col"
          role="presentation"
          onClick={() => setRidePhotoLightboxSrc(null)}
        >
          <div className="flex justify-end p-3">
            <button
              type="button"
              onClick={() => setRidePhotoLightboxSrc(null)}
              className="text-white text-sm font-medium px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors"
              aria-label="Close full image"
            >
              Close
            </button>
          </div>
          <div
            className="flex-1 flex items-center justify-center p-4 overflow-auto min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={ridePhotoLightboxSrc}
              alt=""
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}

      {trailPhotoForAction && (
        <div
          className="fixed inset-0 z-[5002] flex items-center justify-center p-4 bg-black/40"
          role="presentation"
          onClick={() => setTrailPhotoForAction(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="trail-photo-action-title"
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-3">
              <img
                src={trailPhotoForAction.thumbnailUrl || trailPhotoForAction.blobUrl}
                alt=""
                className="w-20 h-20 rounded-md object-cover shrink-0 border border-zinc-100"
              />
              <div className="min-w-0">
                <p id="trail-photo-action-title" className="text-sm font-medium text-zinc-800">
                  Trail photo
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  View full size, or pin to a trail on the map.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setTrailPhotoLightboxSrc(trailPhotoForAction.blobUrl)
                  setTrailPhotoForAction(null)
                }}
                className="w-full py-2 px-3 rounded-md bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-900 transition-colors"
              >
                View
              </button>
              {trailPhotoNeedsMapPin(trailPhotoForAction) && (
                <button
                  type="button"
                  onClick={() => {
                    onPlaceTrailPhoto(trailPhotoForAction)
                    setTrailPhotoForAction(null)
                  }}
                  className="w-full py-2 px-3 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  Pin to map…
                </button>
              )}
              <button
                type="button"
                onClick={() => setTrailPhotoForAction(null)}
                className="w-full py-2 px-3 rounded-md border border-zinc-200 text-zinc-700 text-sm hover:bg-zinc-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {trailPhotoLightboxSrc && (
        <div
          className="fixed inset-0 z-[5003] bg-black/92 flex flex-col"
          role="presentation"
          onClick={() => setTrailPhotoLightboxSrc(null)}
        >
          <div className="flex justify-end p-3">
            <button
              type="button"
              onClick={() => setTrailPhotoLightboxSrc(null)}
              className="text-white text-sm font-medium px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors"
              aria-label="Close full image"
            >
              Close
            </button>
          </div>
          <div
            className="flex-1 flex items-center justify-center p-4 overflow-auto min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={trailPhotoLightboxSrc}
              alt=""
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}

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
