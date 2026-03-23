'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Ride, Trail, TrimPoint, TrimSegment } from '@/lib/types'

export interface LeafletMapProps {
  rides: Ride[]
  trails: Trail[]
  trimMode: boolean
  trimStart: TrimPoint | null
  trimSegment: TrimSegment | null
  onTrimPointSelected: (rideId: string, index: number) => void
  editTrailMode: boolean
  selectedTrailId: string | null
  onTrailSelected: (trail: Trail) => void
}

export default function LeafletMap({
  rides,
  trails,
  trimMode,
  trimStart,
  trimSegment,
  onTrimPointSelected,
  editTrailMode,
  selectedTrailId,
  onTrailSelected,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const ridesLayerRef = useRef<L.LayerGroup | null>(null)
  const trailsLayerRef = useRef<L.LayerGroup | null>(null)
  const trimLayerRef = useRef<L.LayerGroup | null>(null)
  const selectedTrailLayerRef = useRef<L.LayerGroup | null>(null)

  // Mutable refs — updated in component body so click handlers always read current values
  const trimModeRef = useRef(trimMode)
  const editTrailModeRef = useRef(editTrailMode)
  const onTrimPointSelectedRef = useRef(onTrimPointSelected)
  const onTrailSelectedRef = useRef(onTrailSelected)
  const ridesRef = useRef(rides)
  trimModeRef.current = trimMode
  editTrailModeRef.current = editTrailMode
  onTrimPointSelectedRef.current = onTrimPointSelected
  onTrailSelectedRef.current = onTrailSelected
  ridesRef.current = rides

  // Effect 1: map init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current).setView([39.8283, -98.5795], 5)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    ridesLayerRef.current = L.layerGroup().addTo(map)
    trailsLayerRef.current = L.layerGroup().addTo(map)
    trimLayerRef.current = L.layerGroup().addTo(map)
    selectedTrailLayerRef.current = L.layerGroup().addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      ridesLayerRef.current = null
      trailsLayerRef.current = null
      trimLayerRef.current = null
      selectedTrailLayerRef.current = null
    }
  }, [])

  // Effect 2: rides layer
  useEffect(() => {
    if (!mapRef.current || !ridesLayerRef.current) return

    ridesLayerRef.current.clearLayers()

    if (rides.length === 0) return

    rides.forEach((ride) => {
      const pl = L.polyline(ride.polyline, {
        color: '#3b82f6',
        weight: 3,
        dashArray: '8, 6',
        opacity: 0.85,
      }).bindPopup(`<strong>${ride.name}</strong><br/>${(ride.distance / 1000).toFixed(1)} km`)

      pl.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
        if (!trimModeRef.current) return

        let minDist = Infinity
        let closestIdx = 0
        ride.polyline.forEach(([lat, lng], i) => {
          const d = e.latlng.distanceTo(L.latLng(lat, lng))
          if (d < minDist) {
            minDist = d
            closestIdx = i
          }
        })

        onTrimPointSelectedRef.current(ride.id, closestIdx)
      })

      pl.addTo(ridesLayerRef.current!)
    })

    const allPoints = rides.flatMap((r) => r.polyline)
    if (allPoints.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40] })
    }
  }, [rides])

  // Effect 3: trails layer
  useEffect(() => {
    if (!mapRef.current || !trailsLayerRef.current) return

    trailsLayerRef.current.clearLayers()

    trails.forEach((trail) => {
      const pl = L.polyline(trail.polyline, {
        color: '#22c55e',
        weight: 3,
        opacity: 0.9,
      }).bindPopup(
        `<strong>${trail.name}</strong><br/>${trail.difficulty} · ${trail.distanceKm.toFixed(1)} km`
      )

      pl.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
        if (!editTrailModeRef.current) return
        onTrailSelectedRef.current(trail)
      })

      pl.addTo(trailsLayerRef.current!)
    })
  }, [trails])

  // Effect 4: cursor
  useEffect(() => {
    if (!mapRef.current) return
    const cursor = trimMode ? 'crosshair' : editTrailMode ? 'pointer' : ''
    mapRef.current.getContainer().style.cursor = cursor
  }, [trimMode, editTrailMode])

  // Effect 5: start marker (before second point is selected)
  useEffect(() => {
    if (!trimLayerRef.current) return
    if (trimSegment) return // segment preview handles this case

    trimLayerRef.current.clearLayers()

    if (!trimStart) return

    const ride = ridesRef.current.find((r) => r.id === trimStart.rideId)
    if (!ride) return

    L.circleMarker(ride.polyline[trimStart.index], {
      radius: 8,
      color: '#f97316',
      fillColor: '#f97316',
      fillOpacity: 0.9,
      weight: 2,
    })
      .bindTooltip('Start — click to set end point', { permanent: false })
      .addTo(trimLayerRef.current)
  }, [trimStart, trimSegment])

  // Effect 6: segment preview (both points selected)
  useEffect(() => {
    if (!trimLayerRef.current) return
    if (!trimSegment) return

    trimLayerRef.current.clearLayers()

    L.polyline(trimSegment.polyline, {
      color: '#f97316',
      weight: 6,
      opacity: 0.9,
    }).addTo(trimLayerRef.current)

    L.circleMarker(trimSegment.polyline[0], {
      radius: 8,
      color: '#16a34a',
      fillColor: '#16a34a',
      fillOpacity: 1,
      weight: 2,
    })
      .bindTooltip('Start')
      .addTo(trimLayerRef.current)

    L.circleMarker(trimSegment.polyline[trimSegment.polyline.length - 1], {
      radius: 8,
      color: '#dc2626',
      fillColor: '#dc2626',
      fillOpacity: 1,
      weight: 2,
    })
      .bindTooltip('End')
      .addTo(trimLayerRef.current)
  }, [trimSegment])

  // Effect 7: selected trail highlight
  useEffect(() => {
    if (!selectedTrailLayerRef.current) return

    selectedTrailLayerRef.current.clearLayers()

    if (!selectedTrailId) return

    const trail = trails.find((t) => t.id === selectedTrailId)
    if (!trail) return

    L.polyline(trail.polyline, {
      color: '#f97316',
      weight: 6,
      opacity: 0.85,
    }).addTo(selectedTrailLayerRef.current)
  }, [selectedTrailId, trails])

  return <div ref={containerRef} className="flex-1 h-full" />
}
