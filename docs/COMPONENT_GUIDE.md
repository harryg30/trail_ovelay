# Component Guide

## Folder Conventions

```
components/
  LeftDrawer.tsx          ← Outer sidebar shell (~600 lines)
  LeafletMap.tsx          ← Leaflet map (SSR-disabled via dynamic())
  AuthButton.tsx
  AnnouncementModal.tsx

  trail/                  ← Components for the add-trail / edit-trail workflow
    AddTrailContent.tsx   ← Trim flow UI (corridor sliders, Strava fetch, segement info)
    TrimForm.tsx          ← Save-new-trail form (stats + TrailFormFields + submit)
    EditTrailContent.tsx  ← Trail picker dropdown + EditTrailForm + Refine button
    EditTrailForm.tsx     ← Edit-existing-trail form (stats + TrailFormFields + delete)

  network/                ← Components for the add-network / edit-network workflow
    NetworkRow.tsx        ← Expandable list item showing network trails
    DrawNetworkContent.tsx ← Two-phase draw (place vertices → name + assign trails)
    EditNetworkContent.tsx ← Network picker dropdown + edit form + delete

  shared/                 ← Cross-cutting UI primitives
    EndpointControls.tsx  ← Step/clear buttons for trim start and end points
    TrailFormFields.tsx   ← Controlled Name/Difficulty/Direction/Notes field set
    ConfirmDeleteButton.tsx ← Two-stage delete button (owns confirmDelete state)
    SearchableDropdown.tsx  ← Generic filtered dropdown with click-outside dismiss
```

## Rules

### Named exports only
All components in `trail/`, `network/`, and `shared/` use **named exports**, not default exports:

```ts
// ✅ correct
export function AddTrailContent(...) { ... }

// ❌ avoid
export default function AddTrailContent(...) { ... }
```

Named exports make it easy to grep for all usages and refactor safely.

### One component per file
Each file exports exactly one component. Helper functions and sub-hooks used only by that component may live in the same file.

### Adding a new mode
Place the sidebar component in `components/<mode-name>/`. See `docs/MODE_SYSTEM.md` for the full walkthrough.

### Ride photos without a map pin
When ride photos from Strava are visible for a ride, thumbnails render in **LeftDrawer** under that ride. A **Pin** strip labels items that still need a map location (`!accepted` and no `lat`). Tap opens a small dialog: **View** (full-screen image) or **Pin to map…**, which hands off to **LeafletMap**: the user taps on or near a trail polyline; the client snaps to the nearest trail vertex and **Accept** saves the association (orphan pins off-trail are not offered in this flow).

### Community trail photos without GPS
Uploads from **Add trail photo** (`AddTrailPhotoContent`) support **Take photo** (camera) or **Choose from library** (JPEG/PNG/WebP). If geolocation is missing, rows stay in **LeftDrawer** under **Trail photos — pin on map** with the same View / Pin-to-map dialog. Placement uses `placingTrailPhoto` on the map (trail snap required). Accepting a pin updates `trail_lat`/`trail_lon` and fills `lat`/`lon` when they were null so bounds queries still work.

---

## Shared Components

### `TrailFormFields`

Controlled field set for Name, Difficulty, Direction, Notes.
Used by both `TrimForm` and `EditTrailForm`.

```ts
interface TrailFormFieldsProps {
  form: TrimFormState
  onChange: (form: TrimFormState) => void
  disabled: boolean
}
```

Callers own the `<form>` tag, submit button, stats display, and error rendering.

---

### `ConfirmDeleteButton`

Two-stage delete button. First click → "Confirm Delete". Second click → calls `onDelete()`.
Owns its own `confirming`, `deleting`, and error state.

```ts
interface ConfirmDeleteButtonProps {
  onDelete: () => Promise<string | null>  // null = success, string = error message
  disabled: boolean
  entityLabel: string  // e.g. 'Trail' | 'Network'
}
```

---

### `SearchableDropdown<T>`

Generic filtered list with a text input and click-outside dismiss. Used for trail and network selection.

```ts
interface SearchableDropdownProps<T extends { id: string }> {
  items: T[]
  selectedItem: T | null
  onSelect: (item: T) => void
  onClear: () => void
  getSearchText: (item: T) => string   // text to filter against
  renderItem: (item: T, isSelected: boolean) => React.ReactNode
  placeholder: string
  inputCls: string  // Tailwind classes for the text input
}
```

---

### `EndpointControls`

Step/clear buttons for trim start and end points.

```ts
interface EndpointControlsProps {
  onStep: (which: 'start' | 'end', delta: number) => void
  onClear: (which: 'start' | 'end') => void
}
```
