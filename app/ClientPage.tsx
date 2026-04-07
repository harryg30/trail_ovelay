'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import LeftDrawer from '@/components/LeftDrawer'
import AnnouncementModal from '@/components/AnnouncementModal'
import { ANNOUNCEMENT_VERSION, ANNOUNCEMENT } from '@/lib/announcement'
import type { Ride, Trail, Network, TrimSegment, TrimFormState, SaveTrailResponse, RidePhoto, DraftTrail } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'
import { polylineDistanceKm, estimatedElevationGainFt, generateAveragedTrail, clipPolylineToCorridor } from '@/lib/geo-utils'
import type { MapBounds } from '@/lib/geo-utils'
import { insertPointAfter, removePointAt } from '@/lib/geo-edit'
import { useEditMode } from '@/hooks/useEditMode'
import { loadDemoRides } from '@/lib/demo-rides'

const LeafletMap = dynamic(() => import('@/components/LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 h-full flex items-center justify-center bg-zinc-100">
      <p className="text-zinc-500 text-sm">Loading map...</p>
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
    setDrawTrailPoints((prev) => {
      const next = updater(prev)
      if (polylinesEqual(prev, next)) return prev
      setDrawTrailHistoryPast((past) => [...past, prev])
      setDrawTrailHistoryFuture([])
      return next
    })
  }, [polylinesEqual, setDrawTrailHistoryFuture, setDrawTrailHistoryPast, setDrawTrailPoints])

  const applyRefineTrailEdit = useCallback((updater: (prev: [number, number][]) => [number, number][]) => {
    setRefinedPolyline((prevMaybe) => {
      const prev = prevMaybe ?? (selectedTrail ? [...selectedTrail.polyline] : [])
      const next = updater(prev)
      if (polylinesEqual(prev, next)) return prevMaybe
      setRefineTrailHistoryPast((past) => [...past, prev])
      setRefineTrailHistoryFuture([])
      return next
    })
  }, [polylinesEqual, selectedTrail, setRefineTrailHistoryFuture, setRefineTrailHistoryPast, setRefinedPolyline])

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
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
  const [showOnMapOnly, setShowOnMapOnly] = useState(false)

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
    setDrawTrailHistoryPast((past) => {
      if (past.length === 0) return past
      const prev = past[past.length - 1]
      setDrawTrailHistoryFuture((future) => [drawTrailPoints, ...future])
      setDrawTrailPoints(prev)
      return past.slice(0, -1)
    })
  }, [drawTrailPoints, setDrawTrailHistoryFuture, setDrawTrailHistoryPast, setDrawTrailPoints])

  const handleDrawTrailRedo = useCallback(() => {
    setDrawTrailHistoryFuture((future) => {
      if (future.length === 0) return future
      const next = future[0]
      setDrawTrailHistoryPast((past) => [...past, drawTrailPoints])
      setDrawTrailPoints(next)
      return future.slice(1)
    })
  }, [drawTrailPoints, setDrawTrailHistoryFuture, setDrawTrailHistoryPast, setDrawTrailPoints])

  const handleDrawTrailClear = useCallback(() => {
    applyDrawTrailEdit(() => [])
  }, [applyDrawTrailEdit])

  const handleRefineUndo = useCallback(() => {
    setRefineTrailHistoryPast((past) => {
      if (past.length === 0) return past
      const prev = past[past.length - 1]
      const current = refinedPolyline ?? (selectedTrail ? [...selectedTrail.polyline] : prev)
      setRefineTrailHistoryFuture((future) => [current, ...future])
      setRefinedPolyline(prev)
      return past.slice(0, -1)
    })
  }, [refinedPolyline, selectedTrail, setRefineTrailHistoryFuture, setRefineTrailHistoryPast, setRefinedPolyline])

  const handleRefineRedo = useCallback(() => {
    setRefineTrailHistoryFuture((future) => {
      if (future.length === 0) return future
      const next = future[0]
      const current = refinedPolyline ?? (selectedTrail ? [...selectedTrail.polyline] : next)
      setRefineTrailHistoryPast((past) => [...past, current])
      setRefinedPolyline(next)
      return future.slice(1)
    })
  }, [refinedPolyline, selectedTrail, setRefineTrailHistoryFuture, setRefineTrailHistoryPast, setRefinedPolyline])

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
    setPlacingPhoto(photo)
  }, [])

  const handleCancelPlace = useCallback(() => {
    setPlacingPhoto(null)
  }, [])

  const handleCloseAnnouncement = useCallback(() => {
    localStorage.setItem(`announcement_dismissed_v${ANNOUNCEMENT_VERSION}`, 'true')
    setShowAnnouncement(false)
  }, [])

  const handleOpenAnnouncement = useCallback(() => {
    setShowAnnouncement(true)
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
        />
      </div>

      {/* Hamburger button — mobile only, shown when drawer is closed */}
      {!mobileMenuOpen && (
        <button
          className="sm:hidden fixed top-4 right-4 z-1001 bg-white rounded-lg shadow-md p-2.5"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <LeafletMap
        rides={rides}
        hiddenRideIds={hiddenRideIds}
        trails={trails}
        draftTrails={draftTrails}
        editMode={editMode}
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
        onAcceptPhoto={handleAcceptPhoto}
        onPlacePhoto={handlePlacePhoto}
        onCancelPlace={handleCancelPlace}
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
      />
      <AnnouncementModal isOpen={showAnnouncement} onClose={handleCloseAnnouncement} content={ANNOUNCEMENT} />
    </div>
  )
}
