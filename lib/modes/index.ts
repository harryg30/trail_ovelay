import type { EditMode } from '@/lib/types'
import type { ModeDescriptor } from './types'
import { addTrailMode } from './add-trail'
import { editTrailMode } from './edit-trail'
import { refineTrailMode } from './refine-trail'
import { addNetworkMode } from './add-network'
import { editNetworkMode } from './edit-network'

export type { ModeDescriptor, EditModeState } from './types'
export { initialModeState } from './types'

/**
 * Registry of all map interaction modes.
 * Keyed by EditMode value — excludes null (the "no active mode" state).
 *
 * Add a new mode by:
 *   1. Adding it to EditMode in lib/types.ts
 *   2. Creating lib/modes/<name>.ts
 *   3. Importing and adding it here
 */
export const MODE_REGISTRY: Record<NonNullable<EditMode>, ModeDescriptor> = {
  'add-trail': addTrailMode,
  'edit-trail': editTrailMode,
  'refine-trail': refineTrailMode,
  'add-network': addNetworkMode,
  'edit-network': editNetworkMode,
}
