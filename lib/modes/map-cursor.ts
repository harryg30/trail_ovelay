import type { EditMode } from '@/lib/types'
import { MODE_REGISTRY } from './index'
import type { TrailEditTool } from '@/lib/modes/types'

/**
 * Map container cursor from active mode, phase (picker vs geometry), and trail edit tool.
 * Background layers are de-prioritized during draw/refine/draw-network so this cursor reads clearly.
 */
export function resolveMapCursor(params: {
  editMode: EditMode
  editTrailMode: boolean
  refineMode: boolean
  drawTrailMode: boolean
  trailEditTool: TrailEditTool
}): string {
  const { editMode, editTrailMode, refineMode, drawTrailMode, trailEditTool } = params
  if (!editMode) return ''

  if (drawTrailMode) {
    return trailEditTool === 'pencil' ? 'crosshair' : 'pointer'
  }

  if (editMode === 'edit-trail') {
    if (editTrailMode) return 'pointer'
    if (refineMode) {
      return trailEditTool === 'pencil' ? 'grab' : 'pointer'
    }
  }

  return MODE_REGISTRY[editMode]?.cursor ?? ''
}
