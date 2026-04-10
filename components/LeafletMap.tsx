'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type {
  Ride,
  Trail,
  DraftTrail,
  TrimPoint,
  TrimSegment,
  Network,
  EditMode,
  RidePhoto,
  TrailPhoto,
  OfficialMapLayerPayload,
} from '@/lib/types'
import { imagePixelToLatLng } from '@/lib/map-overlay-transform'
import type { TrailEditTool } from '@/lib/modes/types'
import { resolveMapCursor } from '@/lib/modes/map-cursor'
import { longestPolygonEdgeMidpoint, snapToNearestTrailPoint } from '@/lib/geo-utils'
import {
  MAP,
  basemapControlSvg,
  catalogLineHints,
  drawNetworkNodeDivHtml,
  drawTrailNodeDivHtml,
  locateControlSvg,
  mapPopupStyles,
  networkEdgeLabelHtml,
  networkPolygonLeafletStyle,
  refineMidpointDivHtml,
  refineNodeDivHtml,
  rideLineColor,
  trailLineColor,
  trailMidpointLabelHtml,
} from '@/lib/map-theme'
import {
  getBasemapLayerOptions,
  getMapBaseStyle,
  readStoredBasemapStyle,
  writeStoredBasemapStyle,
  type MapBaseStyle,
} from '@/lib/map-basemap'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera } from '@fortawesome/free-solid-svg-icons'

