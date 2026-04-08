'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import LeftDrawer from '@/components/LeftDrawer'
import AnnouncementModal from '@/components/AnnouncementModal'
import { ANNOUNCEMENT_VERSION, ANNOUNCEMENT } from '@/lib/announcement'
import type { Ride, Trail, Network, TrimSegment, TrimFormState, SaveTrailResponse, RidePhoto, DraftTrail, TrailPhoto } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'
import {
  polylineDistanceKm,
  estimatedElevationGainFt,
  generateAveragedTrail,
  clipPolylineToCorridor,
  trailPhotoMapPoint,
} from '@/lib/geo-utils'
import type { MapBounds } from '@/lib/geo-utils'
import { insertPointAfter, removePointAt } from '@/lib/geo-edit'
import { useEditMode } from '@/hooks/useEditMode'
import { loadDemoRides } from '@/lib/demo-rides'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faCamera } from '@fortawesome/free-solid-svg-icons'
import ThemeToggle from '@/components/ThemeToggle'

const LeafletMap = dynamic(() => import('@/components/LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full flex-1 items-center justify-center bg-mud/50">
      <p className="font-display text-sm uppercase tracking-wide text-muted-foreground">Loading map…</p>
    </div>
  ),
})

const DRAFTS_STORAGE_KEY = 'draft_trails'

function persistDrafts(drafts: DraftTrail[]) {
  localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts))
}

