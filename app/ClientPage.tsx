'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import LeftDrawer from '@/components/LeftDrawer'
import type { Ride, Trail, TrimPoint, TrimSegment, TrimFormState, SaveTrailResponse, EditMode } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'
import { polylineDistanceKm, estimatedElevationGainFt } from '@/lib/geo-utils'

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

  // Edit state
  const [editMode, setEditMode] = useState<EditMode>(null)
  const trimMode = editMode === 'add-trail'
  const editTrailMode = editMode === 'edit-trail'
  const [trimStart, setTrimStart] = useState<TrimPoint | null>(null)
  const [trimEnd, setTrimEnd] = useState<TrimPoint | null>(null)
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null)

  // Stable ref to read trimEnd inside setTrimStart updater
  const trimEndRef = useRef<TrimPoint | null>(null)
  trimEndRef.current = trimEnd

  useEffect(() => {
    fetch('/api/trails')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setTrails(data.trails)
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!user) return
    fetch('/api/rides')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setRides(data.rides)
      })
      .catch(console.error)
  }, [user])

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

  const handleRidesUploaded = (newRides: Ride[]) => {
    setRides((prev) => [...prev, ...newRides])
  }

  const handleEditModeChange = useCallback((mode: EditMode) => {
    setEditMode(mode)
    if (mode !== 'add-trail') {
      setTrimStart(null)
      setTrimEnd(null)
    }
    if (mode !== 'edit-trail') {
      setSelectedTrail(null)
    }
  }, [])

  const handleTrailSelected = useCallback((trail: Trail) => {
    setSelectedTrail(trail)
  }, [])

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
              polyline: trimSegment.polyline,
              distanceKm: trimSegment.distanceKm,
              elevationGainFt: trimSegment.elevationGainFt,
              source: 'trim',
              sourceRideId: trimSegment.ride.id,
            },
          ],
        }),
      })

      const data: SaveTrailResponse = await res.json()

      if (data.success && data.savedTrails) {
        setTrails((prev) => [...(data.savedTrails ?? []), ...prev])
        setEditMode(null)
        setTrimStart(null)
        setTrimEnd(null)
        return null
      }

      return data.error ?? 'Save failed'
    },
    [trimSegment]
  )

  return (
    <div className="flex h-screen">
      <LeftDrawer
        user={user}
        rides={rides}
        trails={trails}
        onRidesUploaded={handleRidesUploaded}
        editMode={editMode}
        onEditModeChange={handleEditModeChange}
        trimStart={trimStart}
        trimSegment={trimSegment}
        onSaveTrail={handleSaveTrail}
        onStepTrimPoint={handleStepTrimPoint}
        onClearTrimPoint={handleClearTrimPoint}
        selectedTrail={selectedTrail}
        onSelectTrail={setSelectedTrail}
        onUpdateTrail={handleUpdateTrail}
        onDeleteTrail={handleDeleteTrail}
      />
      <LeafletMap
        rides={rides}
        trails={trails}
        trimMode={trimMode}
        trimStart={trimStart}
        trimSegment={trimSegment}
        onTrimPointSelected={handleTrimPointSelected}
        editTrailMode={editTrailMode}
        selectedTrailId={selectedTrail?.id ?? null}
        onTrailSelected={handleTrailSelected}
      />
    </div>
  )
}