/** Screen-space rotation for text along edge AB; flip 180° so labels stay upright. */
function networkPolygonEdgeLabelRotationDeg(
  map: L.Map,
  a: [number, number],
  b: [number, number]
): number {
  const p1 = map.latLngToLayerPoint(L.latLng(a[0], a[1]))
  const p2 = map.latLngToLayerPoint(L.latLng(b[0], b[1]))
  let deg = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI
  if (deg > 90) deg -= 180
  if (deg < -90) deg += 180
  return deg
}

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
  onNetworkDrawPointRemoved: (index: number) => void
  onNetworkDrawInsertAfter: (indexBefore: number, latlng: [number, number]) => void
  onNetworkDrawPointMoved: (index: number, latlng: [number, number]) => void
  editNetworkMode: boolean
  selectedNetworkId: string | null
  onNetworkSelected: (network: Network) => void
  ridePhotos: Record<string, RidePhoto[]>
  photosVisibleRideIds: Set<string>
  placingPhoto: RidePhoto | null
  placingTrailPhoto: TrailPhoto | null
  onAcceptPhoto: (photoId: string, trailId: string, trailLat: number, trailLon: number) => Promise<void>
  onCancelPlace: () => void
  trailPhotos: TrailPhoto[]
  onAcceptTrailPhoto: (photoId: string, trailId: string, trailLat: number, trailLon: number) => Promise<void>
  onEditModeChange?: (mode: EditMode) => void
  draftTrails: DraftTrail[]
  drawTrailMode: boolean
  drawTrailPoints: [number, number][]
  onDrawTrailPointAdded: (latlng: [number, number]) => void
  onDrawTrailPointRemoved: (index: number) => void
  onDrawTrailInsertAfter: (indexBefore: number, latlng: [number, number]) => void
  onDrawTrailPointMoved: (index: number, latlng: [number, number]) => void
  trailEditTool: TrailEditTool
  onRefinePointRemoved: (index: number) => void
  onRefineInsertAfter: (indexBefore: number, latlng: [number, number]) => void
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void
  onOpenPhotoLightbox?: (src: string) => void
  /** Increment `seq` on each request so repeated fly-to on the same id runs again. */
  flyToRequest?: { seq: number; kind: 'trail' | 'network'; id: string } | null
  officialMapLayer?: OfficialMapLayerPayload | null
  officialMapAlignHandler?: null | ((latlng: [number, number]) => void)
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
  onNetworkDrawPointRemoved,
  onNetworkDrawInsertAfter,
  onNetworkDrawPointMoved,
  editNetworkMode,
  selectedNetworkId,
  onNetworkSelected,
  ridePhotos,
  photosVisibleRideIds,
  placingPhoto,
  placingTrailPhoto,
  onAcceptPhoto,
  onCancelPlace,
  trailPhotos,
  onAcceptTrailPhoto,
  onEditModeChange,
  draftTrails,
  drawTrailMode,
  drawTrailPoints,
  onDrawTrailPointAdded,
  onDrawTrailPointRemoved,
  onDrawTrailInsertAfter,
  onDrawTrailPointMoved,
  trailEditTool,
  onRefinePointRemoved,
  onRefineInsertAfter,
  onBoundsChange,
  onOpenPhotoLightbox,
  flyToRequest,
  officialMapLayer = null,
  officialMapAlignHandler = null,
}: LeafletMapProps) {
  /** Phases where the base_map should own clicks (not background trails/networks/rides). */
  const mapDrawingSurface = drawTrailMode || refineMode || drawNetworkMode

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const basemapLayerRef = useRef<L.TileLayer | null>(null)
  const locateControlRef = useRef<L.Control | null>(null)
  const userLocationLayerRef = useRef<L.LayerGroup | null>(null)
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
  const trailPhotoMarkersLayerRef = useRef<L.LayerGroup | null>(null)
  const draftTrailsLayerRef = useRef<L.LayerGroup | null>(null)
  const drawTrailLayerRef = useRef<L.LayerGroup | null>(null)

  const [zoom, setZoom] = useState(5)
  /** Bumps on pan so network edge labels recompute screen rotation against the map view. */
  const [mapLayoutEpoch, setMapLayoutEpoch] = useState(0)
  const [basemapStyle, setBasemapStyle] = useState<MapBaseStyle>(getMapBaseStyle)
  const basemapStyleRef = useRef(basemapStyle)
  basemapStyleRef.current = basemapStyle
  const LABEL_ZOOM_THRESHOLD = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 14 : 15
  const isCoarsePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number; accuracyM?: number } | null>(null)

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
  const onNetworkDrawPointRemovedRef = useRef(onNetworkDrawPointRemoved)
  const onNetworkDrawInsertAfterRef = useRef(onNetworkDrawInsertAfter)
  const onNetworkDrawPointMovedRef = useRef(onNetworkDrawPointMoved)
  const onNetworkSelectedRef = useRef(onNetworkSelected)
  const networksRef = useRef(networks)
  const drawTrailModeRef = useRef(drawTrailMode)
  const onDrawTrailPointAddedRef = useRef(onDrawTrailPointAdded)
  const onDrawTrailPointRemovedRef = useRef(onDrawTrailPointRemoved)
  const onDrawTrailInsertAfterRef = useRef(onDrawTrailInsertAfter)
  const onDrawTrailPointMovedRef = useRef(onDrawTrailPointMoved)
  const trailEditToolRef = useRef<TrailEditTool>(trailEditTool)
  const refineModeRef = useRef(refineMode)
  const onRefinePointRemovedRef = useRef(onRefinePointRemoved)
  const onRefineInsertAfterRef = useRef(onRefineInsertAfter)
  const hasFitBoundsRef = useRef(false)
  const onBoundsChangeRef = useRef(onBoundsChange)
  onBoundsChangeRef.current = onBoundsChange
  const placingPhotoRef = useRef(placingPhoto)
  const placingTrailPhotoRef = useRef(placingTrailPhoto)
  const onAcceptPhotoRef = useRef(onAcceptPhoto)
  const onCancelPlaceRef = useRef(onCancelPlace)
  const trailsRef = useRef(trails)
  placingPhotoRef.current = placingPhoto
  placingTrailPhotoRef.current = placingTrailPhoto
  onAcceptPhotoRef.current = onAcceptPhoto
  onCancelPlaceRef.current = onCancelPlace
  trailsRef.current = trails
  const onAcceptTrailPhotoRef = useRef(onAcceptTrailPhoto)
  onAcceptTrailPhotoRef.current = onAcceptTrailPhoto
  const onOpenPhotoLightboxRef = useRef(onOpenPhotoLightbox)
  onOpenPhotoLightboxRef.current = onOpenPhotoLightbox
  const officialMapLayerRef = useRef(officialMapLayer)
  officialMapLayerRef.current = officialMapLayer
  const officialMapAlignHandlerRef = useRef(officialMapAlignHandler)
  officialMapAlignHandlerRef.current = officialMapAlignHandler
  trimModeRef.current = trimMode
  editTrailModeRef.current = editTrailMode
  onTrimPointSelectedRef.current = onTrimPointSelected
  onTrailSelectedRef.current = onTrailSelected
  onPolylineRefinedRef.current = onPolylineRefined
  ridesRef.current = rides
  drawNetworkModeRef.current = drawNetworkMode
  editNetworkModeRef.current = editNetworkMode
  onNetworkPointAddedRef.current = onNetworkPointAdded
  onNetworkDrawPointRemovedRef.current = onNetworkDrawPointRemoved
  onNetworkDrawInsertAfterRef.current = onNetworkDrawInsertAfter
  onNetworkDrawPointMovedRef.current = onNetworkDrawPointMoved
  onNetworkSelectedRef.current = onNetworkSelected
  networksRef.current = networks
  drawTrailModeRef.current = drawTrailMode
  onDrawTrailPointAddedRef.current = onDrawTrailPointAdded
  onDrawTrailPointRemovedRef.current = onDrawTrailPointRemoved
  onDrawTrailInsertAfterRef.current = onDrawTrailInsertAfter
  onDrawTrailPointMovedRef.current = onDrawTrailPointMoved
  trailEditToolRef.current = trailEditTool
  refineModeRef.current = refineMode
  onRefinePointRemovedRef.current = onRefinePointRemoved
  onRefineInsertAfterRef.current = onRefineInsertAfter

  /** Classic vs Catalog only changes tile CSS (`data-basemap`); both use the same OSM layer. */
  const applyBasemapStyle = useCallback((next: MapBaseStyle) => {
    const el = containerRef.current
    if (!el) return
    el.dataset.basemap = next
    setBasemapStyle(next)
    writeStoredBasemapStyle(next)
  }, [])

  const applyBasemapStyleRef = useRef(applyBasemapStyle)
  applyBasemapStyleRef.current = applyBasemapStyle

  /** Locate + basemap tools under native zoom; basemap panel lists styles and persists via {@link writeStoredBasemapStyle}. */
  const installTopLeftToolControls = useCallback((map: L.Map) => {
    const ctl = L.Control.extend({
      onAdd(this: L.Control) {
        const p = MAP
        const wrap = L.DomUtil.create('div')
        wrap.style.cssText =
          'margin-top:44px;display:flex;flex-direction:column;align-items:flex-start;gap:4px'

        const locateBtn = L.DomUtil.create('button', '', wrap) as HTMLButtonElement
        locateBtn.type = 'button'
        locateBtn.title = 'Zoom to my location'
        locateBtn.setAttribute('aria-label', 'Zoom to my location')
        locateBtn.style.cssText =
          `width:30px;height:30px;border-radius:4px;background:${p.card};border:2px solid ${p.foreground};` +
          `box-shadow:2px 2px 0 0 ${p.foreground};cursor:pointer;display:flex;align-items:center;justify-content:center`
        locateBtn.innerHTML = locateControlSvg(p)

        const basemapOuter = L.DomUtil.create('div', '', wrap)
        basemapOuter.style.cssText = 'position:relative'

        const basemapToggle = L.DomUtil.create('button', '', basemapOuter) as HTMLButtonElement
        basemapToggle.type = 'button'
        basemapToggle.title = 'Base map style'
        basemapToggle.setAttribute('aria-label', 'Base map style')
        basemapToggle.setAttribute('aria-expanded', 'false')
        basemapToggle.setAttribute('aria-haspopup', 'true')
        basemapToggle.style.cssText =
          `width:30px;height:30px;border-radius:4px;background:${p.card};border:2px solid ${p.foreground};` +
          `box-shadow:2px 2px 0 0 ${p.foreground};cursor:pointer;display:flex;align-items:center;justify-content:center`
        basemapToggle.innerHTML = basemapControlSvg(p)

        const panel = L.DomUtil.create('div', '', basemapOuter) as HTMLDivElement
        panel.setAttribute('role', 'group')
        panel.setAttribute('aria-label', 'Choose base map style')
        panel.style.cssText =
          `display:none;flex-direction:column;gap:6px;position:absolute;top:34px;left:0;z-index:1000;min-width:152px;` +
          `padding:8px;border-radius:4px;background:${p.card};border:2px solid ${p.foreground};box-shadow:2px 2px 0 0 ${p.foreground}`

        const heading = L.DomUtil.create('div', '', panel) as HTMLDivElement
        heading.textContent = 'Base map'
        heading.style.cssText = `font:600 10px/1.2 system-ui,sans-serif;text-transform:uppercase;letter-spacing:0.06em;color:${p.mutedLabel}`

        const row = L.DomUtil.create('div', '', panel) as HTMLDivElement
        row.style.cssText = 'display:flex;gap:4px'

        const classicBtn = L.DomUtil.create('button', '', row) as HTMLButtonElement
        classicBtn.type = 'button'
        classicBtn.textContent = 'Classic'

        const catalogBtn = L.DomUtil.create('button', '', row) as HTMLButtonElement
        catalogBtn.type = 'button'
        catalogBtn.textContent = 'Catalog'

        const btnBase =
          `flex:1;border-radius:4px;border:2px solid ${p.foreground};cursor:pointer;` +
          `font:700 11px/1 system-ui,sans-serif;text-transform:uppercase;letter-spacing:0.04em;padding:6px 6px`

        const applySelection = (style: MapBaseStyle) => {
          const classicSel = style === 'osm'
          classicBtn.style.cssText =
            btnBase +
            `;background:${classicSel ? p.primary : p.mud};color:${classicSel ? p.primaryFg : p.foreground}` +
            (classicSel ? `;box-shadow:1px 1px 0 0 ${p.foreground}` : '')
          catalogBtn.style.cssText =
            btnBase +
            `;background:${!classicSel ? p.primary : p.mud};color:${!classicSel ? p.primaryFg : p.foreground}` +
            (!classicSel ? `;box-shadow:1px 1px 0 0 ${p.foreground}` : '')
        }
        applySelection(basemapStyleRef.current)

        const closePanel = () => {
          panel.style.display = 'none'
          basemapToggle.setAttribute('aria-expanded', 'false')
        }
        const openPanel = () => {
          applySelection(basemapStyleRef.current)
          panel.style.display = 'flex'
          basemapToggle.setAttribute('aria-expanded', 'true')
        }

        const onMapClick = () => {
          closePanel()
        }
        map.on('click', onMapClick)

        // Store for onRemove (Leaflet may use a different `this` context)
        ;(this as unknown as { _trailOnMapClick?: () => void })._trailOnMapClick = onMapClick

        basemapToggle.onclick = (ev) => {
          L.DomEvent.stopPropagation(ev)
          if (panel.style.display === 'flex') closePanel()
          else openPanel()
        }

        classicBtn.onclick = (ev) => {
          L.DomEvent.stopPropagation(ev)
          applyBasemapStyleRef.current('osm')
          applySelection('osm')
          closePanel()
        }
        catalogBtn.onclick = (ev) => {
          L.DomEvent.stopPropagation(ev)
          applyBasemapStyleRef.current('stylized')
          applySelection('stylized')
          closePanel()
        }

        locateBtn.onclick = () => {
          if (!('geolocation' in navigator)) return
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lat = pos.coords.latitude
              const lon = pos.coords.longitude
              const accuracyM = pos.coords.accuracy
              setUserLocation({ lat, lon, accuracyM })
              mapRef.current?.flyTo([lat, lon], Math.max(mapRef.current.getZoom(), 15), { duration: 0.8 })
            },
            () => {
              /* ignore */
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 15_000 }
          )
        }

        L.DomEvent.disableClickPropagation(wrap)
        L.DomEvent.disableScrollPropagation(wrap)

        return wrap
      },
      onRemove(this: L.Control) {
        const h = (this as unknown as { _trailOnMapClick?: () => void })._trailOnMapClick
        if (h) map.off('click', h)
      },
    })
    const instance = new ctl({ position: 'topleft' })
    instance.addTo(map)
    return instance
  }, [])

  // Effect 1: map init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const baseStyle = readStoredBasemapStyle() ?? getMapBaseStyle()
    containerRef.current.dataset.basemap = baseStyle
    setBasemapStyle(baseStyle)
    basemapStyleRef.current = baseStyle

    const map = L.map(containerRef.current).setView([39.8283, -98.5795], 5)

    // Panes to ensure stable layer ordering (networks always below everything else).
    const networksPane = map.createPane('networksPane')
    networksPane.style.zIndex = '200'

    const basemap = getBasemapLayerOptions(baseStyle)
    basemapLayerRef.current = L.tileLayer(basemap.url, {
      attribution: basemap.attribution,
      maxZoom: basemap.maxZoom,
      ...(basemap.subdomains != null ? { subdomains: basemap.subdomains } : {}),
    }).addTo(map)

    networksLayerRef.current = L.layerGroup().addTo(map)
    ridesLayerRef.current = L.layerGroup().addTo(map)
    trailsLayerRef.current = L.layerGroup().addTo(map)
    trimLayerRef.current = L.layerGroup().addTo(map)
    averagedTrimLayerRef.current = L.layerGroup().addTo(map)
    hoverLayerRef.current = L.layerGroup().addTo(map)
    photoMarkersLayerRef.current = L.layerGroup().addTo(map)
    trailPhotoMarkersLayerRef.current = L.layerGroup().addTo(map)
    userLocationLayerRef.current = L.layerGroup().addTo(map)
    selectedTrailLayerRef.current = L.layerGroup().addTo(map)
    refineLayerRef.current = L.layerGroup().addTo(map)
    drawNetworkLayerRef.current = L.layerGroup().addTo(map)
    draftTrailsLayerRef.current = L.layerGroup().addTo(map)
    drawTrailLayerRef.current = L.layerGroup().addTo(map)

    const fireBoundsChange = () => {
      const b = map.getBounds()
      onBoundsChangeRef.current?.({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      })
    }

    map.on('zoomend', () => {
      setZoom(map.getZoom())
      fireBoundsChange()
    })
    map.on('moveend', () => {
      fireBoundsChange()
      setMapLayoutEpoch((e) => e + 1)
    })
    fireBoundsChange()

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (officialMapAlignHandlerRef.current) {
        officialMapAlignHandlerRef.current([e.latlng.lat, e.latlng.lng])
        return
      }
      if (placingPhotoRef.current) {
        const { lat, lng } = e.latlng
        const snap = snapToNearestTrailPoint(lat, lng, trailsRef.current)
        const photo = placingPhotoRef.current

        if (!snap) {
          const msg =
            trailsRef.current.length === 0
              ? 'Load trails on the map first, then tap on or near a trail line.'
              : 'No trail close to this tap. Zoom in and tap on or near a trail line.'
          const popupContent = document.createElement('div')
          popupContent.style.cssText = mapPopupStyles.columnWide
          const label = document.createElement('p')
          label.style.cssText = mapPopupStyles.label
          label.textContent = msg
          popupContent.appendChild(label)
          const okBtn = document.createElement('button')
          okBtn.textContent = 'OK'
          okBtn.style.cssText = mapPopupStyles.btnPrimaryRideFullWidth
          popupContent.appendChild(okBtn)
          const popup = L.popup({ closeButton: false })
            .setLatLng([lat, lng])
            .setContent(popupContent)
            .openOn(map)
          okBtn.onclick = () => popup.close()
          return
        }

        const pinLat = snap.lat
        const pinLon = snap.lon
        const trailName = snap.trail.name

        const popupContent = document.createElement('div')
        popupContent.style.cssText = mapPopupStyles.column
        if (photo.thumbnailUrl || photo.blobUrl) {
          const img = document.createElement('img')
          img.src = photo.thumbnailUrl || photo.blobUrl
          img.style.cssText = mapPopupStyles.imgThumb
          popupContent.appendChild(img)
        }
        const label = document.createElement('p')
        label.style.cssText = mapPopupStyles.label
        label.textContent = `Pin to trail: ${trailName}`
        popupContent.appendChild(label)
        const btnRow = document.createElement('div')
        btnRow.style.cssText = mapPopupStyles.btnRow
        const acceptBtn = document.createElement('button')
        acceptBtn.textContent = 'Accept'
        acceptBtn.style.cssText = mapPopupStyles.btnPrimaryRide
        const cancelBtn = document.createElement('button')
        cancelBtn.textContent = 'Cancel'
        cancelBtn.style.cssText = mapPopupStyles.btnOutline
        btnRow.appendChild(acceptBtn)
        btnRow.appendChild(cancelBtn)
        popupContent.appendChild(btnRow)

        const popup = L.popup({ closeButton: false })
          .setLatLng([pinLat, pinLon])
          .setContent(popupContent)
          .openOn(map)

        acceptBtn.onclick = () => {
          popup.close()
          onAcceptPhotoRef.current(photo.id, snap.trail.id, pinLat, pinLon)
        }
        cancelBtn.onclick = () => {
          popup.close()
          onCancelPlaceRef.current()
        }
        return
      }
      if (placingTrailPhotoRef.current) {
        const { lat, lng } = e.latlng
        const snap = snapToNearestTrailPoint(lat, lng, trailsRef.current)
        const photo = placingTrailPhotoRef.current

        if (!snap) {
          const msg =
            trailsRef.current.length === 0
              ? 'Load trails on the map first, then tap on or near a trail line.'
              : 'No trail close to this tap. Zoom in and tap on or near a trail line.'
          const popupContent = document.createElement('div')
          popupContent.style.cssText = mapPopupStyles.columnWide
          const label = document.createElement('p')
          label.style.cssText = mapPopupStyles.label
          label.textContent = msg
          popupContent.appendChild(label)
          const okBtn = document.createElement('button')
          okBtn.textContent = 'OK'
          okBtn.style.cssText = mapPopupStyles.btnPrimaryTrailFullWidth
          popupContent.appendChild(okBtn)
          const popup = L.popup({ closeButton: false })
            .setLatLng([lat, lng])
            .setContent(popupContent)
            .openOn(map)
          okBtn.onclick = () => popup.close()
          return
        }

        const pinLat = snap.lat
        const pinLon = snap.lon
        const trailName = snap.trail.name

        const popupContent = document.createElement('div')
        popupContent.style.cssText = mapPopupStyles.column
        if (photo.thumbnailUrl || photo.blobUrl) {
          const img = document.createElement('img')
          img.src = photo.thumbnailUrl || photo.blobUrl
          img.style.cssText = mapPopupStyles.imgThumb
          popupContent.appendChild(img)
        }
        const label = document.createElement('p')
        label.style.cssText = mapPopupStyles.label
        label.textContent = `Pin to trail: ${trailName}`
        popupContent.appendChild(label)
        const btnRow = document.createElement('div')
        btnRow.style.cssText = mapPopupStyles.btnRow
        const acceptBtn = document.createElement('button')
        acceptBtn.textContent = 'Accept'
        acceptBtn.style.cssText = mapPopupStyles.btnPrimaryTrail
        const cancelBtn = document.createElement('button')
        cancelBtn.textContent = 'Cancel'
        cancelBtn.style.cssText = mapPopupStyles.btnOutline
        btnRow.appendChild(acceptBtn)
        btnRow.appendChild(cancelBtn)
        popupContent.appendChild(btnRow)

        const popup = L.popup({ closeButton: false })
          .setLatLng([pinLat, pinLon])
          .setContent(popupContent)
          .openOn(map)

        acceptBtn.onclick = () => {
          popup.close()
          void onAcceptTrailPhotoRef.current(photo.id, snap.trail.id, pinLat, pinLon)
        }
        cancelBtn.onclick = () => {
          popup.close()
          onCancelPlaceRef.current()
        }
        return
      }
      if (drawTrailModeRef.current) {
        if (trailEditToolRef.current === 'pencil') {
          onDrawTrailPointAddedRef.current([e.latlng.lat, e.latlng.lng])
        }
        return
      }
      if (drawNetworkModeRef.current) {
        if (trailEditToolRef.current === 'pencil') {
          onNetworkPointAddedRef.current([e.latlng.lat, e.latlng.lng])
        }
        return
      }
    })

    mapRef.current = map

    locateControlRef.current = installTopLeftToolControls(map)

    return () => {
      map.remove()
      mapRef.current = null
      basemapLayerRef.current = null
      locateControlRef.current = null
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
      trailPhotoMarkersLayerRef.current = null
      userLocationLayerRef.current = null
      draftTrailsLayerRef.current = null
      drawTrailLayerRef.current = null
    }
  }, [])

  // Render "you are here" marker if location is known
  useEffect(() => {
    if (!userLocationLayerRef.current) return
    userLocationLayerRef.current.clearLayers()
    if (!userLocation) return

    const pt: [number, number] = [userLocation.lat, userLocation.lon]

    if (typeof userLocation.accuracyM === 'number' && Number.isFinite(userLocation.accuracyM)) {
      L.circle(pt, {
        radius: userLocation.accuracyM,
        color: MAP.locationAccuracyStroke,
        weight: 1,
        opacity: 0.5,
        fillColor: MAP.locationAccuracyFill,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(userLocationLayerRef.current)
    }

    L.circleMarker(pt, {
      radius: 7,
      color: MAP.locationDotBorder,
      weight: 2,
      fillColor: MAP.locationDotFill,
      fillOpacity: 1,
      interactive: false,
    }).addTo(userLocationLayerRef.current)

    L.circleMarker(pt, {
      radius: 2,
      color: MAP.white,
      weight: 0,
      fillColor: MAP.white,
      fillOpacity: 1,
      interactive: false,
    }).addTo(userLocationLayerRef.current)
  }, [userLocation])

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

      const rideHitInteractive =
        trimMode || (!mapDrawingSurface && !placingPhoto && !placingTrailPhoto)
      const rc = rideLineColor(MAP)

      // Visible line — not interactive so the wide hit area beneath handles all events
      L.polyline(ride.polyline, {
        color: rc,
        weight: 3,
        dashArray: '8, 6',
        opacity: 0.85,
        interactive: false,
        ...catalogLineHints,
      }).addTo(ridesLayerRef.current!)

      // Wide invisible hit area — much easier to click than the 3px line
      const hitArea = L.polyline(ride.polyline, {
        color: rc,
        weight: 20,
        opacity: 0,
        interactive: rideHitInteractive,
        ...catalogLineHints,
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
          color: MAP.foreground,
          fillColor: MAP.card,
          fillOpacity: 1,
          weight: 2,
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
        if (drawTrailModeRef.current || refineModeRef.current) return
        if (editTrailModeRef.current) return
        L.popup().setLatLng(e.latlng).setContent(ridePopupContent).openOn(mapRef.current!)
      })

      hitArea.addTo(ridesLayerRef.current!)
    })

    const allPoints = rides.filter((r) => !hiddenRideIds.has(r.id)).flatMap((r) => r.polyline)
    if (allPoints.length > 0 && !trimModeRef.current && !editTrailModeRef.current) {
      mapRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40] })
    }
  }, [rides, hiddenRideIds, trimMode, mapDrawingSurface, placingPhoto, placingTrailPhoto])

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

      const trailColor = trailLineColor(trail.difficulty, MAP)

      const normalWeight = trail.difficulty === 'pro' ? 4 : 3
      const hoverWeight = trail.difficulty === 'pro' ? 7 : 6

      const showHoverMarkers = () => {
        const start = trail.polyline[0]
        const end = trail.polyline[trail.polyline.length - 1]
        hoverLayerRef.current?.clearLayers()
        L.circleMarker(start, { radius: 6, color: MAP.foreground, weight: 2, fillColor: trailColor, fillOpacity: 1, interactive: false })
          .addTo(hoverLayerRef.current!)
        L.circleMarker(end, { radius: 6, color: MAP.foreground, weight: 2, fillColor: trailColor, fillOpacity: 1, interactive: false })
          .addTo(hoverLayerRef.current!)
      }

      const pl = L.polyline(trail.polyline, {
        color: trailColor,
        weight: normalWeight,
        opacity: 0.9,
        interactive: false,
        ...catalogLineHints,
      })
      pl.addTo(trailsLayerRef.current!)

      const trailHitInteractive =
        !trimMode &&
        (editTrailMode || !mapDrawingSurface) &&
        !placingPhoto &&
        !placingTrailPhoto

      // Wide invisible hit area handles all mouse events for this trail
      // Non-interactive in trim mode so clicks fall through to ride lines beneath
      const hitArea = L.polyline(trail.polyline, {
        color: trailColor,
        weight: 20,
        opacity: 0,
        interactive: trailHitInteractive,
        ...catalogLineHints,
      })
      hitArea.on('click', clickHandler)
      hitArea.on('mouseover', () => { pl.setStyle({ weight: hoverWeight, opacity: 1 }); showHoverMarkers() })
      hitArea.on('mouseout', () => { pl.setStyle({ weight: normalWeight, opacity: 0.9 }); hoverLayerRef.current?.clearLayers() })
      hitArea.addTo(trailsLayerRef.current!)

      // Permanent label at midpoint, rotated to follow the trail (only when zoomed in)
      if (zoom >= LABEL_ZOOM_THRESHOLD) {
        const midIdx = Math.floor(trail.polyline.length / 2)
        const midPoint = trail.polyline[midIdx]
        const p1 = trail.polyline[Math.max(0, midIdx - 5)]
        const p2 = trail.polyline[Math.min(trail.polyline.length - 1, midIdx + 5)]
        const dy = -(p2[0] - p1[0])
        const dx = p2[1] - p1[1]
        let labelAngle = Math.atan2(dy, dx) * 180 / Math.PI
        if (labelAngle > 90) labelAngle -= 180
        if (labelAngle < -90) labelAngle += 180
        const diffIcon =
          trail.difficulty === 'easy' ? '●' :
          trail.difficulty === 'intermediate' ? '■' :
          trail.difficulty === 'hard' ? '◆' :
          trail.difficulty === 'pro' ? '◆◆' : ''
        const labelHtml = trailMidpointLabelHtml(
          {
            trailColor,
            diffIcon,
            name: trail.name,
            labelAngle,
          },
          MAP
        )
        L.marker(midPoint, {
          icon: L.divIcon({ html: labelHtml, className: '', iconSize: [0, 0], iconAnchor: [0, 0] }),
          interactive: false,
          keyboard: false,
        }).addTo(trailsLayerRef.current!)
      }
    })
  }, [trails, editTrailMode, trimMode, zoom, mapDrawingSurface, placingPhoto, placingTrailPhoto])

  // Map container cursor: mode + trail picker vs geometry + pencil vs eraser
  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.getContainer().style.cursor = resolveMapCursor({
      editMode,
      editTrailMode,
      refineMode,
      drawTrailMode,
      drawNetworkMode,
      trailEditTool,
    })
  }, [editMode, editTrailMode, refineMode, drawTrailMode, drawNetworkMode, trailEditTool])

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
      color: MAP.foreground,
      fillColor: MAP.primary,
      fillOpacity: 0.95,
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
      color: MAP.primary,
      weight: 6,
      opacity: 0.9,
      ...catalogLineHints,
    }).addTo(trimLayerRef.current)

    L.circleMarker(trimSegment.polyline[0], {
      radius: 8,
      color: MAP.foreground,
      fillColor: MAP.forest,
      fillOpacity: 1,
      weight: 2,
    })
      .bindTooltip('Start')
      .addTo(trimLayerRef.current)

    L.circleMarker(trimSegment.polyline[trimSegment.polyline.length - 1], {
      radius: 8,
      color: MAP.foreground,
      fillColor: MAP.destructive,
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
      color: MAP.trimAverage,
      weight: 4,
      dashArray: '10, 6',
      opacity: 0.9,
      ...catalogLineHints,
    }).addTo(averagedTrimLayerRef.current)

    for (const pt of averagedTrimPolyline) {
      L.circleMarker(pt, {
        radius: 2,
        color: MAP.trimAverage,
        fillColor: MAP.trimAverage,
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

    const tool = trailEditTool

    // Working copy mutated during drag
    const pts: [number, number][] = refinePolyline.map(([lat, lng]) => [lat, lng])

    const pl = L.polyline(pts as L.LatLngExpression[], {
      color: MAP.primary,
      weight: 4,
      opacity: 1,
      ...catalogLineHints,
    }).addTo(refineLayerRef.current)

    const nodeIcon = L.divIcon({
      className: '',
      html: refineNodeDivHtml(10, MAP.primary, MAP),
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    })

    pts.forEach((pt, i) => {
      const marker = L.marker(pt as L.LatLngExpression, {
        draggable: tool === 'pencil',
        icon: nodeIcon,
        zIndexOffset: 1000,
      }).addTo(refineLayerRef.current!)

      if (tool === 'pencil') {
        marker.on('drag', () => {
          const { lat, lng } = marker.getLatLng()
          pts[i] = [lat, lng]
          pl.setLatLngs(pts as L.LatLngExpression[])
        })

        marker.on('dragend', () => {
          onPolylineRefinedRef.current([...pts])
        })
      } else {
        marker.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e)
          onRefinePointRemovedRef.current(i)
        })
      }
    })

    if (tool === 'pencil' && pts.length >= 2) {
      const midIcon = L.divIcon({
        className: '',
        html: refineMidpointDivHtml(MAP.primary, MAP),
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      })
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]
        const b = pts[i + 1]
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        const marker = L.marker(mid as L.LatLngExpression, { icon: midIcon, interactive: true })
        marker.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e)
          onRefineInsertAfterRef.current(i, mid)
        })
        marker.addTo(refineLayerRef.current!)
      }
    }
  }, [refineMode, refinePolyline, trailEditTool])

  // Effect 8: networks layer
  useEffect(() => {
    if (!networksLayerRef.current) return
    networksLayerRef.current.clearLayers()

    networks.forEach((network) => {
      if (hiddenNetworkIds.has(network.id)) return
      if (network.polygon.length < 3) return
      const isSelected = network.id === selectedNetworkId
      const interactive =
        !trimMode && !editTrailMode && !placingPhoto && !placingTrailPhoto && !mapDrawingSurface
      const polygon = L.polygon(network.polygon as L.LatLngExpression[], {
        ...networkPolygonLeafletStyle(isSelected, MAP),
        interactive,
        pane: 'networksPane',
      })

      polygon.on('click', (e: L.LeafletMouseEvent) => {
        if (editNetworkModeRef.current) {
          L.DomEvent.stopPropagation(e)
          onNetworkSelectedRef.current(network)
        }
      })

      polygon.addTo(networksLayerRef.current!)

      // Network name along longest polygon edge when zoomed out — click to zoom in
      if (zoom < LABEL_ZOOM_THRESHOLD && mapRef.current) {
        const edge = longestPolygonEdgeMidpoint(network.polygon as [number, number][])
        if (!edge) return
        const rot = networkPolygonEdgeLabelRotationDeg(mapRef.current, edge.a, edge.b)
        const networkLabelHtml = networkEdgeLabelHtml(network.name, rot, MAP)
        const labelMarker = L.marker(edge.mid as L.LatLngExpression, {
          icon: L.divIcon({ html: networkLabelHtml, className: '', iconSize: [0, 0], iconAnchor: [0, 0] }),
          interactive,
          keyboard: false,
          pane: 'networksPane',
        })
        labelMarker.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e)
          mapRef.current!.flyToBounds(L.latLngBounds(network.polygon as L.LatLngExpression[]), { padding: [40, 40], duration: 0.8 })
        })
        labelMarker.addTo(networksLayerRef.current!)
      }
    })
  }, [
    networks,
    hiddenNetworkIds,
    selectedNetworkId,
    trimMode,
    editTrailMode,
    placingPhoto,
    placingTrailPhoto,
    zoom,
    mapLayoutEpoch,
    mapDrawingSurface,
  ])

  // Effect: draw network polygon — same interactions as draw-trail (drag, midpoints, eraser) + closing edge
  useEffect(() => {
    if (!drawNetworkLayerRef.current) return
    drawNetworkLayerRef.current.clearLayers()
    if (!drawNetworkMode || drawNetworkPoints.length === 0) return

    const tool = trailEditTool

    const nodeIcon = L.divIcon({
      className: '',
      html: drawNetworkNodeDivHtml(10, MAP.primary, MAP),
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    })

    const pts: [number, number][] = drawNetworkPoints.map(([lat, lng]) => [lat, lng])

    let previewChain: L.Polyline | null = null
    let previewClosing: L.Polyline | null = null
    if (pts.length >= 2) {
      previewChain = L.polyline(pts as L.LatLngExpression[], {
        color: MAP.primary,
        weight: 2,
        dashArray: '6, 4',
        opacity: 0.8,
        interactive: false,
        ...catalogLineHints,
      }).addTo(drawNetworkLayerRef.current!)
    }
    if (pts.length >= 3) {
      previewClosing = L.polyline([pts[pts.length - 1], pts[0]] as L.LatLngExpression[], {
        color: MAP.primary,
        weight: 1,
        dashArray: '4, 6',
        opacity: 0.5,
        interactive: false,
        ...catalogLineHints,
      }).addTo(drawNetworkLayerRef.current!)
    }

    const syncPolylines = () => {
      if (previewChain && pts.length >= 2) {
        previewChain.setLatLngs(pts as L.LatLngExpression[])
      }
      if (previewClosing && pts.length >= 3) {
        previewClosing.setLatLngs([pts[pts.length - 1], pts[0]] as L.LatLngExpression[])
      }
    }

    pts.forEach((pt, i) => {
      const marker = L.marker(pt as L.LatLngExpression, {
        icon: nodeIcon,
        interactive: true,
        draggable: tool === 'pencil',
        zIndexOffset: 1000,
      })
      if (tool === 'eraser') {
        marker.on('click', (ev: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(ev)
          onNetworkDrawPointRemovedRef.current(i)
        })
      }
      if (tool === 'pencil') {
        marker.on('drag', () => {
          const { lat, lng } = marker.getLatLng()
          pts[i] = [lat, lng]
          syncPolylines()
        })
        marker.on('dragend', () => {
          const { lat, lng } = marker.getLatLng()
          onNetworkDrawPointMovedRef.current(i, [lat, lng])
        })
      }
      marker.addTo(drawNetworkLayerRef.current!)
    })

    if (tool === 'pencil' && pts.length >= 2) {
      const midIcon = L.divIcon({
        className: '',
        html: refineMidpointDivHtml(MAP.primary, MAP),
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      })
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]
        const b = pts[i + 1]
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        const marker = L.marker(mid as L.LatLngExpression, { icon: midIcon, interactive: true })
        marker.on('click', (ev: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(ev)
          onNetworkDrawInsertAfterRef.current(i, mid)
        })
        marker.addTo(drawNetworkLayerRef.current!)
      }
      if (pts.length >= 3) {
        const a = pts[pts.length - 1]
        const b = pts[0]
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        const marker = L.marker(mid as L.LatLngExpression, { icon: midIcon, interactive: true })
        marker.on('click', (ev: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(ev)
          onNetworkDrawInsertAfterRef.current(pts.length - 1, mid)
        })
        marker.addTo(drawNetworkLayerRef.current!)
      }
    }
  }, [drawNetworkMode, drawNetworkPoints, trailEditTool])

  // Effect: draft trails — dashed lines, same difficulty colors, not interactive in edit modes
  useEffect(() => {
    if (!draftTrailsLayerRef.current) return
    draftTrailsLayerRef.current.clearLayers()

    draftTrails.forEach((draft) => {
      const trailColor = trailLineColor(draft.difficulty, MAP)

      L.polyline(draft.polyline, {
        color: trailColor,
        weight: 3,
        opacity: 0.65,
        dashArray: '6, 4',
        interactive: false,
        ...catalogLineHints,
      })
        .bindTooltip(`Draft: ${draft.name}`, { sticky: true })
        .addTo(draftTrailsLayerRef.current!)
    })
  }, [draftTrails])

  // Effect: draw trail preview — live polyline + node markers as user plots
  useEffect(() => {
    if (!drawTrailLayerRef.current) return
    drawTrailLayerRef.current.clearLayers()
    if (!drawTrailMode || drawTrailPoints.length === 0) return

    const tool = trailEditTool

    const nodeIcon = L.divIcon({
      className: '',
      html: drawTrailNodeDivHtml(8, MAP.primary, MAP),
      iconSize: [8, 8],
      iconAnchor: [4, 4],
    })

    // Mutable copy so pencil drag can update the live polyline (matches refine-mode behavior).
    const pts: [number, number][] = drawTrailPoints.map(([lat, lng]) => [lat, lng])

    const previewPolyline =
      pts.length >= 2
        ? L.polyline(pts as L.LatLngExpression[], {
            color: MAP.primary,
            weight: 3,
            opacity: 0.85,
            interactive: false,
            ...catalogLineHints,
          }).addTo(drawTrailLayerRef.current!)
        : null

    pts.forEach((pt, i) => {
      const marker = L.marker(pt as L.LatLngExpression, {
        icon: nodeIcon,
        // Must stay interactive in pencil mode or Leaflet will not deliver drag events.
        interactive: true,
        draggable: tool === 'pencil',
        zIndexOffset: 1000,
      })
      if (tool === 'eraser') {
        marker.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e)
          onDrawTrailPointRemovedRef.current(i)
        })
      }
      if (tool === 'pencil') {
        marker.on('drag', () => {
          const { lat, lng } = marker.getLatLng()
          pts[i] = [lat, lng]
          if (previewPolyline) previewPolyline.setLatLngs(pts as L.LatLngExpression[])
        })
        marker.on('dragend', () => {
          const { lat, lng } = marker.getLatLng()
          onDrawTrailPointMovedRef.current(i, [lat, lng])
        })
      }
      marker.addTo(drawTrailLayerRef.current!)
    })

    if (tool === 'pencil' && pts.length >= 2) {
      const midIcon = L.divIcon({
        className: '',
        html: refineMidpointDivHtml(MAP.primary, MAP),
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      })
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]
        const b = pts[i + 1]
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        const marker = L.marker(mid as L.LatLngExpression, { icon: midIcon, interactive: true })
        marker.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e)
          onDrawTrailInsertAfterRef.current(i, mid)
        })
        marker.addTo(drawTrailLayerRef.current!)
      }
    }
  }, [drawTrailMode, drawTrailPoints, trailEditTool])

  // Effect 9: selected trail highlight
  useEffect(() => {
    if (!selectedTrailLayerRef.current) return

    selectedTrailLayerRef.current.clearLayers()

    if (!selectedTrailId) return

    const trail = trails.find((t) => t.id === selectedTrailId)
    if (!trail) return

    L.polyline(trail.polyline, {
      color: MAP.primary,
      weight: 6,
      opacity: 0.85,
      ...catalogLineHints,
    }).addTo(selectedTrailLayerRef.current)

    mapRef.current?.flyToBounds(L.latLngBounds(trail.polyline), { padding: [60, 60], duration: 0.6 })
  }, [selectedTrailId, trails])

  // Imperative fly from drawer / list (independent of selection)
  useEffect(() => {
    if (!mapRef.current || !flyToRequest) return
    const { kind, id } = flyToRequest
    if (kind === 'trail') {
      const trail = trails.find((t) => t.id === id)
      if (!trail?.polyline?.length) return
      mapRef.current.flyToBounds(L.latLngBounds(trail.polyline), {
        padding: [60, 60],
        maxZoom: 15,
        duration: 0.8,
      })
      return
    }
    const network = networks.find((n) => n.id === id)
    if (!network) return
    if (network.polygon.length >= 3) {
      mapRef.current.flyToBounds(L.latLngBounds(network.polygon as L.LatLngExpression[]), {
        padding: [40, 40],
        maxZoom: 15,
        duration: 0.8,
      })
      return
    }
    const trailPts = trails.filter((t) => network.trailIds.includes(t.id)).flatMap((t) => t.polyline)
    if (trailPts.length === 0) return
    mapRef.current.flyToBounds(L.latLngBounds(trailPts), { padding: [40, 40], maxZoom: 15, duration: 0.8 })
  }, [flyToRequest, trails, networks])

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
        const ridePhotoBorder = photo.accepted ? MAP.primary : MAP.foreground
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:36px;height:36px;border-radius:4px;border:2px solid ${ridePhotoBorder};box-shadow:0 1px 4px rgba(0,0,0,.4);overflow:hidden;background:${MAP.mud}">
            <img src="${thumbSrc}" style="width:100%;height:100%;object-fit:cover" />
          </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })

        const marker = L.marker([displayLat, displayLon], { icon })

        if (!photo.accepted) {
          const popupContent = document.createElement('div')
          popupContent.style.cssText = mapPopupStyles.column
          const img = document.createElement('img')
          img.src = thumbSrc
          img.style.cssText = mapPopupStyles.imgThumb
          popupContent.appendChild(img)
          const viewBtnUnaccepted = document.createElement('button')
          viewBtnUnaccepted.type = 'button'
          viewBtnUnaccepted.textContent = 'View full size'
          viewBtnUnaccepted.style.cssText = `${mapPopupStyles.btnOutline};width:100%;box-sizing:border-box`
          viewBtnUnaccepted.onclick = () => {
            onOpenPhotoLightboxRef.current?.(photo.blobUrl)
            marker.closePopup()
          }
          popupContent.appendChild(viewBtnUnaccepted)
          const btnRow = document.createElement('div')
          btnRow.style.cssText = mapPopupStyles.btnRow
          const acceptBtn = document.createElement('button')
          acceptBtn.textContent = 'Accept — pin to trail'
          acceptBtn.style.cssText = mapPopupStyles.btnPrimaryRide
          const dismissBtn = document.createElement('button')
          dismissBtn.textContent = 'Dismiss'
          dismissBtn.style.cssText = mapPopupStyles.btnOutline
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
        } else {
          const popupContent = document.createElement('div')
          popupContent.style.cssText = mapPopupStyles.column
          const img = document.createElement('img')
          img.src = thumbSrc
          img.alt = ''
          img.style.cssText = mapPopupStyles.imgThumb
          popupContent.appendChild(img)
          const label = document.createElement('p')
          label.style.cssText = mapPopupStyles.label
          label.textContent = 'Ride photo'
          popupContent.appendChild(label)
          const viewBtnAccepted = document.createElement('button')
          viewBtnAccepted.type = 'button'
          viewBtnAccepted.textContent = 'View full size'
          viewBtnAccepted.style.cssText = `${mapPopupStyles.btnOutline};width:100%;box-sizing:border-box`
          viewBtnAccepted.onclick = () => {
            onOpenPhotoLightboxRef.current?.(photo.blobUrl)
            marker.closePopup()
          }
          popupContent.appendChild(viewBtnAccepted)
          marker.bindPopup(popupContent)
        }

        marker.addTo(photoMarkersLayerRef.current!)
      }
    }
  }, [ridePhotos, photosVisibleRideIds])

  // Effect 10b: public trail photo pins
  useEffect(() => {
    if (!trailPhotoMarkersLayerRef.current || !mapRef.current) return
    trailPhotoMarkersLayerRef.current.clearLayers()

    for (const photo of trailPhotos) {
      const displayLat = photo.accepted && photo.trailLat != null ? photo.trailLat : photo.lat
      const displayLon = photo.accepted && photo.trailLon != null ? photo.trailLon : photo.lon
      if (displayLat == null || displayLon == null) continue

      const thumbSrc = photo.thumbnailUrl || photo.blobUrl
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:38px;height:38px;border-radius:6px;border:2px solid ${MAP.forest};box-shadow:0 1px 4px rgba(0,0,0,.35);overflow:hidden;background:${MAP.mud}">
          <img src="${thumbSrc}" style="width:100%;height:100%;object-fit:cover" />
        </div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      })

      const marker = L.marker([displayLat, displayLon], { icon })

      if (!photo.accepted) {
        const popupContent = document.createElement('div')
        popupContent.style.cssText = mapPopupStyles.column
        const img = document.createElement('img')
        img.src = thumbSrc
        img.style.cssText = mapPopupStyles.imgThumb
        popupContent.appendChild(img)

        const label = document.createElement('p')
        label.style.cssText = mapPopupStyles.label
        label.textContent = photo.isLocal
          ? 'Pin to trail (demo — sign in with Strava to save for everyone)'
          : 'Accept — snap to nearest trail'
        popupContent.appendChild(label)

        const viewTrailUnaccepted = document.createElement('button')
        viewTrailUnaccepted.type = 'button'
        viewTrailUnaccepted.textContent = 'View full size'
        viewTrailUnaccepted.style.cssText = `${mapPopupStyles.btnOutline};width:100%;box-sizing:border-box`
        viewTrailUnaccepted.onclick = () => {
          onOpenPhotoLightboxRef.current?.(photo.blobUrl)
          marker.closePopup()
        }
        popupContent.appendChild(viewTrailUnaccepted)

        const btnRow = document.createElement('div')
        btnRow.style.cssText = mapPopupStyles.btnRow
        const acceptBtn = document.createElement('button')
        acceptBtn.textContent = 'Accept'
        acceptBtn.style.cssText = mapPopupStyles.btnPrimaryTrail
        const dismissBtn = document.createElement('button')
        dismissBtn.textContent = 'Dismiss'
        dismissBtn.style.cssText = mapPopupStyles.btnOutline
        btnRow.appendChild(acceptBtn)
        btnRow.appendChild(dismissBtn)
        popupContent.appendChild(btnRow)

        marker.bindPopup(popupContent)

        acceptBtn.onclick = () => {
          marker.closePopup()
          const snap = snapToNearestTrailPoint(displayLat, displayLon, trailsRef.current)
          if (snap) {
            void onAcceptTrailPhotoRef.current(photo.id, snap.trail.id, snap.lat, snap.lon)
          }
        }
        dismissBtn.onclick = () => marker.closePopup()
      } else {
        const popupContent = document.createElement('div')
        popupContent.style.cssText = mapPopupStyles.column
        const img = document.createElement('img')
        img.src = thumbSrc
        img.alt = ''
        img.style.cssText = mapPopupStyles.imgThumb
        popupContent.appendChild(img)
        const label = document.createElement('p')
        label.style.cssText = mapPopupStyles.label
        label.textContent = photo.isLocal
          ? 'Demo preview — sign in to share this pin with everyone.'
          : 'Pinned to trail'
        popupContent.appendChild(label)
        const viewTrailAccepted = document.createElement('button')
        viewTrailAccepted.type = 'button'
        viewTrailAccepted.textContent = 'View full size'
        viewTrailAccepted.style.cssText = `${mapPopupStyles.btnOutline};width:100%;box-sizing:border-box`
        viewTrailAccepted.onclick = () => {
          onOpenPhotoLightboxRef.current?.(photo.blobUrl)
          marker.closePopup()
        }
        popupContent.appendChild(viewTrailAccepted)
        marker.bindPopup(popupContent)
      }
      marker.addTo(trailPhotoMarkersLayerRef.current)
    }
  }, [trailPhotos])

  const officialMapDomRef = useRef<{ holder: HTMLDivElement; img: HTMLImageElement } | null>(null)

  useEffect(() => {
    const map = mapRef.current
    const layer = officialMapLayer

    const teardownDom = () => {
      if (officialMapDomRef.current) {
        officialMapDomRef.current.holder.remove()
        officialMapDomRef.current = null
      }
    }

    if (!map || !layer?.visible || !layer.transform) {
      teardownDom()
      return
    }

    const container = map.getContainer()
    let pair = officialMapDomRef.current
    if (!pair || !pair.holder.isConnected) {
      teardownDom()
      const holder = document.createElement('div')
      holder.style.cssText =
        'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:380;overflow:hidden'
      container.appendChild(holder)
      const img = document.createElement('img')
      img.draggable = false
      img.alt = ''
      img.style.position = 'absolute'
      img.style.left = '0'
      img.style.top = '0'
      img.style.transformOrigin = '0 0'
      holder.appendChild(img)
      pair = { holder, img }
      officialMapDomRef.current = pair
    }

    const { img } = pair
    img.src = layer.blobUrl

    const update = () => {
      const m = mapRef.current
      const lay = officialMapLayerRef.current
      const dom = officialMapDomRef.current
      if (!m || !lay?.visible || !lay.transform || !dom) return
      const t = lay.transform
      const w = t.imageWidth
      const h = t.imageHeight
      const im = dom.img
      const ll00 = imagePixelToLatLng(0, 0, t.p1Img, t.p1Ll, t.p2Img, t.p2Ll)
      const llw0 = imagePixelToLatLng(w, 0, t.p1Img, t.p1Ll, t.p2Img, t.p2Ll)
      const ll0h = imagePixelToLatLng(0, h, t.p1Img, t.p1Ll, t.p2Img, t.p2Ll)
      const p00 = m.latLngToContainerPoint(L.latLng(ll00.lat, ll00.lon))
      const pW0 = m.latLngToContainerPoint(L.latLng(llw0.lat, llw0.lon))
      const p0H = m.latLngToContainerPoint(L.latLng(ll0h.lat, ll0h.lon))
      const a = (pW0.x - p00.x) / w
      const c = (p0H.x - p00.x) / h
      const e = p00.x
      const b = (pW0.y - p00.y) / w
      const d = (p0H.y - p00.y) / h
      const f = p00.y
      im.style.width = `${w}px`
      im.style.height = `${h}px`
      im.style.opacity = String(lay.opacity)
      im.style.transform = `matrix(${a},${b},${c},${d},${e},${f})`
    }

    const onLoad = () => {
      update()
    }
    img.addEventListener('load', onLoad)
    map.on('zoom move zoomend moveend', update)
    update()

    return () => {
      img.removeEventListener('load', onLoad)
      map.off('zoom move zoomend moveend', update)
      teardownDom()
    }
  }, [officialMapLayer])

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        data-basemap={basemapStyle}
        suppressHydrationWarning
      />
      {officialMapAlignHandler && (
        <div className="absolute left-1/2 top-3 z-[1001] flex max-w-[min(92vw,24rem)] -translate-x-1/2 items-center gap-2 border-2 border-electric/80 bg-primary/15 px-3 py-1.5 shadow-[3px_3px_0_0_var(--foreground)]">
          <p className="truncate text-xs font-semibold text-foreground">
            Map align: tap the same feature on the basemap
          </p>
        </div>
      )}
      {(placingPhoto || placingTrailPhoto) && (
        <div
          className={`absolute left-1/2 top-3 z-[1000] flex max-w-[min(90vw,22rem)] -translate-x-1/2 items-center gap-2 border-2 px-3 py-1.5 shadow-[3px_3px_0_0_var(--map-chrome-fg)] dark:border-[var(--map-chrome-fg)] dark:shadow-[3px_3px_0_0_var(--map-chrome-fg)] ${
            placingTrailPhoto && !placingPhoto
              ? 'border-forest/80 bg-forest/15 dark:bg-[color-mix(in_oklch,var(--map-chrome-bg),var(--forest)_18%)]'
              : 'border-primary/80 bg-primary/15 dark:bg-[color-mix(in_oklch,var(--map-chrome-bg),var(--primary)_20%)]'
          }`}
        >
          <p
            className={`truncate text-xs font-semibold dark:text-[var(--map-chrome-fg)] ${
              placingTrailPhoto && !placingPhoto ? 'text-forest' : 'text-foreground'
            }`}
          >
            Tap on or near a trail line to pin
          </p>
          <button
            type="button"
            onClick={onCancelPlace}
            className={`shrink-0 text-xs font-bold uppercase tracking-wide underline-offset-2 hover:underline dark:text-[var(--map-chrome-fg)] ${
              placingTrailPhoto && !placingPhoto ? 'text-forest' : 'text-primary'
            }`}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Mobile floating action button: enter add-trail-photo mode even when drawer is closed */}
      {isCoarsePointer && onEditModeChange && (
        <button
          type="button"
          onClick={() => {
            onEditModeChange(editMode === 'add-trail-photo' ? null : 'add-trail-photo')
          }}
          aria-label={editMode === 'add-trail-photo' ? 'Exit add photo mode' : 'Add photo'}
          className={`absolute bottom-6 right-4 z-1000 flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-[3px_3px_0_0_var(--map-chrome-fg)] transition-colors sm:hidden ${
            editMode === 'add-trail-photo'
              ? 'border-foreground bg-forest text-secondary-foreground dark:border-[var(--map-chrome-fg)] dark:bg-[color-mix(in_oklch,var(--map-chrome-bg),var(--forest)_28%)] dark:text-[var(--map-chrome-fg)] dark:shadow-[3px_3px_0_0_var(--map-chrome-fg)]'
              : 'border-foreground bg-card text-forest dark:border-[var(--map-chrome-fg)] dark:bg-[var(--map-chrome-bg)] dark:text-[var(--map-chrome-fg)] dark:shadow-[3px_3px_0_0_var(--map-chrome-fg)]'
          }`}
          title={editMode === 'add-trail-photo' ? 'Cancel' : 'Add trail photo'}
        >
          <FontAwesomeIcon icon={faCamera} className="w-6 h-6" />
        </button>
      )}
    </div>
  )
}