export default function ClientPage({ user }: { user: SessionUser | null }) {
  const [rides, setRides] = useState<Ride[]>([])
  const [trails, setTrails] = useState<Trail[]>([])
  const [networks, setNetworks] = useState<Network[]>([])
  const [draftTrails, setDraftTrails] = useState<DraftTrail[]>([])
  const [hiddenRideIds, setHiddenRideIds] = useState<Set<string>>(new Set())
  const ridesLoadedRef = useRef(false)
  const [hiddenNetworkIds, setHiddenNetworkIds] = useState<Set<string>>(new Set())
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showAnnouncement, setShowAnnouncement] = useState(false)
  const [photoLightboxSrc, setPhotoLightboxSrc] = useState<string | null>(null)

  useEffect(() => {
    setShowAnnouncement(localStorage.getItem(`announcement_dismissed_v${ANNOUNCEMENT_VERSION}`) !== 'true')
  }, [])

  // Load demo rides for unauthenticated users
  useEffect(() => {
    if (user) return
    loadDemoRides().then((demos) => {
      if (demos.length > 0) setRides(demos)
    }).catch(console.error)
  }, [user])

  // Hydrate draft trails from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFTS_STORAGE_KEY)
      if (stored) setDraftTrails(JSON.parse(stored) as DraftTrail[])
    } catch { /* ignore malformed storage */ }
  }, [])

  // Edit state — mode transitions and mode-scoped state managed by useEditMode
  const {
    editMode,
    setMode,
    trimStart, setTrimStart,
    trimEnd, setTrimEnd,
    trimEndRef,
    selectedTrail, setSelectedTrail,
    refinedPolyline, setRefinedPolyline,
    refineError, setRefineError,
    selectedNetwork, setSelectedNetwork,
    drawNetworkPoints, setDrawNetworkPoints,
    drawTrailPoints, setDrawTrailPoints,
    drawTrailHistoryPast, setDrawTrailHistoryPast,
    drawTrailHistoryFuture, setDrawTrailHistoryFuture,
    refineTrailHistoryPast, setRefineTrailHistoryPast,
    refineTrailHistoryFuture, setRefineTrailHistoryFuture,
    trailEditTool, setTrailEditTool,
  } = useEditMode()

  const trimMode = editMode === 'add-trail'
  /** Map click selects a trail only when in edit mode without a trail yet (picker). */
  const mapTrailPickMode = editMode === 'edit-trail' && !selectedTrail
  /** Geometry overlays (midpoints, drag) while editing an existing trail. */
  const geometryEditMode =
    editMode === 'edit-trail' && !!selectedTrail && refinedPolyline !== null
  const drawNetworkMode = editMode === 'add-network'
  const editNetworkMode = editMode === 'edit-network'
  const drawTrailMode = editMode === 'draw-trail'

  // Keep latest values in refs so event handlers can read synchronously without
  // relying on state-updater closures (which are double-invoked in dev StrictMode).
  const drawTrailPointsRef = useRef(drawTrailPoints)
  drawTrailPointsRef.current = drawTrailPoints
  const drawTrailHistoryPastRef = useRef(drawTrailHistoryPast)
  drawTrailHistoryPastRef.current = drawTrailHistoryPast
  const drawTrailHistoryFutureRef = useRef(drawTrailHistoryFuture)
  drawTrailHistoryFutureRef.current = drawTrailHistoryFuture

  const refinedPolylineRef = useRef(refinedPolyline)
  refinedPolylineRef.current = refinedPolyline
  const refineTrailHistoryPastRef = useRef(refineTrailHistoryPast)
  refineTrailHistoryPastRef.current = refineTrailHistoryPast
  const refineTrailHistoryFutureRef = useRef(refineTrailHistoryFuture)
  refineTrailHistoryFutureRef.current = refineTrailHistoryFuture

  const lastEditTrailIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (editMode !== 'edit-trail') {
      lastEditTrailIdRef.current = null
      return
    }
    if (!selectedTrail) return
    if (lastEditTrailIdRef.current !== selectedTrail.id) {
      lastEditTrailIdRef.current = selectedTrail.id
      setRefinedPolyline([...selectedTrail.polyline])
      setRefineTrailHistoryPast([])
      setRefineTrailHistoryFuture([])
      setRefineError(null)
    }
  }, [editMode, selectedTrail, setRefinedPolyline, setRefineError, setRefineTrailHistoryFuture, setRefineTrailHistoryPast])

  const polylinesEqual = useCallback((a: [number, number][], b: [number, number][]) => {
    if (a === b) return true
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false
    }
    return true
  }, [])

  const applyDrawTrailEdit = useCallback((updater: (prev: [number, number][]) => [number, number][]) => {
    // IMPORTANT: keep this side-effect free from inside React state updaters.
    // In dev/StrictMode, updater functions can be invoked more than once.
    const prev = drawTrailPointsRef.current
    const next = updater(prev)
    if (polylinesEqual(prev, next)) return
    setDrawTrailHistoryPast([...drawTrailHistoryPastRef.current, prev])
    setDrawTrailHistoryFuture([])
    setDrawTrailPoints(next)
  }, [
    polylinesEqual,
    setDrawTrailHistoryFuture,
    setDrawTrailHistoryPast,
    setDrawTrailPoints,
  ])

  const applyRefineTrailEdit = useCallback((updater: (prev: [number, number][]) => [number, number][]) => {
    const prev =
      refinedPolylineRef.current ??
      (selectedTrail ? [...selectedTrail.polyline] : [])
    const next = updater(prev)
    if (polylinesEqual(prev, next)) return
    setRefineTrailHistoryPast([...refineTrailHistoryPastRef.current, prev])
    setRefineTrailHistoryFuture([])
    setRefinedPolyline(next)
  }, [
    polylinesEqual,
    selectedTrail,
    setRefineTrailHistoryFuture,
    setRefineTrailHistoryPast,
    setRefinedPolyline,
  ])

  const [averagedTrimPolyline, setAveragedTrimPolyline] = useState<[number, number][] | null>(null)
  const [averagedRideCount, setAveragedRideCount] = useState(0)
  const [corridorRadiusKm, setCorridorRadiusKm] = useState(0.025)
  const [outputSpacingKm, setOutputSpacingKm] = useState(0.010)
  const [highResRideIds, setHighResRideIds] = useState<Set<string>>(new Set())
  const [fetchingHighResId, setFetchingHighResId] = useState<string | null>(null)
  const [fetchingHighResForCorridor, setFetchingHighResForCorridor] = useState(false)
  const [ridePhotos, setRidePhotos] = useState<Record<string, RidePhoto[]>>({})
  const [photosVisibleRideIds, setPhotosVisibleRideIds] = useState<Set<string>>(new Set())
  const [fetchingPhotosId, setFetchingPhotosId] = useState<string | null>(null)
  const [placingPhoto, setPlacingPhoto] = useState<RidePhoto | null>(null)
  const [placingTrailPhoto, setPlacingTrailPhoto] = useState<TrailPhoto | null>(null)
  /** Community-visible pins (server: accepted + on trail). */
  const [communityTrailPhotos, setCommunityTrailPhotos] = useState<TrailPhoto[]>([])
  /** Logged-in user’s unpinned / in-progress uploads (private). */
  const [myUnpinnedTrailPhotos, setMyUnpinnedTrailPhotos] = useState<TrailPhoto[]>([])
  /** Demo-only photos (object URLs; never POST). */
  const [localTrailPhotos, setLocalTrailPhotos] = useState<TrailPhoto[]>([])
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
  const [showOnMapOnly, setShowOnMapOnly] = useState(false)
  const [photoModeCenter, setPhotoModeCenter] = useState<{ lat: number; lon: number; t: number } | null>(null)
  const [mapFlyToRequest, setMapFlyToRequest] = useState<{
    seq: number
    kind: 'trail' | 'network'
    id: string
  } | null>(null)

  const requestFlyToTrail = useCallback((trail: Trail) => {
    setMapFlyToRequest((prev) => ({
      seq: (prev?.seq ?? 0) + 1,
      kind: 'trail',
      id: trail.id,
    }))
  }, [])

  const requestFlyToNetwork = useCallback((network: Network) => {
    setMapFlyToRequest((prev) => ({
      seq: (prev?.seq ?? 0) + 1,
      kind: 'network',
      id: network.id,
    }))
  }, [])

  const loadMyUnpinnedTrailPhotos = useCallback(() => {
    if (!user) return
    fetch('/api/trail-photos/mine')
      .then((r) => r.json())
      .then((data) => {
        if (!data?.photos) return
        setMyUnpinnedTrailPhotos(data.photos as TrailPhoto[])
      })
      .catch(() => {})
  }, [user])

  useEffect(() => {
    if (!user) {
      setMyUnpinnedTrailPhotos([])
      return
    }
    loadMyUnpinnedTrailPhotos()
  }, [loadMyUnpinnedTrailPhotos, user])

  // Community trail photo pins for the current map bounds (pinned-to-trail only on server)
  useEffect(() => {
    if (!mapBounds) return
    const { north, south, east, west } = mapBounds
    fetch(`/api/trail-photos?north=${north}&south=${south}&east=${east}&west=${west}&limit=500`)
      .then((r) => r.json())
      .then((data) => {
        if (!data?.photos) return
        setCommunityTrailPhotos((prev) => {
          const byId = new Map<string, TrailPhoto>()
          for (const p of prev) byId.set(p.id, p)
          for (const p of data.photos as TrailPhoto[]) byId.set(p.id, p)
          return Array.from(byId.values()).sort((a, b) => {
            const at = new Date(a.createdAt).getTime()
            const bt = new Date(b.createdAt).getTime()
            return bt - at
          })
        })
      })
      .catch(() => {})
  }, [mapBounds])

  const mapTrailPhotos = useMemo(() => {
    const byId = new Map<string, TrailPhoto>()
    for (const p of communityTrailPhotos) byId.set(p.id, p)
    for (const p of myUnpinnedTrailPhotos) {
      const pt = trailPhotoMapPoint(p)
      if (pt != null) byId.set(p.id, p)
    }
    for (const p of localTrailPhotos) {
      const pt = trailPhotoMapPoint(p)
      if (pt != null) byId.set(p.id, p)
    }
    return Array.from(byId.values()).sort((a, b) => {
      const at = new Date(a.createdAt).getTime()
      const bt = new Date(b.createdAt).getTime()
      return bt - at
    })
  }, [communityTrailPhotos, myUnpinnedTrailPhotos, localTrailPhotos])

  useEffect(() => {
    fetch('/api/trails')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setTrails(data.trails)
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    fetch('/api/networks')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setNetworks(data.networks)
      })
      .catch(console.error)
  }, [])

  const loadRides = useCallback(async () => {
    if (!user) return
    const r = await fetch('/api/rides')
    const data = await r.json()
    if (data.success) {
      setRides(data.rides)
      const saved = localStorage.getItem('visible_ride_ids')
      const visibleIds = saved ? new Set(JSON.parse(saved) as string[]) : new Set<string>()
      setHiddenRideIds(new Set(data.rides.map((ride: Ride) => ride.id).filter((id: string) => !visibleIds.has(id))))
      ridesLoadedRef.current = true
    }
  }, [user])

  useEffect(() => {
    if (!ridesLoadedRef.current) return
    const visibleIds = rides.filter((r) => !hiddenRideIds.has(r.id)).map((r) => r.id)
    localStorage.setItem('visible_ride_ids', JSON.stringify(visibleIds))
  }, [hiddenRideIds, rides])

  useEffect(() => {
    loadRides()
  }, [loadRides])

  const trimSegment = useMemo<TrimSegment | null>(() => {
    if (!trimStart || !trimEnd) return null
    const ride = rides.find((r) => r.id === trimStart.rideId)
    if (!ride) return null
    const polyline = ride.polyline.slice(trimStart.index, trimEnd.index + 1)
    if (polyline.length < 2) return null
    return {
      ride,
      startIndex: trimStart.index,
      endIndex: trimEnd.index,
      polyline,
      distanceKm: polylineDistanceKm(polyline),
      elevationGainFt: estimatedElevationGainFt(ride, trimStart.index, trimEnd.index),
    }
  }, [rides, trimStart, trimEnd])

  // Clear averaged result when endpoints change
  useEffect(() => {
    setAveragedTrimPolyline(null)
    setAveragedRideCount(0)
  }, [trimSegment])

  const handleClearAveragedTrim = useCallback(() => {
    setAveragedTrimPolyline(null)
    setAveragedRideCount(0)
  }, [])

  const handleSaveDraft = useCallback((
    polyline: [number, number][],
    form: TrimFormState,
    source: string,
    sourceRideId?: string,
  ) => {
    const draft: DraftTrail = {
      localId: 'draft_' + crypto.randomUUID(),
      isDraft: true,
      name: form.name,
      difficulty: form.difficulty,
      direction: form.direction,
      notes: form.notes || undefined,
      polyline,
      distanceKm: polylineDistanceKm(polyline),
      elevationGainFt: 0,
      source,
      sourceRideId,
      networkId: form.networkId,
      createdAt: new Date().toISOString(),
    }
    setDraftTrails((prev) => {
      const next = [draft, ...prev]
      persistDrafts(next)
      return next
    })
  }, [])

  const handlePublishDraft = useCallback(async (localId: string): Promise<string | null> => {
    const draft = draftTrails.find((d) => d.localId === localId)
    if (!draft) return 'Draft not found'
    try {
      const res = await fetch('/api/trails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trails: [{
            name: draft.name,
            difficulty: draft.difficulty,
            direction: draft.direction,
            notes: draft.notes,
            polyline: draft.polyline,
            distanceKm: draft.distanceKm,
            elevationGainFt: draft.elevationGainFt,
            source: draft.source,
            sourceRideId: draft.sourceRideId,
          }],
        }),
      })
      const data: SaveTrailResponse = await res.json()
      if (data.success && data.savedTrails) {
        setTrails((prev) => [...(data.savedTrails ?? []), ...prev])
        setDraftTrails((prev) => {
          const next = prev.filter((d) => d.localId !== localId)
          persistDrafts(next)
          return next
        })
        return null
      }
      return data.error ?? 'Publish failed'
    } catch {
      return 'Network error'
    }
  }, [draftTrails])

  const handleDeleteDraft = useCallback((localId: string) => {
    setDraftTrails((prev) => {
      const next = prev.filter((d) => d.localId !== localId)
      persistDrafts(next)
      return next
    })
  }, [])

  const handleAverageLine = useCallback(() => {
    if (!trimSegment) return
    const otherRides = rides.filter((r) => r.id !== trimSegment.ride.id)
    const result = generateAveragedTrail(trimSegment.polyline, otherRides, corridorRadiusKm, 2, outputSpacingKm)
    setAveragedTrimPolyline(result?.polyline ?? null)
    setAveragedRideCount(result?.rideCount ?? 0)
  }, [trimSegment, rides, corridorRadiusKm, outputSpacingKm])

  // Cheap check — no clip math, just gates the "Improve from Strava" button
  const hasUnfetchedStravaRides = useMemo(() =>
    trimSegment
      ? rides.some((r) => r.stravaActivityId && !highResRideIds.has(r.id) && r.id !== trimSegment.ride.id)
      : false
  , [rides, trimSegment, highResRideIds])

  const handleFetchHighRes = useCallback(async (rideId: string) => {
    setFetchingHighResId(rideId)
    try {
      const res = await fetch(`/api/rides/${rideId}/highres`)
      const data = await res.json()
      if (data.polyline) {
        setRides((prev) => prev.map((r) =>
          r.id === rideId ? { ...r, polyline: data.polyline, pointCount: data.polyline.length } : r
        ))
        setHighResRideIds((prev) => new Set([...prev, rideId]))
      }
    } finally {
      setFetchingHighResId(null)
    }
  }, [])

  const handleFetchHighResForCorridor = useCallback(async () => {
    if (!trimSegment) return
    setFetchingHighResForCorridor(true)
    const eligible = rides.filter((r) =>
      r.stravaActivityId &&
      !highResRideIds.has(r.id) &&
      r.id !== trimSegment.ride.id &&
      clipPolylineToCorridor(r.polyline, trimSegment.polyline, corridorRadiusKm).length >= 5
    )
    for (const ride of eligible) {
      const res = await fetch(`/api/rides/${ride.id}/highres`)
      const data = await res.json()
      if (data.polyline) {
        setRides((prev) => prev.map((r) =>
          r.id === ride.id ? { ...r, polyline: data.polyline, pointCount: data.polyline.length } : r
        ))
        setHighResRideIds((prev) => new Set([...prev, ride.id]))
      }
    }
    setFetchingHighResForCorridor(false)
  }, [rides, trimSegment, highResRideIds, corridorRadiusKm])

  const handleRidesUploaded = (newRides: Ride[]) => {
    setRides((prev) => [...prev, ...newRides])
    setHiddenRideIds((prev) => {
      const next = new Set(prev)
      newRides.forEach((r) => next.add(r.id))
      return next
    })
  }

  const handleToggleRide = useCallback((id: string) => {
    setHiddenRideIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleHideAllRides = useCallback(() => {
    setHiddenRideIds(new Set(rides.map((r) => r.id)))
    localStorage.setItem('visible_ride_ids', JSON.stringify([]))
  }, [rides])

  const handleToggleNetwork = useCallback((id: string) => {
    setHiddenNetworkIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])


  // Mode transitions now handled by useEditMode — setMode does cleanup automatically
  const handleEditModeChange = setMode

  const handleEnterAddTrailPhoto = useCallback(() => {
    // IMPORTANT: request geolocation from a user gesture so the browser shows the permission prompt.
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPhotoModeCenter({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            t: Date.now(),
          })
          setMode('add-trail-photo')
        },
        () => {
          // If denied/unavailable, still enter the mode (user can place manually).
          setMode('add-trail-photo')
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15_000 }
      )
      return
    }
    setMode('add-trail-photo')
  }, [setMode])

  const handleToggleAddTrailPhoto = useCallback(() => {
    if (editMode === 'add-trail-photo') {
      setMode(null)
      return
    }
    handleEnterAddTrailPhoto()
  }, [editMode, handleEnterAddTrailPhoto, setMode])

  const handleTrailSelected = useCallback((trail: Trail) => {
    setSelectedTrail(trail)
  }, [])

  const handlePolylineRefined = useCallback((polyline: [number, number][]) => {
    applyRefineTrailEdit(() => [...polyline])
  }, [applyRefineTrailEdit])

  const handleSaveEditedTrail = useCallback(
    async (form: TrimFormState): Promise<string | null> => {
      if (!selectedTrail || !refinedPolyline) return 'Nothing to save'
      if (refinedPolyline.length < 2) return 'Trail needs at least 2 points'
      setRefineError(null)
      try {
        const distanceKm =
          refinedPolyline.length > 1 ? polylineDistanceKm(refinedPolyline) : selectedTrail.distanceKm
        const res = await fetch(`/api/trails/${selectedTrail.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            difficulty: form.difficulty,
            direction: form.direction,
            notes: form.notes || undefined,
            polyline: refinedPolyline,
            distanceKm,
          }),
        })
        const data = await res.json()
        if (data.success && data.trail) {
          setTrails((prev) => prev.map((t) => (t.id === data.trail.id ? data.trail : t)))
          setSelectedTrail(null)
          setRefinedPolyline(null)
          setMode(null)
          return null
        }
        setRefineError(data.error ?? 'Save failed')
        return data.error ?? 'Save failed'
      } catch {
        setRefineError('Network error')
        return 'Network error'
      }
    },
    [selectedTrail, refinedPolyline, setMode, setRefineError, setRefinedPolyline, setSelectedTrail]
  )

  const handleDeleteTrail = useCallback(async (): Promise<string | null> => {
    if (!selectedTrail) return 'No trail selected'
    try {
      const res = await fetch(`/api/trails/${selectedTrail.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setTrails((prev) => prev.filter((t) => t.id !== selectedTrail.id))
        setSelectedTrail(null)
        return null
      }
      return data.error ?? 'Delete failed'
    } catch {
      return 'Network error'
    }
  }, [selectedTrail])

  const handleTrimPointSelected = useCallback((rideId: string, index: number) => {
    setTrimStart((prevStart) => {
      const prevEnd = trimEndRef.current

      // No start yet → set start
      if (!prevStart) {
        setTrimEnd(null)
        return { rideId, index }
      }

      // Both set (third click) → reset to new start
      if (prevEnd !== null) {
        setTrimEnd(null)
        return { rideId, index }
      }

      // Different ride → reset to new start
      if (prevStart.rideId !== rideId) {
        setTrimEnd(null)
        return { rideId, index }
      }

      // Same ride, second click → set end with lo/hi ordering
      const lo = Math.min(prevStart.index, index)
      const hi = Math.max(prevStart.index, index)
      setTrimEnd({ rideId, index: hi })
      return { rideId, index: lo }
    })
  }, [])

  const handleStepTrimPoint = useCallback(
    (which: 'start' | 'end', delta: number) => {
      if (!trimSegment) return
      const maxIdx = trimSegment.ride.polyline.length - 1
      if (which === 'start') {
        setTrimStart((prev) => {
          if (!prev) return prev
          const newIdx = Math.max(0, Math.min(prev.index + delta, trimSegment.endIndex - 1))
          return { ...prev, index: newIdx }
        })
      } else {
        setTrimEnd((prev) => {
          if (!prev) return prev
          const newIdx = Math.max(trimSegment.startIndex + 1, Math.min(prev.index + delta, maxIdx))
          return { ...prev, index: newIdx }
        })
      }
    },
    [trimSegment]
  )

  const handleClearTrimPoint = useCallback((which: 'start' | 'end') => {
    if (which === 'start') setTrimStart(null)
    else setTrimEnd(null)
  }, [])

  const handleSaveTrail = useCallback(
    async (form: TrimFormState, publishOnSave: boolean): Promise<string | null> => {
      if (!trimSegment) return 'No segment selected'

      const polyline = averagedTrimPolyline ?? trimSegment.polyline
      const source = averagedTrimPolyline ? 'averaged' : 'trim'

      if (!publishOnSave || !user) {
        handleSaveDraft(polyline, form, source, trimSegment.ride.id)
        setMode(null)
        setTrimStart(null)
        setTrimEnd(null)
        return null
      }

      const res = await fetch('/api/trails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trails: [
            {
              name: form.name,
              difficulty: form.difficulty,
              direction: form.direction,
              notes: form.notes || undefined,
              polyline,
              distanceKm: averagedTrimPolyline
                ? polylineDistanceKm(averagedTrimPolyline)
                : trimSegment.distanceKm,
              elevationGainFt: trimSegment.elevationGainFt,
              source,
              sourceRideId: trimSegment.ride.id,
            },
          ],
        }),
      })

      const data: SaveTrailResponse = await res.json()

      if (data.success && data.savedTrails) {
        setTrails((prev) => [...(data.savedTrails ?? []), ...prev])

        if (form.networkId && data.savedTrails.length > 0) {
          const network = networks.find((n) => n.id === form.networkId)
          if (network) {
            const updatedTrailIds = [...network.trailIds, data.savedTrails[0].id]
            const res2 = await fetch(`/api/networks/${network.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: network.name, trailIds: updatedTrailIds }),
            })
            const data2 = await res2.json()
            if (data2.success && data2.network) {
              setNetworks((prev) => prev.map((n) => (n.id === data2.network.id ? data2.network : n)))
            }
          }
        }

        setMode(null)
        setTrimStart(null)
        setTrimEnd(null)
        return null
      }

      return data.error ?? 'Save failed'
    },
    [trimSegment, networks, user, handleSaveDraft]
  )

  const handleSaveDrawnTrail = useCallback(
    async (form: TrimFormState, publishOnSave: boolean): Promise<string | null> => {
      if (drawTrailPoints.length < 2) return 'Draw at least 2 points'
      const polyline = drawTrailPoints

      if (!publishOnSave || !user) {
        handleSaveDraft(polyline, form, 'draw')
        setMode(null)
        return null
      }

      const res = await fetch('/api/trails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trails: [{
            name: form.name,
            difficulty: form.difficulty,
            direction: form.direction,
            notes: form.notes || undefined,
            polyline,
            distanceKm: polylineDistanceKm(polyline),
            elevationGainFt: 0,
            source: 'draw',
          }],
        }),
      })
      const data: SaveTrailResponse = await res.json()
      if (data.success && data.savedTrails) {
        setTrails((prev) => [...(data.savedTrails ?? []), ...prev])
        setMode(null)
        return null
      }
      return data.error ?? 'Save failed'
    },
    [drawTrailPoints, user, handleSaveDraft]
  )

  const handleDrawTrailPointAdded = useCallback((latlng: [number, number]) => {
    applyDrawTrailEdit((prev) => [...prev, latlng])
  }, [applyDrawTrailEdit])

  const handleDrawTrailPointRemoved = useCallback((index: number) => {
    applyDrawTrailEdit((prev) => {
      if (prev.length <= 2) return prev
      return removePointAt(prev, index)
    })
  }, [applyDrawTrailEdit])

  const handleDrawTrailInsertAfter = useCallback((indexBefore: number, latlng: [number, number]) => {
    applyDrawTrailEdit((prev) => insertPointAfter(prev, indexBefore, latlng))
  }, [applyDrawTrailEdit])

  const handleDrawTrailPointMoved = useCallback((index: number, latlng: [number, number]) => {
    applyDrawTrailEdit((prev) => {
      if (index < 0 || index >= prev.length) return prev
      const next = [...prev]
      next[index] = latlng
      return next
    })
  }, [applyDrawTrailEdit])

  const handleDrawTrailUndo = useCallback(() => {
    const past = drawTrailHistoryPastRef.current
    if (past.length === 0) return
    const current = drawTrailPointsRef.current
    const prev = past[past.length - 1]
    setDrawTrailHistoryPast(past.slice(0, -1))
    setDrawTrailHistoryFuture([current, ...drawTrailHistoryFutureRef.current])
    setDrawTrailPoints(prev)
  }, [
    drawTrailHistoryFuture.length,
    drawTrailHistoryPast.length,
    drawTrailPoints.length,
    setDrawTrailHistoryFuture,
    setDrawTrailHistoryPast,
    setDrawTrailPoints,
  ])

  const handleDrawTrailRedo = useCallback(() => {
    const future = drawTrailHistoryFutureRef.current
    if (future.length === 0) return
    const current = drawTrailPointsRef.current
    const next = future[0]
    setDrawTrailHistoryFuture(future.slice(1))
    setDrawTrailHistoryPast([...drawTrailHistoryPastRef.current, current])
    setDrawTrailPoints(next)
  }, [
    drawTrailHistoryFuture.length,
    drawTrailHistoryPast.length,
    drawTrailPoints.length,
    setDrawTrailHistoryFuture,
    setDrawTrailHistoryPast,
    setDrawTrailPoints,
  ])

  const handleDrawTrailClear = useCallback(() => {
    applyDrawTrailEdit(() => [])
  }, [applyDrawTrailEdit])

  const handleRefineUndo = useCallback(() => {
    const past = refineTrailHistoryPastRef.current
    if (past.length === 0) return
    const prev = past[past.length - 1]
    const current =
      refinedPolylineRef.current ?? (selectedTrail ? [...selectedTrail.polyline] : prev)
    setRefineTrailHistoryPast(past.slice(0, -1))
    setRefineTrailHistoryFuture([current, ...refineTrailHistoryFutureRef.current])
    setRefinedPolyline(prev)
  }, [
    refinedPolyline,
    refineTrailHistoryFuture.length,
    refineTrailHistoryPast.length,
    selectedTrail,
    setRefineTrailHistoryFuture,
    setRefineTrailHistoryPast,
    setRefinedPolyline,
  ])

  const handleRefineRedo = useCallback(() => {
    const future = refineTrailHistoryFutureRef.current
    if (future.length === 0) return
    const next = future[0]
    const current =
      refinedPolylineRef.current ?? (selectedTrail ? [...selectedTrail.polyline] : next)
    setRefineTrailHistoryFuture(future.slice(1))
    setRefineTrailHistoryPast([...refineTrailHistoryPastRef.current, current])
    setRefinedPolyline(next)
  }, [
    refinedPolyline,
    refineTrailHistoryFuture.length,
    refineTrailHistoryPast.length,
    selectedTrail,
    setRefineTrailHistoryFuture,
    setRefineTrailHistoryPast,
    setRefinedPolyline,
  ])

  const handleRefineClear = useCallback(() => {
    if (!selectedTrail) return
    applyRefineTrailEdit(() => [...selectedTrail.polyline])
  }, [applyRefineTrailEdit, selectedTrail])

  const handleRefinePointRemoved = useCallback((index: number) => {
    applyRefineTrailEdit((prev) => {
      if (prev.length <= 2) return prev
      return removePointAt(prev, index)
    })
  }, [applyRefineTrailEdit])

  const handleRefineInsertAfter = useCallback((indexBefore: number, latlng: [number, number]) => {
    applyRefineTrailEdit((prev) => insertPointAfter(prev, indexBefore, latlng))
  }, [applyRefineTrailEdit])

  const handleNetworkPointAdded = useCallback((latlng: [number, number]) => {
    setDrawNetworkPoints((prev) => [...prev, latlng])
  }, [])

  const handleSaveNetwork = useCallback(
    async (name: string, polygon: [number, number][], trailIds: string[]): Promise<string | null> => {
      try {
        const res = await fetch('/api/networks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, polygon, trailIds }),
        })
        const data = await res.json()
        if (data.success && data.network) {
          setNetworks((prev) => [data.network, ...prev])
          setMode(null)
          setDrawNetworkPoints([])
          return null
        }
        return data.error ?? 'Save failed'
      } catch {
        return 'Network error'
      }
    },
    []
  )

  const handleUpdateNetwork = useCallback(
    async (name: string, polygon: [number, number][] | null, trailIds: string[]): Promise<string | null> => {
      if (!selectedNetwork) return 'No network selected'
      try {
        const body: { name: string; trailIds: string[]; polygon?: [number, number][] } = { name, trailIds }
        if (polygon) body.polygon = polygon
        const res = await fetch(`/api/networks/${selectedNetwork.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (data.success && data.network) {
          setNetworks((prev) => prev.map((n) => (n.id === data.network.id ? data.network : n)))
          setSelectedNetwork(null)
          setMode(null)
          setDrawNetworkPoints([])
          return null
        }
        return data.error ?? 'Update failed'
      } catch {
        return 'Network error'
      }
    },
    [selectedNetwork]
  )

  const handleDeleteNetwork = useCallback(async (): Promise<string | null> => {
    if (!selectedNetwork) return 'No network selected'
    try {
      const res = await fetch(`/api/networks/${selectedNetwork.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setNetworks((prev) => prev.filter((n) => n.id !== selectedNetwork.id))
        setSelectedNetwork(null)
        setMode(null)
        return null
      }
      return data.error ?? 'Delete failed'
    } catch {
      return 'Network error'
    }
  }, [selectedNetwork])

  const handleStartRedrawNetwork = useCallback(() => {
    setDrawNetworkPoints([])
    setMode('add-network')
  }, [])

  const handleFetchAndTogglePhotos = useCallback(async (rideId: string) => {
    const isVisible = photosVisibleRideIds.has(rideId)
    // If already loaded, just toggle visibility
    if (ridePhotos[rideId]) {
      setPhotosVisibleRideIds((prev) => {
        const next = new Set(prev)
        if (next.has(rideId)) next.delete(rideId)
        else next.add(rideId)
        return next
      })
      return
    }
    // Fetch from Strava, then show
    setFetchingPhotosId(rideId)
    try {
      const res = await fetch(`/api/rides/${rideId}/photos`)
      const data = await res.json()
      if (data.photos) {
        setRidePhotos((prev) => ({ ...prev, [rideId]: data.photos }))
        if (!isVisible) {
          setPhotosVisibleRideIds((prev) => new Set([...prev, rideId]))
        }
      }
    } finally {
      setFetchingPhotosId(null)
    }
  }, [ridePhotos, photosVisibleRideIds])

  const handleAcceptPhoto = useCallback(async (
    photoId: string,
    trailId: string,
    trailLat: number,
    trailLon: number
  ) => {
    const res = await fetch(`/api/photos/${photoId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trailId, trailLat, trailLon }),
    })
    const data = await res.json()
    if (data.photo) {
      setRidePhotos((prev) => {
        const rideId = data.photo.rideId
        const updated = (prev[rideId] ?? []).map((p: RidePhoto) =>
          p.id === data.photo.id ? data.photo : p
        )
        return { ...prev, [rideId]: updated }
      })
      setPlacingPhoto(null)
    }
  }, [])

  const handlePlacePhoto = useCallback((photo: RidePhoto) => {
    setPlacingTrailPhoto(null)
    setPlacingPhoto(photo)
    // Mobile: collapse drawer so the map is visible for trail tap-to-pin.
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) {
      setMobileMenuOpen(false)
    }
  }, [])

  const handlePlaceTrailPhoto = useCallback((photo: TrailPhoto) => {
    setPlacingPhoto(null)
    setPlacingTrailPhoto(photo)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) {
      setMobileMenuOpen(false)
    }
  }, [])

  const handleCancelPlace = useCallback(() => {
    setPlacingPhoto(null)
    setPlacingTrailPhoto(null)
  }, [])

  const handleTrailPhotoCreated = useCallback((photo: TrailPhoto) => {
    if (photo.isLocal) {
      setLocalTrailPhotos((prev) => [photo, ...prev.filter((p) => p.id !== photo.id)])
      return
    }
    setMyUnpinnedTrailPhotos((prev) => [photo, ...prev.filter((p) => p.id !== photo.id)])
  }, [])

  const handleAcceptTrailPhoto = useCallback(async (
    photoId: string,
    trailId: string,
    trailLat: number,
    trailLon: number
  ) => {
    if (photoId.startsWith('local-')) {
      setLocalTrailPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId
            ? {
                ...p,
                trailId,
                trailLat,
                trailLon,
                accepted: true,
                lat: trailLat,
                lon: trailLon,
              }
            : p
        )
      )
      setPlacingTrailPhoto(null)
      return
    }

    const res = await fetch(`/api/trail-photos/${photoId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trailId, trailLat, trailLon }),
    })
    const data = await res.json()
    if (data.photo) {
      const updated = data.photo as TrailPhoto
      setMyUnpinnedTrailPhotos((prev) => prev.filter((p) => p.id !== updated.id))
      setCommunityTrailPhotos((prev) => {
        const byId = new Map<string, TrailPhoto>()
        for (const p of prev) byId.set(p.id, p)
        byId.set(updated.id, updated)
        return Array.from(byId.values()).sort((a, b) => {
          const at = new Date(a.createdAt).getTime()
          const bt = new Date(b.createdAt).getTime()
          return bt - at
        })
      })
      setPlacingTrailPhoto(null)
    }
  }, [])

  const handleCloseAnnouncement = useCallback(() => {
    localStorage.setItem(`announcement_dismissed_v${ANNOUNCEMENT_VERSION}`, 'true')
    setShowAnnouncement(false)
  }, [])

  const handleOpenAnnouncement = useCallback(() => {
    setShowAnnouncement(true)
  }, [])

  const handleOpenPhotoLightbox = useCallback((src: string) => {
    setPhotoLightboxSrc(src)
  }, [])

  const handleClosePhotoLightbox = useCallback(() => {
    setPhotoLightboxSrc(null)
  }, [])

  return (
    <div className="flex h-screen relative">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="sm:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Drawer — always visible on desktop, slide-in sheet on mobile */}
      <div className={`${mobileMenuOpen ? 'flex' : 'hidden'} sm:flex fixed top-0 left-0 sm:relative sm:top-auto sm:left-auto z-2000 sm:z-auto h-full`}>
        <LeftDrawer
          user={user}
          rides={rides}
          trails={trails}
          hiddenRideIds={hiddenRideIds}
          onToggleRide={handleToggleRide}
          onHideAllRides={handleHideAllRides}
          onRidesUploaded={handleRidesUploaded}
          onSyncComplete={loadRides}
          editMode={editMode}
          onEditModeChange={handleEditModeChange}
          trimStart={trimStart}
          trimSegment={trimSegment}
          onSaveTrail={handleSaveTrail}
          onStepTrimPoint={handleStepTrimPoint}
          onClearTrimPoint={handleClearTrimPoint}
          averagedTrimPolyline={averagedTrimPolyline}
          averagedRideCount={averagedRideCount}
          onClearAveragedTrim={handleClearAveragedTrim}
          corridorRadiusKm={corridorRadiusKm}
          onCorridorRadiusChange={setCorridorRadiusKm}
          outputSpacingKm={outputSpacingKm}
          onOutputSpacingChange={setOutputSpacingKm}
          selectedTrail={selectedTrail}
          onSelectTrail={setSelectedTrail}
          onSaveEditedTrail={handleSaveEditedTrail}
          onDeleteTrail={handleDeleteTrail}
          refineError={refineError}
          refinedPolyline={refinedPolyline}
          trailEditTool={trailEditTool}
          onSetTrailEditTool={setTrailEditTool}
          canUndoDraw={drawTrailHistoryPast.length > 0}
          canRedoDraw={drawTrailHistoryFuture.length > 0}
          onDrawUndo={handleDrawTrailUndo}
          onDrawRedo={handleDrawTrailRedo}
          onDrawClear={handleDrawTrailClear}
          canUndoRefine={refineTrailHistoryPast.length > 0}
          canRedoRefine={refineTrailHistoryFuture.length > 0}
          onRefineUndo={handleRefineUndo}
          onRefineRedo={handleRefineRedo}
          onRefineClear={handleRefineClear}
          networks={networks}
          hiddenNetworkIds={hiddenNetworkIds}
          onToggleNetwork={handleToggleNetwork}
          selectedNetwork={selectedNetwork}
          drawNetworkPoints={drawNetworkPoints}
          onSelectNetwork={setSelectedNetwork}
          onSaveNetwork={handleSaveNetwork}
          onUpdateNetwork={handleUpdateNetwork}
          onDeleteNetwork={handleDeleteNetwork}
          onStartRedrawNetwork={handleStartRedrawNetwork}
          onOpenAnnouncement={handleOpenAnnouncement}
          highResRideIds={highResRideIds}
          onFetchHighRes={handleFetchHighRes}
          fetchingHighResId={fetchingHighResId}
          hasUnfetchedStravaRides={hasUnfetchedStravaRides}
          onAverageLine={handleAverageLine}
          onFetchHighResForCorridor={handleFetchHighResForCorridor}
          fetchingHighResForCorridor={fetchingHighResForCorridor}
          ridePhotos={ridePhotos}
          photosVisibleRideIds={photosVisibleRideIds}
          fetchingPhotosId={fetchingPhotosId}
          onFetchAndTogglePhotos={handleFetchAndTogglePhotos}
          draftTrails={draftTrails}
          onPublishDraft={handlePublishDraft}
          onDeleteDraft={handleDeleteDraft}
          drawTrailPoints={drawTrailPoints}
          onSaveDrawnTrail={handleSaveDrawnTrail}
          mapBounds={mapBounds}
          showOnMapOnly={showOnMapOnly}
          onToggleShowOnMapOnly={() => setShowOnMapOnly(v => !v)}
          onTrailPhotoCreated={handleTrailPhotoCreated}
          onEnterAddTrailPhoto={handleEnterAddTrailPhoto}
          communityTrailPhotos={communityTrailPhotos}
          unpinnedTrailPhotos={[...myUnpinnedTrailPhotos, ...localTrailPhotos]}
          placingPhoto={placingPhoto}
          placingTrailPhoto={placingTrailPhoto}
          onPlaceRidePhoto={handlePlacePhoto}
          onPlaceTrailPhoto={handlePlaceTrailPhoto}
          onCancelPinOnMap={handleCancelPlace}
          onOpenPhotoLightbox={handleOpenPhotoLightbox}
          onFlyToTrail={requestFlyToTrail}
          onFlyToNetwork={requestFlyToNetwork}
        />
      </div>

      {/* Mobile quick actions — shown when drawer is closed */}
      {!mobileMenuOpen && (
        <div className="sm:hidden fixed top-4 right-4 z-1001 flex items-center gap-2">
          <ThemeToggle className="w-52 shrink-0" size="sm" />
          <button
            type="button"
            className={`rounded-lg border-2 p-2.5 shadow-[2px_2px_0_0_var(--foreground)] transition-colors ${
              editMode === 'add-trail-photo'
                ? 'border-forest bg-forest/15 text-forest'
                : 'border-transparent bg-card text-foreground'
            }`}
            onClick={handleToggleAddTrailPhoto}
            aria-label={editMode === 'add-trail-photo' ? 'Exit add photo mode' : 'Add photo'}
            title={editMode === 'add-trail-photo' ? 'Cancel' : 'Add photo'}
          >
            <FontAwesomeIcon icon={faCamera} className="w-5 h-5" />
          </button>

          <button
            type="button"
            className="rounded-lg border-2 border-foreground bg-card p-2.5 shadow-[2px_2px_0_0_var(--foreground)]"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <FontAwesomeIcon icon={faBars} className="h-5 w-5 text-foreground" />
          </button>
        </div>
      )}

      <LeafletMap
        rides={rides}
        hiddenRideIds={hiddenRideIds}
        trails={trails}
        draftTrails={draftTrails}
        editMode={editMode}
        onEditModeChange={handleEditModeChange}
        canAddTrailPhotos={true}
        photoModeCenter={photoModeCenter}
        trimMode={trimMode}
        trimStart={trimStart}
        trimSegment={trimSegment}
        averagedTrimPolyline={averagedTrimPolyline}
        onTrimPointSelected={handleTrimPointSelected}
        editTrailMode={mapTrailPickMode}
        selectedTrailId={selectedTrail?.id ?? null}
        onTrailSelected={handleTrailSelected}
        refineMode={geometryEditMode}
        refinePolyline={geometryEditMode ? refinedPolyline : null}
        onPolylineRefined={handlePolylineRefined}
        networks={networks}
        hiddenNetworkIds={hiddenNetworkIds}
        drawNetworkMode={drawNetworkMode}
        drawNetworkPoints={drawNetworkPoints}
        onNetworkPointAdded={handleNetworkPointAdded}
        editNetworkMode={editNetworkMode}
        selectedNetworkId={selectedNetwork?.id ?? null}
        onNetworkSelected={setSelectedNetwork}
        ridePhotos={ridePhotos}
        photosVisibleRideIds={photosVisibleRideIds}
        placingPhoto={placingPhoto}
        placingTrailPhoto={placingTrailPhoto}
        onAcceptPhoto={handleAcceptPhoto}
        onCancelPlace={handleCancelPlace}
        trailPhotos={mapTrailPhotos}
        onAcceptTrailPhoto={handleAcceptTrailPhoto}
        drawTrailMode={drawTrailMode}
        drawTrailPoints={drawTrailPoints}
        onDrawTrailPointAdded={handleDrawTrailPointAdded}
        onDrawTrailPointRemoved={handleDrawTrailPointRemoved}
        onDrawTrailInsertAfter={handleDrawTrailInsertAfter}
        onDrawTrailPointMoved={handleDrawTrailPointMoved}
        onBoundsChange={setMapBounds}
        trailEditTool={trailEditTool}
        onRefinePointRemoved={handleRefinePointRemoved}
        onRefineInsertAfter={handleRefineInsertAfter}
        onOpenPhotoLightbox={handleOpenPhotoLightbox}
        flyToRequest={mapFlyToRequest}
      />

      {photoLightboxSrc && (
        <div
          className="fixed inset-0 z-[5005] flex items-center justify-center bg-black/45 p-6 md:p-10"
          role="presentation"
          onClick={handleClosePhotoLightbox}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Full-size photo"
            className="flex max-h-full w-full max-w-[min(96rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-xl border-2 border-border bg-card shadow-[3px_3px_0_0_var(--foreground)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 justify-end border-b-2 border-border px-3 py-2">
              <button
                type="button"
                onClick={handleClosePhotoLightbox}
                className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                aria-label="Close full image"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
              <div className="flex min-h-[12rem] items-center justify-center">
                <img
                  src={photoLightboxSrc}
                  alt=""
                  className="max-h-[min(85vh,calc(100dvh-8rem))] max-w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <AnnouncementModal isOpen={showAnnouncement} onClose={handleCloseAnnouncement} content={ANNOUNCEMENT} />
    </div>
  )
}
