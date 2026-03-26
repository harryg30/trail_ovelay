import type { ModeDescriptor } from './types'

// Sub-mode of edit-trail: user drags polyline nodes to adjust the trail geometry.
// Activated via handleEnterRefineMode(); returns to edit-trail on save or cancel.
export const refineTrailMode: ModeDescriptor = {
  id: 'refine-trail',
  cursor: '',
  label: 'Refine Trail',
}
