# API Conventions

## Response Shape

All API routes return JSON with a `success` boolean:

```ts
// Success
{ success: true, ...payload }

// Error
{ success: false, error: string }
```

Use the helpers in `lib/api/responses.ts`:

```ts
import { apiError, apiSuccess } from '@/lib/api/responses'

// Error
return apiError('Unauthorized', 401)

// Success
return apiSuccess({ trails })

// Success with CORS headers
return apiSuccess({ trails }, CORS_HEADERS)
```

**Do not change** the payload keys on public CORS routes (`/api/trails`, `/api/networks`, `GET /api/trail-photos`).
The browser extension reads `data.trails`, `data.networks`, and `GET /api/trail-photos` → `data.photos` directly.

`GET /api/trail-photos` also accepts **`trailId`** (with optional **`limit`**) instead of bbox params: same public visibility rules, ordered by `created_at` descending, for the extension trail detail gallery.

---

## Auth Check Placement

Auth must be checked **before** the `try/catch` block so auth failures are never swallowed:

```ts
// ✅ correct
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId()
  if (!userId) return apiError('Unauthorized', 401)

  try {
    // ... handler logic
  } catch (error) {
    // ...
  }
}

// ❌ wrong — auth error might be caught and obscured
export async function DELETE(...) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return apiError('Unauthorized', 401)
    // ...
  } catch { ... }
}
```

---

## Row Mappers

DB rows use `snake_case`. Domain types use `camelCase`. All conversions live in `lib/api/mappers.ts`:

```ts
import { rowToTrail, rowToNetwork, rowToRide, type TrailRow } from '@/lib/api/mappers'
```

Never define `rowTo*` functions locally in route files.

Available mappers:

| Function | Input | Output |
|----------|-------|--------|
| `rowToTrail(row: TrailRow)` | DB trail row | `Trail` |
| `rowToNetwork(row: NetworkRow)` | DB network row (with `trail_ids`) | `Network` |
| `rowToRide(row: RideRow)` | DB ride row | `Ride` |

---

## CORS

These routes are CORS-open for **GET** (browser extension reads them from Strava):

- `/api/trails`
- `/api/networks`
- `/api/trail-photos` — **GET only** (community published pins). `POST` remains same-origin + session.

Each defines the same pattern:

```ts
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
```

All other routes are authenticated and do not need CORS headers.

---

## Error Logging

Log errors with the route path for easy grepping:

```ts
console.error('PATCH /api/trails/[id] error:', error)
```
