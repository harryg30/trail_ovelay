/**
 * Basemap for Leaflet — always standard OpenStreetMap raster tiles.
 *
 * - **Classic** (`osm`): unfiltered OSM (default map look).
 * - **Catalog** (`stylized`): same OSM tiles with a light CSS grade in `globals.css`
 *   so the base sits closer to app tokens (warm paper, forest-friendly), without swapping providers.
 *
 * Env: `NEXT_PUBLIC_MAP_BASE_STYLE=osm | stylized` overrides the default when localStorage is empty.
 * Omit the env var to use **Catalog** (`stylized`); set `osm` for **Classic** as the first-load default.
 * In-app toggle persists under {@link BASEMAP_PREF_STORAGE_KEY}.
 */

export type MapBaseStyle = 'osm' | 'stylized'

/** Client persistence for the basemap toggle (overrides env default after first visit). */
export const BASEMAP_PREF_STORAGE_KEY = 'trail-overlay-basemap-style'

export function getMapBaseStyle(): MapBaseStyle {
  const v = process.env.NEXT_PUBLIC_MAP_BASE_STYLE
  if (v === 'osm') return 'osm'
  if (v === 'stylized') return 'stylized'
  return 'stylized'
}

export function readStoredBasemapStyle(): MapBaseStyle | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(BASEMAP_PREF_STORAGE_KEY)
    if (raw === 'osm' || raw === 'stylized') return raw
  } catch {
    /* private mode / quota */
  }
  return null
}

export function writeStoredBasemapStyle(style: MapBaseStyle): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(BASEMAP_PREF_STORAGE_KEY, style)
  } catch {
    /* ignore */
  }
}

export interface BasemapLayerOptions {
  url: string
  attribution: string
  maxZoom: number
  /** Leaflet tileLayer subdomains option */
  subdomains?: string | string[]
}

/** Standard OSM — used for both Classic and Catalog; grading is CSS-only on Catalog. */
const OPENSTREETMAP: BasemapLayerOptions = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
  subdomains: 'abc',
}

export function getBasemapLayerOptions(_style: MapBaseStyle): BasemapLayerOptions {
  return OPENSTREETMAP
}
