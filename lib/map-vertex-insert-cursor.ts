import type { Layer, Map as LeafletMap } from 'leaflet'

/** Cursor while hovering targets that insert a new vertex (distinct from crosshair / grab). */
export const VERTEX_INSERT_CURSOR = 'cell'

/**
 * While any of the layers is hovered, the map cursor shows {@link VERTEX_INSERT_CURSOR}.
 * Uses hover nesting depth + rAF so moving between adjacent insert targets does not flicker.
 */
export function attachVertexInsertHoverCursor(
  map: LeafletMap,
  layers: Layer[],
  getDefaultCursor: () => string
): () => void {
  let depth = 0
  let rafId = 0

  const enter = () => {
    depth += 1
    if (rafId) cancelAnimationFrame(rafId)
    map.getContainer().style.cursor = VERTEX_INSERT_CURSOR
  }

  const leave = () => {
    depth = Math.max(0, depth - 1)
    if (depth === 0) {
      rafId = requestAnimationFrame(() => {
        rafId = 0
        if (depth === 0) {
          map.getContainer().style.cursor = getDefaultCursor()
        }
      })
    }
  }

  for (const layer of layers) {
    layer.on('mouseover', enter)
    layer.on('mouseout', leave)
  }

  return () => {
    depth = 0
    if (rafId) cancelAnimationFrame(rafId)
    for (const layer of layers) {
      layer.off('mouseover', enter)
      layer.off('mouseout', leave)
    }
    map.getContainer().style.cursor = getDefaultCursor()
  }
}
