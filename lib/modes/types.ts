import type { EditMode, TrimPoint, Trail, Network } from '@/lib/types'

/**
 * All state that is scoped to an active edit mode.
 * Owned by useEditMode(); cleared selectively on mode transitions.
 */
export interface EditModeState {
  trimStart: TrimPoint | null
  trimEnd: TrimPoint | null
  selectedTrail: Trail | null
  refinedPolyline: [number, number][] | null
  savingRefined: boolean
  refineError: string | null
  selectedNetwork: Network | null
  drawNetworkPoints: [number, number][]
  drawTrailPoints: [number, number][]
  drawTrailFinished: boolean
}

export const initialModeState: EditModeState = {
  trimStart: null,
  trimEnd: null,
  selectedTrail: null,
  refinedPolyline: null,
  savingRefined: false,
  refineError: null,
  selectedNetwork: null,
  drawNetworkPoints: [],
  drawTrailPoints: [],
  drawTrailFinished: false,
}

/**
 * Describes the static properties of a map interaction mode.
 *
 * To add a new mode:
 * 1. Add its string literal to the EditMode union in lib/types.ts
 * 2. Create lib/modes/<name>.ts with a ModeDescriptor
 * 3. Register it in lib/modes/index.ts MODE_REGISTRY
 * 4. Add any new state fields to EditModeState above + initialModeState
 * 5. Update the cleanup logic in hooks/useEditMode.ts setMode()
 * 6. Create the sidebar component and add a conditional render in LeftDrawer
 * 7. Add a useEffect in LeafletMap.tsx for any map interactions needed
 *
 * See docs/MODE_SYSTEM.md for a full walkthrough.
 */
export interface ModeDescriptor {
  id: NonNullable<EditMode>
  /** CSS cursor shown on the Leaflet map container while this mode is active. */
  cursor: 'crosshair' | 'pointer' | ''
  /** Human-readable label (for future toolbar/tooltip use). */
  label: string
}
