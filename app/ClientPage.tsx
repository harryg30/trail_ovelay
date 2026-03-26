'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import LeftDrawer from '@/components/LeftDrawer'
import AnnouncementModal from '@/components/AnnouncementModal'
import { ANNOUNCEMENT_VERSION, ANNOUNCEMENT } from '@/lib/announcement'
import type { Ride, Trail, Network, TrimSegment, TrimFormState, SaveTrailResponse, RidePhoto } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'
import { polylineDistanceKm, estimatedElevationGainFt, generateAveragedTrail, clipPolylineToCorridor } from '@/lib/geo-utils'
import { useEditMode } from '@/hooks/useEditMode'

const LeafletMap = dynamic(() => import('@/components/LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 h-full flex items-center justify-center bg-zinc-100">
      <p className="text-zinc-500 text-sm">Loading map...</p>
    </div>
  ),
})

export default function ClientPage({ user }: { user: SessionUser | null }) {
  const [rides, setRides] = useState<Ride[]>([])
  const [trails, setTrails] = useState<Trail[]>([])
  const [networks, setNetworks] = useState<Network[]>([])
  const [hiddenRideIds, setHiddenRideIds] = useState<Set<string>>(new Set())
  const ridesLoadedRef = useRef(false)
  const [hiddenNetworkIds, setHiddenNetworkIds] = useState<Set<string>>(new Set())
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showAnnouncement, setShowAnnouncement] = useState(false)

  useEffect(() => {
    setShowAnnouncement(localStorage.getItem(`announcement_dismissed_v${ANNOUNCEMENT_VERSION}`) !== 'true')
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
    savingRefined, setSavingRefined,
    refineError, setRefineError,
    selectedNetwork, setSelectedNetwork,
    drawNetworkPoints, setDrawNetworkPoints,
  } = useEditMode()

  const trimMode = editMode === 'add-trail'
  const editTrailMode = editMode === 'edit-trail'
  const refineMode = editMode === 'refine-trail'
  const drawNetworkMode = editMode === 'add-network'
  const editNetworkMode = editMode === 'edit-network'

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

  const handleEnterRefineMode = useCallback(() => {
    if (!selectedTrail) return
    setRefinedPolyline([...selectedTrail.polyline])
    setRefineError(null)
    setMode('refine-trail')
  }, [selectedTrail])

  const handlePolylineRefined = useCallback((polyline: [number, number][]) => {
    setRefinedPolyline([...polyline])
  }, [])

  const handleSaveRefinedTrail = useCallback(async () => {
    if (!selectedTrail || !refinedPolyline) return
    setSavingRefined(true)
    setRefineError(null)
    try {
      const res = await fetch(`/api/trails/${selectedTrail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedTrail.name,
          difficulty: selectedTrail.difficulty,
          direction: selectedTrail.direction,
          notes: selectedTrail.notes,
          polyline: refinedPolyline,
          distanceKm: refinedPolyline.length > 1
            ? (await import('@/lib/geo-utils')).polylineDistanceKm(refinedPolyline)
            : selectedTrail.distanceKm,
        }),
      })
      const data = await res.json()
      if (data.success && data.trail) {
        setTrails((prev) => prev.map((t) => (t.id === data.trail.id ? data.trail : t)))
        setSelectedTrail(data.trail)
        setRefinedPolyline(null)
        setMode('edit-trail')
      } else {
        setRefineError(data.error ?? 'Save failed')
      }
    } catch {
      setRefineError('Network error')
    } finally {
      setSavingRefined(false)
    }
  }, [selectedTrail, refinedPolyline])

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

  const handleUpdateTrail = useCallback(
    async (form: TrimFormState): Promise<string | null> => {
      if (!selectedTrail) return 'No trail selected'

      const res = await fetch(`/api/trails/${selectedTrail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          difficulty: form.difficulty,
          direction: form.direction,
          notes: form.notes || undefined,
        }),
      })

      const data = await res.json()

      if (data.success && data.trail) {
        setTrails((prev) => prev.map((t) => (t.id === data.trail.id ? data.trail : t)))
        setSelectedTrail(null)
        return null
      }

      return data.error ?? 'Update failed'
    },
    [selectedTrail]
  )

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
    async (form: TrimFormState): Promise<string | null> => {
      if (!trimSegment) return 'No segment selected'

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
              polyline: averagedTrimPolyline ?? trimSegment.polyline,
              distanceKm: averagedTrimPolyline
                ? polylineDistanceKm(averagedTrimPolyline)
                : trimSegment.distanceKm,
              elevationGainFt: trimSegment.elevationGainFt,
              source: averagedTrimPolyline ? 'averaged' : 'trim',
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
    [trimSegment, networks]
  )

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
          onUpdateTrail={handleUpdateTrail}
          onDeleteTrail={handleDeleteTrail}
          onEnterRefineMode={handleEnterRefineMode}
          onSaveRefinedTrail={handleSaveRefinedTrail}
          savingRefined={savingRefined}
          refineError={refineError}
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
        editMode={editMode}
        trimMode={trimMode}
        trimStart={trimStart}
        trimSegment={trimSegment}
        averagedTrimPolyline={averagedTrimPolyline}
        onTrimPointSelected={handleTrimPointSelected}
        editTrailMode={editTrailMode}
        selectedTrailId={selectedTrail?.id ?? null}
        onTrailSelected={handleTrailSelected}
        refineMode={refineMode}
        refinePolyline={refineMode ? (refinedPolyline ?? selectedTrail?.polyline ?? null) : null}
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
      />
      <AnnouncementModal isOpen={showAnnouncement} onClose={handleCloseAnnouncement} content={ANNOUNCEMENT} />
    </div>
  )
}
