# Map Interaction Mode System

## Overview

Each "mode" is a named map interaction state. At most one mode is active at a time.
The current mode controls:

- Which **map cursor** is shown (crosshair, pointer, or default)
- Which **map interactions** are enabled (click-to-trim, click-to-draw, trail selection, etc.)
- Which **sidebar panel** is rendered in LeftDrawer
- Which **state** is alive vs. cleared on transition

Notes:
- The **map cursor** may be further specialized by the active tool/phase (for example, draw/edit pencil vs eraser).
- While drawing/refining geometry, background **trails/networks/ride hit areas** are intentionally non-interactive so the cursor and clicks clearly reflect the active operation.

---

## Current Modes

| Mode | Cursor | Sidebar | Owned State |
|------|--------|---------|-------------|
| `add-trail` | crosshair | AddTrailContent | trimStart, trimEnd |
| `edit-trail` | pointer | EditTrailContent | selectedTrail |
| `refine-trail` | default | (inline in LeftDrawer) | selectedTrail (shared), refinedPolyline, refineError |
| `add-network` | crosshair / pointer | DrawNetworkContent | drawNetworkPoints, drawNetworkHistory*, shared `trailEditTool` with draw-trail |
| `edit-network` | pointer | EditNetworkContent (`variant="full"`) | selectedNetwork |
| `network-map` | pointer | EditNetworkContent (`variant="map-only"`) — official map + tasks only | selectedNetwork |
| `null` | default | (no panel) | — |

In **LeftDrawer**, the Networks block uses **+** for `add-network`, a **pen** for full **`edit-network`** (name, trails, polygon, and official map at the bottom of that form), and a **map** icon for **`network-map`** (upload, align, trace tasks — no full network edit). Each network row’s map control: if the overlay is aligned it toggles visibility on the basemap; otherwise (signed-in) it opens **`network-map`** with that network selected. A pending digitization task carries `networkId` so draw-trail publish pre-fills network membership.

---

## Key Files

| File | Role |
|------|------|
| `lib/types.ts` | `EditMode` union type |
| `lib/modes/types.ts` | `ModeDescriptor` interface + `EditModeState` |
| `lib/modes/index.ts` | `MODE_REGISTRY` — maps EditMode → ModeDescriptor |
| `lib/modes/<name>.ts` | One descriptor per mode |
| `hooks/useEditMode.ts` | Owns all mode state; `setMode()` handles cleanup on transition |
| `components/LeafletMap.tsx` | Reads `MODE_REGISTRY[editMode].cursor`; one `useEffect` per mode for map interactions |
| `components/LeftDrawer.tsx` | Switches sidebar content based on `editMode` |
| `app/ClientPage.tsx` | Derives boolean flags from `editMode`; passes them to LeafletMap/LeftDrawer |

---

## How to Add a New Mode

Example: adding `'add-photo'` so users can click the map to drop a photo pin.

### 1. Add the string literal to `EditMode` in `lib/types.ts`

```ts
export type EditMode = 'add-trail' | 'edit-trail' | 'refine-trail' | 'add-network' | 'edit-network' | 'add-photo' | null
```

### 2. Create `lib/modes/add-photo.ts`

```ts
import type { ModeDescriptor } from './types'

export const addPhotoMode: ModeDescriptor = {
  id: 'add-photo',
  cursor: 'crosshair',
  label: 'Add Photo',
}
```

### 3. Register it in `lib/modes/index.ts`

```ts
import { addPhotoMode } from './add-photo'

export const MODE_REGISTRY: Record<NonNullable<EditMode>, ModeDescriptor> = {
  // ... existing modes
  'add-photo': addPhotoMode,
}
```

### 4. Add state to `EditModeState` in `lib/modes/types.ts` (if needed)

```ts
export interface EditModeState {
  // ... existing fields
  pendingPhotoLatLng: [number, number] | null
}

export const initialModeState: EditModeState = {
  // ... existing fields
  pendingPhotoLatLng: null,
}
```

### 5. Update cleanup in `hooks/useEditMode.ts`

Add state init and add the cleanup condition:

```ts
const [pendingPhotoLatLng, setPendingPhotoLatLng] = useState<[number, number] | null>(null)

// In setMode():
if (mode !== 'add-photo') {
  setPendingPhotoLatLng(null)
}
```

### 6. Create the sidebar component in `components/photo/AddPhotoContent.tsx`

```tsx
export function AddPhotoContent({ ... }: ...) {
  return <div>...</div>
}
```

Then add a conditional render in `components/LeftDrawer.tsx`:

```tsx
{editMode === 'add-photo' && <AddPhotoContent ... />}
```

### 7. Add a `useEffect` in `components/LeafletMap.tsx`

Add one effect that registers/deregisters the map click handler for the new mode. Follow the existing pattern for `drawNetworkMode`.

### 8. Wire up the mode toggle

Add a button to LeftDrawer that calls `onEditModeChange('add-photo')`.

---

## State Cleanup Rules

When `setMode(next)` is called in `useEditMode`, it clears state that doesn't carry over to `next`:

- `trimStart`, `trimEnd` — cleared unless entering `add-trail`
- `selectedTrail` — cleared unless entering `edit-trail` or `refine-trail` (shared between them)
- `refinedPolyline`, `refineError` — cleared unless entering `refine-trail`
- `selectedNetwork` — cleared unless entering `add-network`, `edit-network`, or `network-map`
- `drawNetworkPoints`, `drawNetworkHistoryPast`, `drawNetworkHistoryFuture` — cleared unless entering `add-network`
- `trailEditTool` — reset to pencil when leaving `draw-trail`, `edit-trail`, and `add-network`
