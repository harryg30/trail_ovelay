'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Ride, Trail } from '@/lib/types'

export interface LeafletMapProps {
  rides: Ride[]
  trails: Trail[]
}

export default function LeafletMap({ rides, trails }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const ridesLayerRef = useRef<L.LayerGroup | null>(null)
  const trailsLayerRef = useRef<L.LayerGroup | null>(null)

  // Effect 1: map init — runs once on mount
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current).setView([39.8283, -98.5795], 5)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    ridesLayerRef.current = L.layerGroup().addTo(map)
    trailsLayerRef.current = L.layerGroup().addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      ridesLayerRef.current = null
      trailsLayerRef.current = null
    }
  }, [])

  // Effect 2: rides layer — redraws when rides array changes
  useEffect(() => {
    if (!mapRef.current || !ridesLayerRef.current) return

    ridesLayerRef.current.clearLayers()

    if (rides.length === 0) return

    rides.forEach((ride) => {
      L.polyline(ride.polyline, {
        color: '#3b82f6',
        weight: 3,
        dashArray: '8, 6',
        opacity: 0.85,
      })
        .bindPopup(`<strong>${ride.name}</strong><br/>${(ride.distance / 1000).toFixed(1)} km`)
        .addTo(ridesLayerRef.current!)
    })

    const allPoints = rides.flatMap((r) => r.polyline)
    if (allPoints.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40] })
    }
  }, [rides])

  // Effect 3: trails layer — redraws when trails array changes
  useEffect(() => {
    if (!mapRef.current || !trailsLayerRef.current) return

    trailsLayerRef.current.clearLayers()

    trails.forEach((trail) => {
      L.polyline(trail.polyline, {
        color: '#22c55e',
        weight: 3,
        opacity: 0.9,
      })
        .bindPopup(`<strong>${trail.name}</strong><br/>${trail.difficulty} · ${trail.distanceKm.toFixed(1)} km`)
        .addTo(trailsLayerRef.current!)
    })
  }, [trails])

  return <div ref={containerRef} className="flex-1 h-full" />
}
