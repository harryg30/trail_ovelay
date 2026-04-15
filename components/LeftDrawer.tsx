'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type {
  Ride,
  Trail,
  DraftTrail,
  TrimFormState,
  EditMode,
  Network,
  RidePhoto,
  TrailPhoto,
  OfficialMapLayerPayload,
  StagedSegment,
  TrailActivityItem,
} from '@/lib/types'
import type { SessionUser } from '@/lib/auth'
import type { MapBounds } from '@/lib/geo-utils'
import { polylineInBounds, pointInBounds, trailPhotoMapPoint, inferNetworkIdForPolyline } from '@/lib/geo-utils'
import { Badge } from '@/components/ui/badge'
import { DIFFICULTY_BADGE_VARIANT } from '@/lib/trail-constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { uploadRideFilesClient } from '@/lib/upload-rides-client'
import { cn } from '@/lib/utils'
import AuthButton from '@/components/AuthButton'
import GetExtensionButton from '@/components/GetExtensionButton'
import ThemeToggle from '@/components/ThemeToggle'
import { TrailEditDrawer } from '@/components/trail/TrailEditDrawer'
import { TrailDetailPanel } from '@/components/trail/TrailDetailPanel'
import { TrailFormFields } from '@/components/shared/TrailFormFields'
import { ActivityFeed } from '@/components/ActivityFeed'
import { NetworkRow } from '@/components/network/NetworkRow'
import { DrawNetworkContent } from '@/components/network/DrawNetworkContent'
import { EditNetworkContent } from '@/components/network/EditNetworkContent'
import { DraftsList } from '@/components/trail/DraftsList'
import { AddTrailPhotoContent } from '@/components/photo/AddTrailPhotoContent'
import type { StagedTrailApi } from '@/hooks/useStagedTrail'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCamera,
  faCheck,
  faCrosshairs,
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
  selectedTrail: Trail | null
  onSelectTrail: (trail: Trail | null) => void
  onSaveEditedTrail: (form: TrimFormState) => Promise<string | null>
  onDeleteTrail: () => Promise<string | null>
  refineError: string | null
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
  onOpenContact: () => void
  onOpenCookiePolicy: () => void
  highResRideIds: Set<string>
  onFetchHighRes: (id: string) => Promise<void>
  fetchingHighResId: string | null
  ridePhotos: Record<string, RidePhoto[]>
  photosVisibleRideIds: Set<string>
  fetchingPhotosId: string | null
  onFetchAndTogglePhotos: (rideId: string) => Promise<void>
  draftTrails: DraftTrail[]
  onPublishDraft: (localId: string) => Promise<string | null>
  onDeleteDraft: (localId: string) => void
  onEditDraft: (localId: string) => void
  draftSidebarPrefill: DraftTrail | null
  onClearDraftSidebarPrefill: () => void
  staged: StagedTrailApi
  onSaveAddedTrail: (form: TrimFormState, publishOnSave: boolean) => Promise<string | null>
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
  onOpenPhotoLightbox: (src: string) => void
  onFlyToTrail: (trail: Trail) => void
  onFlyToNetwork: (network: Network) => void
  onOfficialMapLayerChange: (layer: OfficialMapLayerPayload | null) => void
  onAlignmentMapPickChange: (handler: null | ((latlng: [number, number]) => void)) => void
  pendingDigitizationTask: { id: string; label: string } | null
  onPendingDigitizationTaskChange: (task: { id: string; label: string } | null) => void
  /** Trail currently being viewed in the detail panel (not editing). */
  viewingTrail: Trail | null
  onOpenViewTrail: (trail: Trail) => void
  onCloseViewTrail: () => void
  onEditViewTrail: (trail: Trail) => void
  onSelectActivityItem?: (item: TrailActivityItem) => void
  /** Controlled tab (lifted to parent for URL sync). */
  tab: 'trails' | 'activity' | 'networks'
  onTabChange: (tab: 'trails' | 'activity' | 'networks') => void
  /** Photo lightbox state for URL sync. */
  initialPhotoId?: string
  onPhotoOpen?: (photoId: string) => void
  onPhotoClose?: () => void
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
  selectedTrail,
  onSelectTrail,
  onSaveEditedTrail,
  onDeleteTrail,
  refineError,
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
  onOpenContact,
  onOpenCookiePolicy,
  highResRideIds,
  onFetchHighRes,
  fetchingHighResId,
  ridePhotos,
  photosVisibleRideIds,
  fetchingPhotosId,
  onFetchAndTogglePhotos,
  draftTrails,
  onPublishDraft,
  onDeleteDraft,
  onEditDraft,
  draftSidebarPrefill,
  onClearDraftSidebarPrefill,
  staged,
  onSaveAddedTrail,
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
  onOpenPhotoLightbox,
  onFlyToTrail,
  onFlyToNetwork,
  onOfficialMapLayerChange,
  onAlignmentMapPickChange,
  pendingDigitizationTask,
  onPendingDigitizationTaskChange,
  viewingTrail,
  onOpenViewTrail,
  onCloseViewTrail,
  onEditViewTrail,
  onSelectActivityItem,
  tab,
  onTabChange,
  initialPhotoId,
  onPhotoOpen,
  onPhotoClose,
}: LeftDrawerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pendingHighResRideId, setPendingHighResRideId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [trailsQuery, setTrailsQuery] = useState('')
  const [trailsPageSize, setTrailsPageSize] = useState(() => {
    if (typeof window === 'undefined') return 10
    const saved = localStorage.getItem('trailsPageSize')
    return saved ? Number(saved) : 10
  })
  const [trailsPage, setTrailsPage] = useState(0)
  const trailPhotoNeedsMapPin = (p: TrailPhoto) => !p.accepted

  const [trailPhotoForAction, setTrailPhotoForAction] = useState<TrailPhoto | null>(null)
  const drawerTab = tab

  const visibleUnpinnedForPin = useMemo(() => {
    const pending = unpinnedTrailPhotos.filter((p) => trailPhotoNeedsMapPin(p))
    const activeBounds = showOnMapOnly && mapBounds ? mapBounds : null
    if (!activeBounds) return pending
    return pending.filter((p) => {
      const pt = trailPhotoMapPoint(p)
      return pt != null && pointInBounds(pt, activeBounds)
    })
  }, [unpinnedTrailPhotos, showOnMapOnly, mapBounds])


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setUploading(true)
    setUploadError(null)
    setUploadProgress({ done: 0, total: files.length })

    const { rides: allRides, errors } = await uploadRideFilesClient(files, (done, total) =>
      setUploadProgress({ done, total })
    )

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
    editMode === 'add-trail' || (editMode === 'edit-trail' && !!selectedTrail)
  const showTrailFolderList =
    editMode !== 'add-trail' && !(editMode === 'edit-trail' && selectedTrail)

  return (
    <div className="flex h-screen w-full max-w-[392px] shrink-0 flex-col border-r-2 border-foreground bg-card shadow-[4px_0_0_0_var(--foreground)] sm:w-[392px]">
      {/* Header */}
      <div className="catalog-title-strip border-b-2 border-foreground px-4 py-4">
        <h1 className="mb-3 leading-none">
          <span className="font-display inline-block border-2 border-foreground bg-primary px-3 py-2 text-2xl font-normal uppercase tracking-[0.22em] text-primary-foreground shadow-[5px_5px_0_0_var(--foreground)] dark:bg-muted dark:text-primary sm:px-4 sm:py-2.5 sm:text-3xl sm:tracking-[0.26em}">
            Trail Overlay
          </span>
        </h1>
        <AuthButton user={user} />
        <div className="mt-3 w-full">
          <ThemeToggle className="w-full" size="sm" />
        </div>
        <div className="mt-3 w-full">
          <GetExtensionButton />
        </div>
      </div>

      {/* Upload section */}
      <div className="flex flex-col gap-2 border-b-2 border-border px-4 py-4">
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
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              variant="default"
              className="w-full"
            >
              {uploadProgress
                ? `Uploading ${uploadProgress.done} / ${uploadProgress.total}…`
                : 'Upload GPX / ZIP'}
            </Button>
            <Button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              variant="secondary"
              className="w-full"
            >
              {syncing ? 'Syncing...' : 'Sync Strava Rides'}
            </Button>
            {syncMessage && <p className="text-xs text-muted-foreground">{syncMessage}</p>}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Connect with Strava to upload rides.</p>
        )}
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      </div>

      {/* Viewport filter toggle — hidden when viewing trail detail */}
      {!viewingTrail && (
      <div className="flex items-center gap-0 border-b-2 border-border px-4 py-2">
        <button
          type="button"
          onClick={() => showOnMapOnly && onToggleShowOnMapOnly()}
          className={cn(
            'flex-1 border-2 border-r-0 border-foreground py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
            !showOnMapOnly
              ? 'bg-foreground text-background'
              : 'bg-card text-muted-foreground hover:bg-mud/80'
          )}
        >
          All data
        </button>
        <button
          type="button"
          onClick={() => !showOnMapOnly && onToggleShowOnMapOnly()}
          disabled={!mapBounds}
          suppressHydrationWarning
          className={cn(
            'flex-1 border-2 border-foreground py-1.5 text-xs font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            showOnMapOnly
              ? 'bg-foreground text-background'
              : 'bg-card text-muted-foreground hover:bg-mud/80'
          )}
        >
          On map
        </button>
      </div>
      )}

      {/* Tab navigation */}
      <div className="flex border-b-2 border-border">
        {(['trails', 'activity', 'networks'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => { onTabChange(tab); if (viewingTrail) onCloseViewTrail() }}
            className={cn(
              'flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors',
              !viewingTrail && drawerTab === tab
                ? 'border-b-2 border-foreground text-foreground -mb-0.5'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab === 'trails' ? 'Trails' :
             tab === 'activity' ? 'Activity' : 'Networks'}
          </button>
        ))}
      </div>

      {/* Scrollable content area — everything below the tab bar */}
      <div className="drawer-scroll flex-1 min-h-0 overflow-y-auto">

      {/* Trail detail panel */}
      {viewingTrail && (
        <TrailDetailPanel
          trail={viewingTrail}
          networks={networks}
          user={user}
          onClose={onCloseViewTrail}
          onEdit={onEditViewTrail}
          initialPhotoId={initialPhotoId}
          onPhotoOpen={onPhotoOpen}
          onPhotoClose={onPhotoClose}
        />
      )}

      {/* Activity tab */}
      {!viewingTrail && drawerTab === 'activity' && (
        <ActivityFeed
          showOnMapOnly={showOnMapOnly}
          mapBounds={mapBounds}
          trails={trails}
          onOpenViewTrail={onOpenViewTrail}
          onSelectActivityItem={onSelectActivityItem}
        />
      )}

      {/* Trails tab */}
      {!viewingTrail && drawerTab === 'trails' && (
      <div className="flex flex-col gap-2 border-b-2 border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xs font-normal uppercase tracking-[0.15em] text-muted-foreground">
            Trails ({trails.length})
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleModeClick('add-trail')}
              title={editMode === 'add-trail' ? 'Cancel' : 'Add trail'}
              className={cn(
                'flex size-6 items-center justify-center rounded-sm border-2 text-base font-light transition-colors',
                editMode === 'add-trail'
                  ? 'border-foreground bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-mud/80'
              )}
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
              className={cn(
                'flex size-6 items-center justify-center rounded-sm border-2 transition-colors',
                editMode === 'add-trail-photo'
                  ? 'border-foreground bg-forest text-secondary-foreground'
                  : 'border-border text-muted-foreground hover:bg-mud/80'
              )}
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
                className={cn(
                  'flex size-6 items-center justify-center rounded-sm border-2 transition-colors',
                  editMode === 'edit-trail'
                    ? 'border-foreground bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-mud/80'
                )}
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

        {editMode === 'edit-trail' && selectedTrail && (
          <div className="flex flex-col gap-2">
            {refineError && <p className="text-xs text-destructive">{refineError}</p>}
            <TrailEditDrawer
              variant="edit"
              trailEditTool={staged.drawTool}
              onSetTool={staged.setDrawTool}
              canUndo={staged.canUndo}
              canRedo={staged.canRedo}
              onUndo={staged.undo}
              onRedo={staged.redo}
              onClear={staged.clearAll}
              points={selectedTrail.polyline}
              selectedTrail={selectedTrail}
              refinedPolyline={staged.compositePolyline.length >= 2 ? staged.compositePolyline : null}
              onSaveDraw={onSaveAddedTrail}
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
          <AddTrailSidebar
            staged={staged}
            onSave={onSaveAddedTrail}
            onCancel={() => onEditModeChange(null)}
            networks={networks}
            canPublish={!!user}
            draftPrefill={draftSidebarPrefill}
            onClearDraftPrefill={onClearDraftSidebarPrefill}
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
          <div className="flex flex-col gap-2 px-4 py-3 border-t-2 border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {user ? 'My trail photos — pin on map' : 'Demo trail photos — pin on map'}
            </p>
            <p className="text-xs text-muted-foreground">
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
                        ? 'border-forest ring-2 ring-forest/35'
                        : 'border-border hover:border-foreground/40'
                    }`}
                  >
                    <img
                      src={photo.thumbnailUrl || photo.blobUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-forest/95 py-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-secondary-foreground">
                      Pin
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {editMode === 'edit-trail' && !selectedTrail && (
          <p className="text-xs text-muted-foreground">Select a trail from the list to edit its line and details.</p>
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

          const trailFolderSearchBar = (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={trailsQuery}
                onChange={(e) => { setTrailsQuery(e.target.value); setTrailsPage(0) }}
                placeholder="Search trails…"
                className="h-9 flex-1 min-w-0"
              />
              <select
                value={trailsPageSize}
                onChange={(e) => { const v = Number(e.target.value); setTrailsPageSize(v); localStorage.setItem('trailsPageSize', String(v)); setTrailsPage(0) }}
                className="shrink-0 rounded-sm border-2 border-foreground bg-card px-1 py-0.5 text-xs font-semibold text-foreground shadow-[1px_1px_0_0_var(--foreground)]"
              >
                <option value={5}>5 / pg</option>
                <option value={10}>10 / pg</option>
                <option value={25}>25 / pg</option>
              </select>
            </div>
          )

          if (rows.length === 0) {
            return (
              <>
                {trailFolderSearchBar}
                <p className="text-xs text-muted-foreground">
                  {trails.length === 0 ? 'No trails saved yet.' : 'No trails match.'}
                </p>
              </>
            )
          }

          const totalPages = Math.max(1, Math.ceil(rows.length / trailsPageSize))
          const safePage = Math.min(trailsPage, totalPages - 1)
          const pagedRows = rows.slice(safePage * trailsPageSize, (safePage + 1) * trailsPageSize)

          return (
            <>
              {trailFolderSearchBar}
              <ul className="flex flex-col gap-0.5">
                {pagedRows.map((row, i) => {
                  if (row.kind === 'header') {
                    const folderNetwork =
                      row.networkId !== '__unassigned__'
                        ? networks.find((n) => n.id === row.networkId) ?? null
                        : null
                    return (
                      <li key={`h-${row.networkId}-${i}`} className="flex items-center gap-1.5 px-1 pt-2 pb-0.5">
                        <FontAwesomeIcon icon={faFolder} className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground truncate flex-1 min-w-0">
                          {row.name}
                        </span>
                        {folderNetwork && (
                          <button
                            type="button"
                            onClick={() => onFlyToNetwork(folderNetwork)}
                            title="Fly to on map"
                            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-0.5"
                          >
                            <FontAwesomeIcon icon={faCrosshairs} className="h-3 w-3" />
                          </button>
                        )}
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{row.count}</span>
                      </li>
                    )
                  }
                  const { trail } = row
                  return (
                    <Fragment key={`t-wrap-${trail.id}-${row.networkId ?? 'u'}-${i}`}>
                      <li
                        className={cn(
                          'ml-3 flex items-center gap-2 rounded-md border border-transparent bg-mud/45 px-2 py-2 text-sm',
                          selectedTrail?.id === trail.id && editMode === 'edit-trail'
                            ? 'ring-2 ring-primary'
                            : ''
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onOpenViewTrail(trail)}
                          className="text-foreground truncate flex-1 min-w-0 text-left hover:underline underline-offset-2"
                        >
                          {trail.name}
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-muted-foreground text-xs">{trail.distanceKm.toFixed(1)} km</span>
                          {trail.difficulty !== 'not_set' && (
                            <Badge
                              variant={DIFFICULTY_BADGE_VARIANT[trail.difficulty] as 'trail' | 'catalog' | 'ink' | 'default' ?? 'default'}
                              className="tabular-nums"
                            >
                              {trail.difficulty === 'easy' ? '● Green' :
                               trail.difficulty === 'intermediate' ? '■ Blue' :
                               trail.difficulty === 'hard' ? '◆ Black' :
                               '◆◆ Dbl'}
                            </Badge>
                          )}
                          <button
                            type="button"
                            onClick={() => onFlyToTrail(trail)}
                            title="Fly to on map"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <FontAwesomeIcon icon={faCrosshairs} className="w-3.5 h-3.5" />
                          </button>
                          {user && (
                            <button
                              type="button"
                              onClick={() => { onSelectTrail(trail); onEditModeChange('edit-trail') }}
                              title="Edit trail"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </li>
                    </Fragment>
                  )
                })}
              </ul>
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="outlineThick"
                    size="xs"
                    onClick={() => setTrailsPage(p => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                  >
                    Prev
                  </Button>
                  <span className="text-xs font-semibold text-muted-foreground">Page {safePage + 1} of {totalPages}</span>
                  <Button
                    type="button"
                    variant="outlineThick"
                    size="xs"
                    onClick={() => setTrailsPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage === totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )
        })()}
      </div>
      )}

      {/* Drafts section — inside Trails tab */}
      {!viewingTrail && drawerTab === 'trails' && !focusedTrailSession && draftTrails.length > 0 && (
        <div className="px-4 py-4 border-t-2 border-border flex flex-col gap-2">
          <h2 className="font-display text-xs font-normal uppercase tracking-[0.15em] text-muted-foreground">
            Drafts ({draftTrails.length})
          </h2>
          <DraftsList
            drafts={draftTrails}
            canPublish={!!user}
            onPublish={onPublishDraft}
            onDelete={onDeleteDraft}
            onEdit={onEditDraft}
          />
        </div>
      )}

      {/* Networks tab */}
      {!viewingTrail && drawerTab === 'networks' && (
      <div className="px-4 py-4 border-t-2 border-border flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xs font-normal uppercase tracking-[0.15em] text-muted-foreground">
            Networks ({networks.length})
          </h2>
          {user && (
            <button
              type="button"
              onClick={() => onEditModeChange(editMode === 'add-network' ? null : 'add-network')}
              title={editMode === 'add-network' ? 'Cancel' : 'Add new network'}
              className={cn(
                'flex size-6 items-center justify-center rounded-sm border-2 text-base font-light transition-colors',
                editMode === 'add-network'
                  ? 'border-foreground bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-mud/80'
              )}
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
            key={selectedNetwork?.id ?? 'none'}
            trails={trails}
            networks={networks}
            selectedNetwork={selectedNetwork}
            onSelectNetwork={onSelectNetwork}
            onUpdate={onUpdateNetwork}
            onDelete={onDeleteNetwork}
            onRedraw={onStartRedrawNetwork}
            onCancel={() => { onSelectNetwork(null); onEditModeChange(null) }}
            user={user}
            onOfficialMapLayerChange={onOfficialMapLayerChange}
            onAlignmentMapPickChange={onAlignmentMapPickChange}
            pendingDigitizationTask={pendingDigitizationTask}
            onPendingDigitizationTaskChange={onPendingDigitizationTaskChange}
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
          if (visibleNetworks.length === 0) return <p className="text-xs text-muted-foreground">{networks.length === 0 ? 'No networks yet.' : 'No networks in view.'}</p>
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
                  onFlyTo={() => onFlyToNetwork(network)}
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

      </div>{/* end scrollable content area */}

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
            className="catalog-panel flex w-full max-w-sm flex-col gap-3 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-3">
              <img
                src={trailPhotoForAction.thumbnailUrl || trailPhotoForAction.blobUrl}
                alt=""
                className="h-20 w-20 shrink-0 rounded-md border-2 border-foreground object-cover"
              />
              <div className="min-w-0">
                <p id="trail-photo-action-title" className="font-display text-base font-normal uppercase tracking-wide text-foreground">
                  Trail photo
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  View full size, or pin to a trail on the map.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="default"
                className="w-full"
                onClick={() => {
                  onOpenPhotoLightbox(trailPhotoForAction.blobUrl)
                  setTrailPhotoForAction(null)
                }}
              >
                View
              </Button>
              {trailPhotoNeedsMapPin(trailPhotoForAction) && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full bg-forest text-secondary-foreground hover:brightness-110"
                  onClick={() => {
                    onPlaceTrailPhoto(trailPhotoForAction)
                    setTrailPhotoForAction(null)
                  }}
                >
                  Pin to map…
                </Button>
              )}
              <Button
                type="button"
                variant="outlineThick"
                className="w-full"
                onClick={() => setTrailPhotoForAction(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* About / Contact footer */}
      <div className="mt-auto px-4 py-2 border-t-2 border-border flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onOpenAnnouncement}
          className="text-[10px] font-bold uppercase tracking-wide text-electric underline-offset-1 hover:underline whitespace-nowrap"
        >
          About
        </button>
        <button
          type="button"
          onClick={onOpenContact}
          className="text-[10px] font-bold uppercase tracking-wide text-electric underline-offset-1 hover:underline whitespace-nowrap"
        >
          Contact
        </button>
        <button
          type="button"
          onClick={onOpenCookiePolicy}
          className="text-[10px] font-bold uppercase tracking-wide text-electric underline-offset-1 hover:underline whitespace-nowrap"
        >
          Cookies
        </button>
        <Link
          href="/privacy"
          className="text-[10px] font-bold uppercase tracking-wide text-electric underline-offset-1 hover:underline whitespace-nowrap"
        >
          Privacy
        </Link>
      </div>
    </div>
  )
}

function AddTrailSidebar({
  staged,
  onSave,
  onCancel,
  networks,
  canPublish,
  draftPrefill,
  onClearDraftPrefill,
}: {
  staged: StagedTrailApi
  onSave: (form: TrimFormState, publishOnSave: boolean) => Promise<string | null>
  onCancel: () => void
  networks: Network[]
  canPublish: boolean
  draftPrefill: DraftTrail | null
  onClearDraftPrefill: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState<TrimFormState>({
    name: '',
    difficulty: 'not_set',
    direction: 'not_set',
    notes: '',
    networkId: undefined,
  })
  const networkUserChosenRef = useRef(false)

  // One-shot: opening a draft for edit (map tools + sidebar form)
  useEffect(() => {
    if (!draftPrefill) return
    queueMicrotask(() => {
      setForm({
        name: draftPrefill.name,
        difficulty: draftPrefill.difficulty,
        direction: draftPrefill.direction,
        notes: draftPrefill.notes ?? '',
        networkId: draftPrefill.networkId,
      })
    })
    networkUserChosenRef.current = !!draftPrefill.networkId
    onClearDraftPrefill()
  }, [draftPrefill, onClearDraftPrefill])

  // Pre-fill trail name from OSM way names when the user hasn't typed a name yet
  useEffect(() => {
    const osmNamed = staged.segments.filter(
      (s): s is Extract<StagedSegment, { source: 'osm' }> =>
        s.source === 'osm' && typeof s.name === 'string' && s.name.trim().length > 0
    )
    if (osmNamed.length === 0) return
    const suggested =
      osmNamed.length === 1
        ? (osmNamed[0]?.name ?? '').trim()
        : osmNamed.map((s) => (s.name ?? '').trim()).filter(Boolean).join(' · ')
    if (!suggested) return
    queueMicrotask(() => {
      setForm((prev) => {
        if (prev.name.trim() !== '') return prev
        return { ...prev, name: suggested }
      })
    })
  }, [staged.segments])

  // Pre-fill network from polygon containment when the user hasn't changed the Network select
  useEffect(() => {
    if (networkUserChosenRef.current || networks.length === 0) return
    if (staged.compositePolyline.length < 2) return
    const id = inferNetworkIdForPolyline(staged.compositePolyline, networks)
    queueMicrotask(() => {
      setForm((prev) => ({ ...prev, networkId: id }))
    })
  }, [staged.compositePolyline, networks])

  const handleSubmit = async (publishOnSave: boolean) => {
    setSaving(true)
    setSaveError(null)
    const err = await onSave(form, publishOnSave)
    setSaving(false)
    if (err) setSaveError(err)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-muted-foreground">
        Use the panel on the map to draw, select GPX segments, or pick OSM ways.
      </p>
      {staged.segments.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Staged — {staged.segments.length} segment{staged.segments.length !== 1 ? 's' : ''} · {staged.totalDistanceKm.toFixed(2)} km
          </p>
          {staged.segments.map((seg, i) => (
            <div key={seg.id} className="flex items-center justify-between text-[11px]">
              <span className="truncate">
                {i + 1}. {seg.source === 'draw' ? `Draw (${seg.polyline.length} pts)` : seg.source === 'gpx' ? 'GPX' : seg.source === 'osm' ? ((seg as Extract<typeof seg, { source: 'osm' }>).name ?? `OSM`) : seg.source === 'strava' ? ((seg as Extract<typeof seg, { source: 'strava' }>).name ?? `Strava`) : '?'}
              </span>
              <button type="button" onClick={() => staged.removeSegment(seg.id)} className="text-muted-foreground hover:text-destructive" title="Remove">
                <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      <TrailFormFields form={form} onChange={setForm} disabled={saving} />
      {networks.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium">Network</label>
          <select
            value={form.networkId ?? ''}
            onChange={(e) => {
              networkUserChosenRef.current = true
              setForm({ ...form, networkId: e.target.value || undefined })
            }}
            disabled={saving}
            className="h-9 w-full rounded-md border-2 border-foreground bg-card px-2 py-1 text-sm font-medium text-foreground shadow-[inset_2px_2px_0_0_var(--mud)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">None</option>
            {networks.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => handleSubmit(false)}
          disabled={saving || staged.compositePolyline.length < 2}
        >
          {saving ? 'Saving…' : 'Save draft'}
        </Button>
        {canPublish && (
          <Button
            type="button"
            variant="outlineThick"
            size="sm"
            onClick={() => handleSubmit(true)}
            disabled={saving || staged.compositePolyline.length < 2 || !form.name.trim()}
          >
            Publish
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
