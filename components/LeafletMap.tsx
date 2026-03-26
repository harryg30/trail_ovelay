'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Ride, Trail, TrimPoint, TrimSegment, Network, EditMode, RidePhoto } from '@/lib/types'
import { MODE_REGISTRY } from '@/lib/modes'
import { snapToNearestTrailPoint } from '@/lib/geo-utils'

export interface LeafletMapProps {
  rides: Ride[]
  hiddenRideIds: Set<string>
  trails: Trail[]
  editMode: EditMode
  trimMode: boolean
  trimStart: TrimPoint | null
  trimSegment: TrimSegment | null
  averagedTrimPolyline: [number, number][] | null
  onTrimPointSelected: (rideId: string, index: number) => void
  editTrailMode: boolean
  selectedTrailId: string | null
  onTrailSelected: (trail: Trail) => void
  refineMode: boolean
  refinePolyline: [number, number][] | null
  onPolylineRefined: (polyline: [number, number][]) => void
  networks: Network[]
  hiddenNetworkIds: Set<string>
  drawNetworkMode: boolean
  drawNetworkPoints: [number, number][]
  onNetworkPointAdded: (latlng: [number, number]) => void
  editNetworkMode: boolean
  selectedNetworkId: string | null
  onNetworkSelected: (network: Network) => void
  ridePhotos: Record<string, RidePhoto[]>
  photosVisibleRideIds: Set<string>
  placingPhoto: RidePhoto | null
  onAcceptPhoto: (photoId: string, trailId: string, trailLat: number, trailLon: number) => Promise<void>
  onPlacePhoto: (photo: RidePhoto) => void
  onCancelPlace: () => void
}

