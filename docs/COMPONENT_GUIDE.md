# Component Guide

## Folder Conventions

```
components/
  LeftDrawer.tsx          ← Outer sidebar shell (~600 lines)
  LeafletMap.tsx          ← Leaflet map (SSR-disabled via dynamic())
  AuthButton.tsx
  AnnouncementModal.tsx

  ui/                     ← shadcn/ui-style primitives (Base UI + Tailwind + CVA)
    button.tsx            ← Catalog variants: default, catalog, outlineThick, ghostMud, …
    dialog.tsx, sheet.tsx ← Modals / panels (thick borders, display titles)
    input.tsx, label.tsx, textarea.tsx, badge.tsx, card.tsx, slider.tsx, separator.tsx

  trail/                  ← Components for the add-trail / edit-trail workflow
    AddTrailContent.tsx   ← Trim flow UI (corridor sliders, Strava fetch, segement info)
    TrimForm.tsx          ← Save-new-trail form (stats + TrailFormFields + submit)
    EditTrailContent.tsx  ← Trail picker dropdown + EditTrailForm + Refine button
    EditTrailForm.tsx     ← Edit-existing-trail form (stats + TrailFormFields + delete)

  network/                ← Components for the add-network / edit-network workflow
    NetworkRow.tsx        ← Expandable list item showing network trails (+ fly-to-map control)
    DrawNetworkContent.tsx ← Two-phase draw (place vertices → name + assign trails)
    EditNetworkContent.tsx ← Network picker dropdown + edit form + delete + official map panel
    OfficialMapAndTasksPanel.tsx ← Per-network map overlay, alignment, digitization tasks (linking a task trail also adds `network_trails` server-side)

  shared/                 ← Cross-cutting UI primitives
    EndpointControls.tsx  ← Step/clear buttons for trim start and end points
    TrailFormFields.tsx   ← Controlled Name/Difficulty/Direction/Notes field set
    ConfirmDeleteButton.tsx ← Two-stage delete button (owns confirmDelete state)
    SearchableDropdown.tsx  ← Generic filtered dropdown with click-outside dismiss
```

## Visual system (shadcn + Trail catalog theme)

- **Theming**: [`app/globals.css`](../app/globals.css) defines shadcn CSS variables (`--primary`, `--background`, …) in **oklch** plus brand tokens (`--forest`, `--safety`, `--electric`, `--mud`, `--surface-paper`). Prefer semantic utilities: `bg-primary`, `text-muted-foreground`, `border-foreground`, `text-electric`, `bg-mud/50`, `font-display` (Russo One for headings). **Dark** uses a **warm charcoal + cream ink** palette (not cool blue-gray) with **muted text and primary-on-orange** tuned for WCAG-style contrast on sidebars/forms. **Light/dark**: [`components/theme-provider.tsx`](../components/theme-provider.tsx) toggles the `dark` class on `<html>` and persists under localStorage `trail-overlay-theme` (`light` | `dark`). Use **ThemeToggle** in the drawer (and on mobile chrome in `ClientPage`).
- **New UI**: Add components with `npx shadcn@latest add <name>` when possible; customize in `components/ui/*` (variants, borders, shadows) so feature code stays thin.
- **Leaflet**: Zoom bar, popups, and attribution use **`--map-chrome-*`** tokens in [`app/globals.css`](../app/globals.css) so they stay **light catalog paper / ink** while the app shell can be dark—vectors and tiles stay visually consistent. **Map vector colors** (trails, rides, networks, markers, imperative popup content) always use the light hex palette `MAP` from [`lib/map-theme.ts`](../lib/map-theme.ts) (canvas/imperative HTML cannot read CSS variables). **Base map** is standard **OSM** rasters ([`lib/map-basemap.ts`](../lib/map-basemap.ts)); `data-basemap` is `osm` (Classic) or `stylized` (Catalog grade on `.leaflet-tile-pane`). Dark mode does **not** change tile filters or layer colors. **Classic / Catalog** (layers control with locate, top-left) persists in `localStorage`; first-load default is Catalog unless `NEXT_PUBLIC_MAP_BASE_STYLE=osm`.

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
