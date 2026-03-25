'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Ride, Trail, TrimPoint, TrimSegment, Network } from '@/lib/types'

export interface LeafletMapProps {
  rides: Ride[]
  hiddenRideIds: Set<string>
  trails: Trail[]
  trimMode: boolean
  trimStart: TrimPoint | null
  trimSegment: TrimSegment | null
  onTrimPointSelected: (rideId: string, index: number) => void
  editTrailMode: boolean
  selectedTrailId: string | null
  onTrailSelected: (trail: Trail) => void
  refineMode: boolean
  refinePolyline: [number, number][] | null
  onPolylineRefined: (polyline: [number, number][]) => void
  networks: Network[]
  drawNetworkMode: boolean
  drawNetworkPoints: [number, number][]
  onNetworkPointAdded: (latlng: [number, number]) => void
  editNetworkMode: boolean
  selectedNetworkId: string | null
  onNetworkSelected: (network: Network) => void
}

export default function LeafletMap({
  rides,
  hiddenRideIds,
  trails,
  trimMode,
  trimStart,
  trimSegment,
  onTrimPointSelected,
  editTrailMode,
  selectedTrailId,
  onTrailSelected,
  refineMode,
  refinePolyline,
  onPolylineRefined,
  networks,
  drawNetworkMode,
  drawNetworkPoints,
  onNetworkPointAdded,
  editNetworkMode,
  selectedNetworkId,
  onNetworkSelected,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const ridesLayerRef = useRef<L.LayerGroup | null>(null)
  const trailsLayerRef = useRef<L.LayerGroup | null>(null)
  const trimLayerRef = useRef<L.LayerGroup | null>(null)
  const selectedTrailLayerRef = useRef<L.LayerGroup | null>(null)
  const refineLayerRef = useRef<L.LayerGroup | null>(null)
  const networksLayerRef = useRef<L.LayerGroup | null>(null)
  const drawNetworkLayerRef = useRef<L.LayerGroup | null>(null)

  // Mutable refs — updated in component body so click handlers always read current values
  const trimModeRef = useRef(trimMode)
  const editTrailModeRef = useRef(editTrailMode)
  const onTrimPointSelectedRef = useRef(onTrimPointSelected)
  const onTrailSelectedRef = useRef(onTrailSelected)
  const onPolylineRefinedRef = useRef(onPolylineRefined)
  const ridesRef = useRef(rides)
  const drawNetworkModeRef = useRef(drawNetworkMode)
  const editNetworkModeRef = useRef(editNetworkMode)
  const onNetworkPointAddedRef = useRef(onNetworkPointAdded)
  const onNetworkSelectedRef = useRef(onNetworkSelected)
  const networksRef = useRef(networks)
  trimModeRef.current = trimMode
  editTrailModeRef.current = editTrailMode
  onTrimPointSelectedRef.current = onTrimPointSelected
  onTrailSelectedRef.current = onTrailSelected
  onPolylineRefinedRef.current = onPolylineRefined
  ridesRef.current = rides
  drawNetworkModeRef.current = drawNetworkMode
  editNetworkModeRef.current = editNetworkMode
  onNetworkPointAddedRef.current = onNetworkPointAdded
  onNetworkSelectedRef.current = onNetworkSelected
  networksRef.current = networks

  // Effect 1: map init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current).setView([39.8283, -98.5795], 5)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    networksLayerRef.current = L.layerGroup().addTo(map)
    ridesLayerRef.current = L.layerGroup().addTo(map)
    trailsLayerRef.current = L.layerGroup().addTo(map)
    trimLayerRef.current = L.layerGroup().addTo(map)
    selectedTrailLayerRef.current = L.layerGroup().addTo(map)
    refineLayerRef.current = L.layerGroup().addTo(map)
    drawNetworkLayerRef.current = L.layerGroup().addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (drawNetworkModeRef.current) {
        onNetworkPointAddedRef.current([e.latlng.lat, e.latlng.lng])
      }
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      ridesLayerRef.current = null
      trailsLayerRef.current = null
      trimLayerRef.current = null
      selectedTrailLayerRef.current = null
      refineLayerRef.current = null
      networksLayerRef.current = null
      drawNetworkLayerRef.current = null
    }
  }, [])

  // Effect 2: rides layer
  useEffect(() => {
    if (!mapRef.current || !ridesLayerRef.current) return

    ridesLayerRef.current.clearLayers()

    if (rides.length === 0) return

    rides.filter((r) => !hiddenRideIds.has(r.id)).forEach((ride) => {
      const ridePopupContent = `<strong>${ride.name}</strong><br/>${(ride.distance / 1000).toFixed(1)} km`
      const pl = L.polyline(ride.polyline, {
        color: '#3b82f6',
        weight: 3,
        dashArray: '8, 6',
        opacity: 0.85,
      })

      pl.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
        if (trimModeRef.current) {
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
          return
        }
        if (editTrailModeRef.current) return
        L.popup().setLatLng(e.latlng).setContent(ridePopupContent).openOn(mapRef.current!)
      })

      pl.addTo(ridesLayerRef.current!)
    })

    const allPoints = rides.filter((r) => !hiddenRideIds.has(r.id)).flatMap((r) => r.polyline)
    if (allPoints.length > 0 && !trimModeRef.current && !editTrailModeRef.current) {
      mapRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40] })
    }
  }, [rides, hiddenRideIds])

  // Effect 3: trails layer
  useEffect(() => {
    if (!mapRef.current || !trailsLayerRef.current) return

    trailsLayerRef.current.clearLayers()

    trails.forEach((trail) => {
      const trailPopupContent = `<strong>${trail.name}</strong><br/>${trail.difficulty} · ${trail.distanceKm.toFixed(1)} km`
      const pl = L.polyline(trail.polyline, {
        color: '#22c55e',
        weight: 3,
        opacity: 0.9,
      })

      pl.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
        if (editTrailModeRef.current) {
          onTrailSelectedRef.current(trail)
          return
        }
        if (trimModeRef.current) return
        L.popup().setLatLng(e.latlng).setContent(trailPopupContent).openOn(mapRef.current!)
      })

      pl.addTo(trailsLayerRef.current!)
    })
  }, [trails])

  // Effect 4: cursor
  useEffect(() => {
    if (!mapRef.current) return
    const cursor = trimMode || drawNetworkMode ? 'crosshair' : editTrailMode || editNetworkMode ? 'pointer' : ''
    mapRef.current.getContainer().style.cursor = cursor
  }, [trimMode, editTrailMode, drawNetworkMode, editNetworkMode])

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

  // Effect 7: refine mode — draggable nodes
  useEffect(() => {
    if (!refineLayerRef.current || !mapRef.current) return
    refineLayerRef.current.clearLayers()
    if (!refineMode || !refinePolyline || refinePolyline.length < 2) return

    // Working copy mutated during drag
    const pts: [number, number][] = refinePolyline.map(([lat, lng]) => [lat, lng])

    const pl = L.polyline(pts as L.LatLngExpression[], {
      color: '#f97316',
      weight: 4,
      opacity: 1,
    }).addTo(refineLayerRef.current)

    const nodeIcon = L.divIcon({
      className: '',
      html: '<div style="width:10px;height:10px;background:#f97316;border:2px solid white;border-radius:50%;cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,.5)"></div>',
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    })

    pts.forEach((pt, i) => {
      const marker = L.marker(pt as L.LatLngExpression, {
        draggable: true,
        icon: nodeIcon,
        zIndexOffset: 1000,
      }).addTo(refineLayerRef.current!)

      marker.on('drag', () => {
        const { lat, lng } = marker.getLatLng()
        pts[i] = [lat, lng]
        pl.setLatLngs(pts as L.LatLngExpression[])
      })

      marker.on('dragend', () => {
        onPolylineRefinedRef.current([...pts])
      })
    })
  }, [refineMode, refinePolyline])

  // Effect 8: networks layer
  useEffect(() => {
    if (!networksLayerRef.current) return
    networksLayerRef.current.clearLayers()

    networks.forEach((network) => {
      if (network.polygon.length < 3) return
      const isSelected = network.id === selectedNetworkId
      const polygon = L.polygon(network.polygon as L.LatLngExpression[], {
        color: '#3b82f6',
        weight: isSelected ? 3 : 2,
        fillColor: '#3b82f6',
        fillOpacity: isSelected ? 0.25 : 0.1,
        opacity: isSelected ? 1 : 0.7,
      })

      polygon.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
        if (editNetworkModeRef.current) {
          onNetworkSelectedRef.current(network)
        }
      })

      polygon.bindTooltip(network.name, { permanent: false, sticky: true })
      polygon.addTo(networksLayerRef.current!)
    })
  }, [networks, selectedNetworkId])

  // Effect: draw network polygon preview
  useEffect(() => {
    if (!drawNetworkLayerRef.current) return
    drawNetworkLayerRef.current.clearLayers()
    if (!drawNetworkMode || drawNetworkPoints.length === 0) return

    const nodeIcon = L.divIcon({
      className: '',
      html: '<div style="width:10px;height:10px;background:#f97316;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.5)"></div>',
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    })

    drawNetworkPoints.forEach((pt) => {
      L.marker(pt as L.LatLngExpression, { icon: nodeIcon }).addTo(drawNetworkLayerRef.current!)
    })

    if (drawNetworkPoints.length >= 2) {
      // Preview polyline connecting placed points
      L.polyline(drawNetworkPoints as L.LatLngExpression[], {
        color: '#f97316',
        weight: 2,
        dashArray: '6, 4',
        opacity: 0.8,
      }).addTo(drawNetworkLayerRef.current!)
    }

    if (drawNetworkPoints.length >= 3) {
      // Closing dash back to first point
      L.polyline([drawNetworkPoints[drawNetworkPoints.length - 1], drawNetworkPoints[0]] as L.LatLngExpression[], {
        color: '#f97316',
        weight: 1,
        dashArray: '4, 6',
        opacity: 0.5,
      }).addTo(drawNetworkLayerRef.current!)
    }
  }, [drawNetworkMode, drawNetworkPoints])

  // Effect 9: selected trail highlight
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

    mapRef.current?.flyToBounds(L.latLngBounds(trail.polyline), { padding: [60, 60], duration: 0.6 })
  }, [selectedTrailId, trails])

  return <div ref={containerRef} className="w-full h-full" />
}