export default function LeafletMap({
  rides,
  hiddenRideIds,
  trails,
  editMode,
  trimMode,
  trimStart,
  trimSegment,
  averagedTrimPolyline,
  onTrimPointSelected,
  editTrailMode,
  selectedTrailId,
  onTrailSelected,
  refineMode,
  refinePolyline,
  onPolylineRefined,
  networks,
  hiddenNetworkIds,
  drawNetworkMode,
  drawNetworkPoints,
  onNetworkPointAdded,
  editNetworkMode,
  selectedNetworkId,
  onNetworkSelected,
  ridePhotos,
  photosVisibleRideIds,
  placingPhoto,
  onAcceptPhoto,
  onPlacePhoto,
  onCancelPlace,
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
  const averagedTrimLayerRef = useRef<L.LayerGroup | null>(null)
  const hoverLayerRef = useRef<L.LayerGroup | null>(null)
  const photoMarkersLayerRef = useRef<L.LayerGroup | null>(null)

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
  const hasFitBoundsRef = useRef(false)
  const placingPhotoRef = useRef(placingPhoto)
  const onAcceptPhotoRef = useRef(onAcceptPhoto)
  const onCancelPlaceRef = useRef(onCancelPlace)
  const trailsRef = useRef(trails)
  placingPhotoRef.current = placingPhoto
  onAcceptPhotoRef.current = onAcceptPhoto
  onCancelPlaceRef.current = onCancelPlace
  trailsRef.current = trails
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
    averagedTrimLayerRef.current = L.layerGroup().addTo(map)
    hoverLayerRef.current = L.layerGroup().addTo(map)
    photoMarkersLayerRef.current = L.layerGroup().addTo(map)
    selectedTrailLayerRef.current = L.layerGroup().addTo(map)
    refineLayerRef.current = L.layerGroup().addTo(map)
    drawNetworkLayerRef.current = L.layerGroup().addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (placingPhotoRef.current) {
        const { lat, lng } = e.latlng
        const snap = snapToNearestTrailPoint(lat, lng, trailsRef.current)
        const pinLat = snap ? snap.lat : lat
        const pinLon = snap ? snap.lon : lng
        const trailName = snap ? snap.trail.name : null

        const photo = placingPhotoRef.current
        const popupContent = document.createElement('div')
        popupContent.style.cssText = 'display:flex;flex-direction:column;gap:8px;min-width:160px'
        if (photo.thumbnailUrl || photo.blobUrl) {
          const img = document.createElement('img')
          img.src = photo.thumbnailUrl || photo.blobUrl
          img.style.cssText = 'width:160px;height:120px;object-fit:cover;border-radius:4px'
          popupContent.appendChild(img)
        }
        const label = document.createElement('p')
        label.style.cssText = 'font-size:12px;color:#52525b;margin:0'
        label.textContent = snap
          ? `Snap to: ${trailName}`
          : 'No trail nearby — pin at this location'
        popupContent.appendChild(label)
        const btnRow = document.createElement('div')
        btnRow.style.cssText = 'display:flex;gap:6px'
        const acceptBtn = document.createElement('button')
        acceptBtn.textContent = snap ? 'Accept' : 'Pin here'
        acceptBtn.style.cssText = 'flex:1;padding:4px 8px;background:#f59e0b;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer'
        const cancelBtn = document.createElement('button')
        cancelBtn.textContent = 'Cancel'
        cancelBtn.style.cssText = 'padding:4px 8px;border:1px solid #d4d4d8;border-radius:4px;font-size:12px;cursor:pointer;background:#fff'
        btnRow.appendChild(acceptBtn)
        btnRow.appendChild(cancelBtn)
        popupContent.appendChild(btnRow)

        const popup = L.popup({ closeButton: false })
          .setLatLng([pinLat, pinLon])
          .setContent(popupContent)
          .openOn(map)

        acceptBtn.onclick = () => {
          popup.close()
          onAcceptPhotoRef.current(
            photo.id,
            snap?.trail.id ?? '',
            pinLat,
            pinLon
          )
        }
        cancelBtn.onclick = () => {
          popup.close()
          onCancelPlaceRef.current()
        }
        return
      }
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
      averagedTrimLayerRef.current = null
      selectedTrailLayerRef.current = null
      refineLayerRef.current = null
      networksLayerRef.current = null
      drawNetworkLayerRef.current = null
      hoverLayerRef.current = null
      photoMarkersLayerRef.current = null
    }
  }, [])

  // Effect 2: initial fit-to-bounds — fires once when trails first load
  useEffect(() => {
    if (!mapRef.current || hasFitBoundsRef.current || trails.length === 0) return
    const allPoints = trails.flatMap((t) => t.polyline)
    if (allPoints.length === 0) return
    const bounds = L.latLngBounds(allPoints)
    mapRef.current.flyToBounds(bounds, { padding: [40, 40], maxZoom: 15, duration: 1.2 })
    hasFitBoundsRef.current = true
  }, [trails])

  // Effect 3: rides layer
  useEffect(() => {
    if (!mapRef.current || !ridesLayerRef.current) return

    ridesLayerRef.current.clearLayers()

    if (rides.length === 0) return

    rides.filter((r) => !hiddenRideIds.has(r.id)).forEach((ride) => {
      const ridePopupContent = `<strong>${ride.name}</strong><br/>${(ride.distance / 1000).toFixed(1)} km`

      // Visible line — not interactive so the wide hit area beneath handles all events
      L.polyline(ride.polyline, {
        color: '#3b82f6',
        weight: 3,
        dashArray: '8, 6',
        opacity: 0.85,
        interactive: false,
      }).addTo(ridesLayerRef.current!)

      // Wide invisible hit area — much easier to click than the 3px line
      const hitArea = L.polyline(ride.polyline, {
        color: '#3b82f6',
        weight: 20,
        opacity: 0,
        interactive: true,
      })

      const findClosestIdx = (latlng: L.LatLng) => {
        let minDist = Infinity
        let closestIdx = 0
        ride.polyline.forEach(([lat, lng], i) => {
          const d = latlng.distanceTo(L.latLng(lat, lng))
          if (d < minDist) { minDist = d; closestIdx = i }
        })
        return closestIdx
      }

      hitArea.on('mousemove', (e: L.LeafletMouseEvent) => {
        if (!trimModeRef.current) return
        const snapPt = ride.polyline[findClosestIdx(e.latlng)]
        hoverLayerRef.current?.clearLayers()
        L.circleMarker(snapPt, {
          radius: 7,
          color: '#f97316',
          fillColor: '#fff',
          fillOpacity: 1,
          weight: 3,
          interactive: false,
        }).addTo(hoverLayerRef.current!)
      })

      hitArea.on('mouseout', () => {
        if (trimModeRef.current) hoverLayerRef.current?.clearLayers()
      })

      hitArea.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
        if (trimModeRef.current) {
          hoverLayerRef.current?.clearLayers()
          onTrimPointSelectedRef.current(ride.id, findClosestIdx(e.latlng))
          return
        }
        if (editTrailModeRef.current) return
        L.popup().setLatLng(e.latlng).setContent(ridePopupContent).openOn(mapRef.current!)
      })

      hitArea.addTo(ridesLayerRef.current!)
    })

    const allPoints = rides.filter((r) => !hiddenRideIds.has(r.id)).flatMap((r) => r.polyline)
    if (allPoints.length > 0 && !trimModeRef.current && !editTrailModeRef.current) {
      mapRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40] })
    }
  }, [rides, hiddenRideIds])

  // Effect 4: trails layer
  useEffect(() => {
    if (!mapRef.current || !trailsLayerRef.current) return

    trailsLayerRef.current.clearLayers()

    trails.forEach((trail) => {
      const difficultyLabel = trail.difficulty === 'easy' ? '● Green Circle' :
        trail.difficulty === 'intermediate' ? '■ Blue Square' :
        trail.difficulty === 'hard' ? '◆ Black Diamond' :
        trail.difficulty === 'pro' ? '◆◆ Double Black Diamond' : ''
      const trailPopupContent = `<strong>${trail.name}</strong><br/>${difficultyLabel ? difficultyLabel + ' · ' : ''}${trail.distanceKm.toFixed(1)} km`

      const clickHandler = (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
        if (editTrailModeRef.current) {
          onTrailSelectedRef.current(trail)
          return
        }
        if (trimModeRef.current) return
        L.popup().setLatLng(e.latlng).setContent(trailPopupContent).openOn(mapRef.current!)
      }

      const trailColor =
        trail.difficulty === 'easy' ? '#22c55e' :
        trail.difficulty === 'intermediate' ? '#3b82f6' :
        trail.difficulty === 'hard' ? '#18181b' :
        trail.difficulty === 'pro' ? '#18181b' :
        '#f97316'

      const normalWeight = trail.difficulty === 'pro' ? 4 : 3
      const hoverWeight = trail.difficulty === 'pro' ? 7 : 6

      const showHoverMarkers = () => {
        const start = trail.polyline[0]
        const end = trail.polyline[trail.polyline.length - 1]
        hoverLayerRef.current?.clearLayers()
        L.circleMarker(start, { radius: 6, color: '#fff', weight: 2, fillColor: trailColor, fillOpacity: 1, interactive: false })
          .addTo(hoverLayerRef.current!)
        L.circleMarker(end, { radius: 6, color: '#fff', weight: 2, fillColor: trailColor, fillOpacity: 1, interactive: false })
          .addTo(hoverLayerRef.current!)
      }

      const pl = L.polyline(trail.polyline, {
        color: trailColor,
        weight: normalWeight,
        opacity: 0.9,
        interactive: false,
        dashArray: trail.difficulty === 'pro' ? '6 3' : undefined,
      })
      pl.addTo(trailsLayerRef.current!)

      // Wide invisible hit area handles all mouse events for this trail
      // Non-interactive in trim mode so clicks fall through to ride lines beneath
      const hitArea = L.polyline(trail.polyline, {
        color: trailColor,
        weight: 20,
        opacity: 0,
        interactive: !trimMode,
      })
      hitArea.on('click', clickHandler)
      hitArea.on('mouseover', () => { pl.setStyle({ weight: hoverWeight, opacity: 1 }); showHoverMarkers() })
      hitArea.on('mouseout', () => { pl.setStyle({ weight: normalWeight, opacity: 0.9 }); hoverLayerRef.current?.clearLayers() })
      hitArea.addTo(trailsLayerRef.current!)

      // Permanent label at midpoint, rotated to follow the trail
      const midIdx = Math.floor(trail.polyline.length / 2)
      const midPoint = trail.polyline[midIdx]
      const p1 = trail.polyline[Math.max(0, midIdx - 5)]
      const p2 = trail.polyline[Math.min(trail.polyline.length - 1, midIdx + 5)]
      const dy = -(p2[0] - p1[0]) // lat increases upward, screen y increases downward
      const dx = p2[1] - p1[1]
      let labelAngle = Math.atan2(dy, dx) * 180 / Math.PI
      if (labelAngle > 90) labelAngle -= 180
      if (labelAngle < -90) labelAngle += 180
      const diffIcon =
        trail.difficulty === 'easy' ? '●' :
        trail.difficulty === 'intermediate' ? '■' :
        trail.difficulty === 'hard' ? '◆' :
        trail.difficulty === 'pro' ? '◆◆' : ''
      const labelHtml = `<div style="font-size:11px;font-weight:700;white-space:nowrap;pointer-events:none;line-height:1.4;color:#111;transform:rotate(${labelAngle}deg);transform-origin:0 50%;text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff"><span style="color:${trailColor}">${diffIcon}</span>${diffIcon ? '\u00a0' : ''}${trail.name}</div>`
      L.marker(midPoint, {
        icon: L.divIcon({ html: labelHtml, className: '', iconSize: [0, 0], iconAnchor: [0, 0] }),
        interactive: false,
        keyboard: false,
      }).addTo(trailsLayerRef.current!)
    })
  }, [trails, editTrailMode, trimMode])

  // Effect 4: cursor — driven by MODE_REGISTRY so new modes get correct cursors automatically
  useEffect(() => {
    if (!mapRef.current) return
    const cursor = editMode ? (MODE_REGISTRY[editMode]?.cursor ?? '') : ''
    mapRef.current.getContainer().style.cursor = cursor
  }, [editMode])

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

  // Effect 6b: averaged trim candidate
  useEffect(() => {
    if (!averagedTrimLayerRef.current) return
    averagedTrimLayerRef.current.clearLayers()
    if (!averagedTrimPolyline || averagedTrimPolyline.length < 2) return

    L.polyline(averagedTrimPolyline, {
      color: '#d946ef',
      weight: 4,
      dashArray: '10, 6',
      opacity: 0.9,
    }).addTo(averagedTrimLayerRef.current)

    for (const pt of averagedTrimPolyline) {
      L.circleMarker(pt, {
        radius: 2,
        color: '#d946ef',
        fillColor: '#d946ef',
        fillOpacity: 1,
        weight: 0,
      }).addTo(averagedTrimLayerRef.current)
    }
  }, [averagedTrimPolyline])

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
      if (hiddenNetworkIds.has(network.id)) return
      if (network.polygon.length < 3) return
      const isSelected = network.id === selectedNetworkId
      const polygon = L.polygon(network.polygon as L.LatLngExpression[], {
        color: '#3b82f6',
        weight: isSelected ? 3 : 2,
        fillColor: '#3b82f6',
        fillOpacity: isSelected ? 0.25 : 0.1,
        opacity: isSelected ? 1 : 0.7,
        interactive: !trimMode,
      })

      polygon.on('click', (e: L.LeafletMouseEvent) => {
        if (editNetworkModeRef.current) {
          L.DomEvent.stopPropagation(e)
          onNetworkSelectedRef.current(network)
        }
      })

      polygon.addTo(networksLayerRef.current!)
    })
  }, [networks, hiddenNetworkIds, selectedNetworkId, trimMode])

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

  // Effect 10: photo markers
  useEffect(() => {
    if (!photoMarkersLayerRef.current) return

    photoMarkersLayerRef.current.clearLayers()

    for (const [rideId, photos] of Object.entries(ridePhotos)) {
      if (!photosVisibleRideIds.has(rideId)) continue

      for (const photo of photos) {
        // Accepted photos render at their snapped trail position
        const displayLat = photo.accepted && photo.trailLat != null ? photo.trailLat : photo.lat
        const displayLon = photo.accepted && photo.trailLon != null ? photo.trailLon : photo.lon

        if (displayLat == null || displayLon == null) continue

        const thumbSrc = photo.thumbnailUrl || photo.blobUrl
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:36px;height:36px;border-radius:4px;border:2px solid ${photo.accepted ? '#f59e0b' : '#fff'};box-shadow:0 1px 4px rgba(0,0,0,.4);overflow:hidden;background:#d4d4d8">
            <img src="${thumbSrc}" style="width:100%;height:100%;object-fit:cover" />
          </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })

        const marker = L.marker([displayLat, displayLon], { icon })

        if (!photo.accepted) {
          const popupContent = document.createElement('div')
          popupContent.style.cssText = 'display:flex;flex-direction:column;gap:8px;min-width:160px'
          const img = document.createElement('img')
          img.src = thumbSrc
          img.style.cssText = 'width:160px;height:120px;object-fit:cover;border-radius:4px'
          popupContent.appendChild(img)
          const btnRow = document.createElement('div')
          btnRow.style.cssText = 'display:flex;gap:6px'
          const acceptBtn = document.createElement('button')
          acceptBtn.textContent = 'Accept — pin to trail'
          acceptBtn.style.cssText = 'flex:1;padding:4px 8px;background:#f59e0b;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer'
          const dismissBtn = document.createElement('button')
          dismissBtn.textContent = 'Dismiss'
          dismissBtn.style.cssText = 'padding:4px 8px;border:1px solid #d4d4d8;border-radius:4px;font-size:12px;cursor:pointer;background:#fff'
          btnRow.appendChild(acceptBtn)
          btnRow.appendChild(dismissBtn)
          popupContent.appendChild(btnRow)
          marker.bindPopup(popupContent)

          acceptBtn.onclick = () => {
            marker.closePopup()
            const snap = snapToNearestTrailPoint(displayLat, displayLon, trailsRef.current)
            if (snap) {
              onAcceptPhotoRef.current(photo.id, snap.trail.id, snap.lat, snap.lon)
            } else {
              // No trail nearby: accept at current GPS position without trail association
              onAcceptPhotoRef.current(photo.id, '', displayLat, displayLon)
            }
          }
          dismissBtn.onclick = () => marker.closePopup()
        }

        marker.addTo(photoMarkersLayerRef.current!)
      }
    }
  }, [ridePhotos, photosVisibleRideIds])

  // Collect no-GPS unaccepted photos for the floating tray
  const trayPhotos: RidePhoto[] = []
  for (const [rideId, photos] of Object.entries(ridePhotos)) {
    if (!photosVisibleRideIds.has(rideId)) continue
    for (const photo of photos) {
      if (!photo.accepted && photo.lat == null) trayPhotos.push(photo)
    }
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Floating tray for no-GPS photos */}
      {trayPhotos.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-1000 bg-white rounded-lg shadow-lg border border-zinc-200 p-2 flex flex-col gap-2 max-w-xs w-full">
          {placingPhoto ? (
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-xs text-amber-700 font-medium">Click on the map to place this photo</p>
              <button
                type="button"
                onClick={onCancelPlace}
                className="text-xs text-zinc-500 hover:text-zinc-700 shrink-0"
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 px-1">Photos without location — click to place on map</p>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {trayPhotos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => onPlacePhoto(photo)}
                title="Click to place on map"
                className={`shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${
                  placingPhoto?.id === photo.id
                    ? 'border-amber-500 ring-2 ring-amber-300'
                    : 'border-transparent hover:border-amber-400'
                }`}
              >
                <img
                  src={photo.thumbnailUrl || photo.blobUrl}
                  className="w-full h-full object-cover"
                  alt=""
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
