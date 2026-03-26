# Trail Overlay

Next.js app to overlay mountain bike trails on maps. Upload GPX rides, trim segments into reusable trails, tag difficulty and direction, organise into networks, and view trail photos sourced from Strava. Includes a Chrome extension that injects trail data into the Strava route builder.

[Figma](https://www.figma.com/community/file/1617997246007000248)

---

## Features

- **Ride upload** — GPX files or ZIP archives; parsed server-side
- **Strava sync** — OAuth login; syncs rides and activity photos automatically
- **Trail trimming** — click start/end on a ride polyline to create a named trail segment
- **Trail editing** — rename, reclassify, refine polyline vertex-by-vertex
- **Networks** — draw a polygon on the map to group related trails
- **Trail photos** — sourced from Strava activity photos, re-hosted to Vercel Blob, auto-pinned to the nearest trail, voteable 👍/👎
- **Heatmap** — toggle a heat overlay across all your rides
- **Chrome extension** — overlays trails and networks on the Strava route-builder map; supports photo markers and voting via bearer token auth

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Map (web) | Leaflet 1.9.4 |
| Map (extension) | Mapbox GL JS (injected into Strava) |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL (`pg` driver) |
| Auth | Strava OAuth, JWT sessions (`jose`) |
| Storage | Vercel Blob (photo hosting) |
| Deploy | Vercel |

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Strava API app ([create one](https://www.strava.com/settings/api))
- Vercel Blob store (for photo hosting — only needed for photo sync)

### Environment Variables

Create `.env.local`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/trail_overlay
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
SESSION_SECRET=64-char-hex-string   # openssl rand -hex 32
NEXT_PUBLIC_APP_URL=http://localhost:3000
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

### Database

Apply migrations in order:

```bash
psql $DATABASE_URL -f migrations/001_create_trails.sql
psql $DATABASE_URL -f migrations/002_create_users.sql
psql $DATABASE_URL -f migrations/003_create_rides.sql
psql $DATABASE_URL -f migrations/004_add_polyline_to_trails.sql
psql $DATABASE_URL -f migrations/005_drop_source_ride_fk.sql
psql $DATABASE_URL -f migrations/006_create_networks.sql
psql $DATABASE_URL -f migrations/007_add_strava_activity_id.sql
psql $DATABASE_URL -f migrations/008_create_trail_photos.sql
psql $DATABASE_URL -f migrations/009_create_photo_votes.sql
```

### Install and run

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## Directory Layout

```
app/
  page.tsx                    # Server wrapper (reads session, passes user)
  ClientPage.tsx              # Main state container
  layout.tsx
  api/
    auth/strava/              # OAuth init + callback
    auth/extension-token/     # JWT for Chrome extension
    auth/logout/
    upload/                   # GPX/ZIP → parse → insert rides
    rides/                    # GET (auth required)
    strava/sync/              # Sync rides + photos from Strava
    trails/                   # GET (CORS-open), POST
    trails/[id]/              # PATCH, DELETE
    networks/                 # GET (CORS-open), POST
    networks/[id]/            # PATCH, DELETE
    photos/                   # GET (CORS-open, optional ?trailId=)
    photos/[id]/              # PATCH pin position, DELETE
    photos/[id]/vote/         # POST vote
    health/
components/
  LeafletMap.tsx              # Map: trails, rides, networks, photo markers
  LeftDrawer.tsx              # Sidebar: uploads, ride/trail/network lists, edit forms, token
  AuthButton.tsx
  AnnouncementModal.tsx
lib/
  db.ts                       # pg pool; query() / queryOne()
  auth.ts                     # getSessionUser, getSessionUserId, getUserIdFromBearerToken
  session.ts                  # JWT encrypt/decrypt; 30-day cookie
  gpx-utils.ts                # GPX + ZIP parsing
  geo-utils.ts                # Haversine distance, elevation gain, snapToNearestTrail
  types.ts                    # Shared interfaces
migrations/                   # 001–009 SQL migrations
browser-extension/            # Chrome extension
```

---

## Database Schema

| Table | Key Columns |
|-------|-------------|
| `users` | id, strava_athlete_id, name, profile_picture, access/refresh_token, token_expires_at |
| `rides` | id, user_id, name, distance, elevation, polyline (JSONB), point_count, timestamp, strava_activity_id |
| `trails` | id, name, difficulty, direction, polyline (JSONB), distance_km, elevation_gain_ft, notes, source, source_ride_id, uploaded_by_user_id |
| `networks` | id, name, polygon (JSONB) |
| `network_trails` | network_id, trail_id (junction) |
| `trail_photos` | id, strava_unique_id, ride_id, trail_id, blob_url, caption, pin_lat, pin_lon, original_lat, original_lon, uploaded_by_user_id |
| `photo_votes` | photo_id, user_id, value (1 or -1) — PK is (photo_id, user_id) |

---

## API Routes

| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| `/api/auth/strava` | GET | — | OAuth init |
| `/api/auth/strava/callback` | GET | — | OAuth callback; upserts user; sets cookie |
| `/api/auth/logout` | POST | — | Clears session cookie |
| `/api/auth/extension-token` | GET | Cookie | Mints JWT for Chrome extension |
| `/api/upload` | POST | Cookie | GPX/ZIP upload |
| `/api/rides` | GET | Cookie | User's rides |
| `/api/strava/sync` | POST | Cookie | Syncs rides and activity photos from Strava |
| `/api/trails` | GET, POST | CORS-open | Trails list; create trail |
| `/api/trails/[id]` | PATCH, DELETE | Cookie | Update/delete trail |
| `/api/networks` | GET, POST | CORS-open | Networks list; create network |
| `/api/networks/[id]` | PATCH, DELETE | Cookie | Update/delete network |
| `/api/photos` | GET | CORS-open | Photos; optional `?trailId=`; includes userVote if authenticated |
| `/api/photos/[id]` | PATCH, DELETE | Cookie or Bearer | Move pin; delete (uploader only) |
| `/api/photos/[id]/vote` | POST | Cookie or Bearer | Upsert vote; returns new score |
| `/api/health` | GET | — | Health check |

---

## Trail Photos

Photos are sourced from Strava during ride sync:

1. For each **newly inserted** ride, if `total_photo_count > 0`, fetch `GET /api/v3/activities/{id}/photos?size=2048`
2. Download each image and upload to Vercel Blob at `strava-photos/{unique_id}.jpg`
3. If the photo has GPS coordinates, snap to the nearest trail polyline point within **50 m**
4. Insert into `trail_photos`; `ON CONFLICT (strava_unique_id) DO NOTHING` prevents duplicates

Pin position can be repositioned in the web app (select trail in edit mode → Move pin → drag marker).

---

## Chrome Extension

Located in `browser-extension/`. Injects trail lines, network polygons, and 📷 photo markers into the Strava route builder (`strava.com/maps/create/*`).

### Install

1. Open `chrome://extensions`, enable Developer Mode
2. Load Unpacked → select the `browser-extension/` folder
3. Click the extension icon → set **API URL** to your deployed app URL

### Extension Token (for voting)

The extension cannot use session cookies (cross-origin). To vote on photos:

1. Log in to the Trail Overlay web app
2. Open the sidebar → scroll to **Extension Token** → Generate Token → copy
3. Paste into the extension popup → Save

The token is a JWT signed with the same `SESSION_SECRET` as regular session cookies. It's stored in `chrome.storage.sync` and sent as `Authorization: Bearer <token>` on vote requests.

---

## Architecture Notes

- Single Next.js/Vercel deployment (no separate API server)
- Leaflet loaded via `dynamic()` with SSR disabled
- CORS is open on `/api/trails`, `/api/networks`, and `/api/photos` for the browser extension
- Trail trimming: client picks start/end indices on ride polyline → haversine math → saved as trail
- GPX parsed server-side on upload; polylines stored as JSONB arrays of `[lat, lon]`
- Extension uses Mapbox GL JS (already on the Strava page); web app uses Leaflet
- DB connections use a singleton pool — safe across Vercel cold starts

---

## Gotchas

- `BLOB_READ_WRITE_TOKEN` must be set in Vercel env **and** `.env.local` for photo sync to work
- Strava activity list returns low-res `summary_polyline` only; full-resolution requires per-ride API calls (not currently used)
- Leaflet CSS must be imported in the client component, not `globals.css`
- `DATABASE_URL` has no `NEXT_PUBLIC_` prefix — server-only; never expose it to the browser
