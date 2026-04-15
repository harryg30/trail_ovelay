'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type DiffView = 'before' | 'both' | 'after'

interface RevisionMapDiffProps {
  beforePolyline: [number, number][] | null
  afterPolyline: [number, number][] | null
  view: DiffView
}

export function RevisionMapDiff({ beforePolyline, afterPolyline, view }: RevisionMapDiffProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const beforeLayerRef = useRef<L.Polyline | null>(null)
  const afterLayerRef = useRef<L.Polyline | null>(null)

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      beforeLayerRef.current = null
      afterLayerRef.current = null
    }
  }, [])

  // Update polylines whenever props change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clear existing layers
    beforeLayerRef.current?.remove()
    afterLayerRef.current?.remove()
    beforeLayerRef.current = null
    afterLayerRef.current = null

    const showBefore = (view === 'before' || view === 'both') && beforePolyline && beforePolyline.length > 1
    const showAfter = (view === 'after' || view === 'both') && afterPolyline && afterPolyline.length > 1

    if (showBefore && beforePolyline) {
      beforeLayerRef.current = L.polyline(beforePolyline, {
        color: '#f97316',
        weight: 4,
        opacity: 0.9,
        dashArray: '8 5',
      }).addTo(map)
    }

    if (showAfter && afterPolyline) {
      afterLayerRef.current = L.polyline(afterPolyline, {
        color: '#22c55e',
        weight: 4,
        opacity: 0.9,
      }).addTo(map)
    }

    // Fit bounds to visible polylines
    const visiblePoints: [number, number][] = [
      ...(showBefore && beforePolyline ? beforePolyline : []),
      ...(showAfter && afterPolyline ? afterPolyline : []),
    ]

    if (visiblePoints.length > 0) {
      const bounds = L.latLngBounds(visiblePoints)
      map.fitBounds(bounds, { padding: [24, 24] })
    }
  }, [beforePolyline, afterPolyline, view])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {/* Legend */}
      {beforePolyline && afterPolyline && (
        <div className="absolute bottom-3 left-3 z-[1000] flex flex-col gap-1 rounded-md bg-background/90 border border-border px-2.5 py-2 text-[11px] shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-0.5 bg-orange-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#f97316 0,#f97316 8px,transparent 8px,transparent 13px)' }} />
            <span className="text-muted-foreground">Before</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-0.5 bg-green-500" />
            <span className="text-muted-foreground">After</span>
          </div>
        </div>
      )}
    </div>
  )
}
