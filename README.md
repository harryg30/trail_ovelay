# Trail Overlay

Next.js 16 app (App Router) with Leaflet maps, PostgreSQL, TypeScript, and Tailwind CSS. Deployed as a single service to Vercel.

[Figma](https://www.figma.com/community/file/1617997246007000248)

---

## Architecture

```
Next.js Application
  app/
  ├─ page.tsx              (Home/map page — client component)
  ├─ layout.tsx            (Root layout)
  └─ api/
     ├─ upload/route.ts    (POST /api/upload)
     ├─ trails/route.ts    (GET/POST /api/trails)
     └─ health/route.ts    (GET /api/health)

  app/  (co-located components)
  ├─ LeafletMap.tsx        (Leaflet map)
  └─ LeftDrawer.tsx        (Upload, trim, trail list)

  lib/
  ├─ db.ts                 (PostgreSQL connection pool)
  ├─ gpx-utils.ts          (GPX parsing)
  ├─ geo-utils.ts          (Haversine / polyline math)
  └─ types.ts              (TypeScript types)
```

All frontend and backend runs in one deployment. No CORS — API routes share the same origin.

---

## Key Implementation Details

### API Routes

Next.js API routes replace a separate Express backend:

```typescript
// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  // ...
  return NextResponse.json({ success: true, rides });
}
```

- Use `NextRequest` / `NextResponse` (not `req`/`res`)
- Body accessed via `.json()` or `.formData()`
- No middleware chains — logic goes directly in route handler

**Trail photos:** `POST /api/trail-photos` requires a Strava session. `GET /api/trail-photos` lists only community-visible pins (accepted and attached to a trail). `GET /api/trail-photos/mine` returns the signed-in user’s unpinned uploads. Without auth, the app keeps demo photos in the browser only (object URLs).

**Official park maps (per network):** Signed-in users can upload a georeferenced raster for a network (`POST /api/networks/[id]/map-overlay` → Vercel Blob), align it with two image/basemap point pairs (`PATCH /api/map-overlays/[id]/alignment`), tune opacity (`PATCH /api/map-overlays/[id]`), and manage trace tasks (`GET/POST /api/networks/[id]/digitization-tasks`, `PATCH/DELETE /api/digitization-tasks/[id]`). Migration `012_map_overlays_and_digitization_tasks.sql` adds the tables.

### Database Connection Pool

[`lib/db.ts`](lib/db.ts) exposes `query` / `queryOne` backed by a `pg` `Pool` that is created **lazily** on first use so `next build` can succeed without a live database when no route touches the DB at import time. Auth is **password-only**: either **`DATABASE_URL`** (recommended on Vercel with [Neon](https://neon.tech) via the [Vercel Marketplace](https://vercel.com/marketplace)) or discrete **`TRAIL_DB_*`** including a non-empty **`TRAIL_DB_PGPASSWORD`**.

If **`DATABASE_URL`** is set and discrete `TRAIL_DB_*` values are missing, [`applyDatabaseUrlFallback`](lib/pg-connection-env.mjs) fills them (Next.js and scripts share this logic). For **migrate/seed scripts only**, optional **`DATABASE_URL_MIGRATE`** overwrites `TRAIL_DB_*` after that mapping so you can point migrations at Neon’s **direct** (non-pooler) endpoint while the app uses a **pooled** `DATABASE_URL`.

SSL follows `TRAIL_DB_PGSSLMODE` / `TRAIL_DB_SSL` — same rules as migrate/seed scripts ([`lib/pg-connection-env.mjs`](lib/pg-connection-env.mjs)). Use `disable` for local Docker; `require` (or rely on Neon’s URL) for cloud.

Vercel serverless: `attachDatabasePool` from `@vercel/functions` helps reuse connections across invocations.

#### Neon on Vercel (golden path)

1. **Add Neon**: Vercel project → **Storage** → **Neon**, or `vercel integration add neon` ([Vercel storage docs](https://vercel.com/docs/storage)). Ensure **`DATABASE_URL`** is attached to Production (and Preview if you want branch databases).
2. **Pooled vs direct**: Use Neon’s **pooled** connection string for **`DATABASE_URL`** on Vercel (and usually in local `.env.local` for `npm run dev`). For `npm run db:migrate` / `db:migrate:prod` and GitHub Actions, set **`DATABASE_URL_MIGRATE`** to the **direct** (non-pooler) string if Neon shows both; otherwise a single `DATABASE_URL` is enough until you hit pooler edge cases during DDL.
3. **`vercel env pull .env.local --yes`** syncs env vars for local runs against the linked project.

### File Uploads

Files are parsed directly from `formData` — no multer or extra library:

```typescript
export async function parseZip(file: File): Promise<Ride[]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const zip = await new JSZip().loadAsync(buffer);

  const rides: Ride[] = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (name.endsWith(".gpx")) {
      rides.push(parseGPXContent(await entry.async("string")));
    }
  }
  return rides;
}
```

### Client vs Server Components

Interactive components use `'use client'`. Everything map/drawer-related is a client component.

```typescript
// app/page.tsx — no 'use client', just renders client children
export default function Home() {
  return (
    <div className="flex">
      <LeafletMap />
      <LeftDrawer />
    </div>
  );
}

// app/LeafletMap.tsx — client component
"use client";
import L from "leaflet";
```

### TypeScript Types

```typescript
// lib/types.ts

export interface Ride {
  id: string;
  name: string;
  distance: number;
  elevation: number;
  polyline: [number, number][];
  timestamp: Date;
  pointCount: number;
}

export interface Trail {
  id: string;
  name: string;
  difficulty: "easy" | "intermediate" | "hard" | "not_set";
  direction: "one-way" | "out-and-back" | "loop" | "not_set";
  polyline: [number, number][];
  distanceKm: number;
  elevationGainFt: number;
  notes?: string;
  source: string;
  sourceRideId?: string;
  uploadedByEmail?: string;
  createdAt: Date;
}
```

### Leaflet in Next.js

Leaflet is client-only. Import it inside client components and initialize in `useEffect`:

```typescript
"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function LeafletMap() {
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map("map").setView([42.3526, -71.0552], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      }).addTo(mapRef.current);
    }
  }, []);

  return <div id="map" style={{ height: "100vh", width: "100%" }} />;
}
```

### Environment variables

**Postgres:** server-only vars — never `NEXT_PUBLIC_*`. **Production on Vercel:** prefer **`DATABASE_URL`** from the Neon integration; **local:** Docker `TRAIL_DB_*` or a dev `DATABASE_URL`.

| Variable | Role |
|----------|------|
| `DATABASE_URL` | Standard Postgres URL. When set, **always** maps into `TRAIL_DB_*` (overwrites), so Neon wins over stale discrete vars from old integrations ([`lib/pg-connection-env.mjs`](lib/pg-connection-env.mjs)). Omit `DATABASE_URL` for Docker-only local `TRAIL_DB_*`. |
| `DATABASE_URL_MIGRATE` | Optional. **Migrate/seed scripts only:** parsed after `DATABASE_URL` and **overwrites** `TRAIL_DB_*`. Use Neon’s **direct** (non-pooler) URL here when the app uses a pooled `DATABASE_URL`. |
| `TRAIL_DB_PGHOST` | Hostname (if not using `DATABASE_URL` alone) |
| `TRAIL_DB_PGPORT` | Port (default `5432`) |
| `TRAIL_DB_PGUSER` | User |
| `TRAIL_DB_PGDATABASE` | Database name |
| `TRAIL_DB_PGPASSWORD` | Non-empty password (local Docker, or derived from `DATABASE_URL`) |
| `TRAIL_DB_PGSSLMODE` | e.g. `disable` for local Docker, `require` for cloud (see [`lib/pg-connection-env.mjs`](lib/pg-connection-env.mjs)). **`disable` breaks Neon** unless you remove it: migration URLs on `*.neon.tech` force `require` when parsing `DATABASE_URL` / `DATABASE_URL_MIGRATE`. |
| `TRAIL_DB_SSL` | Set to `false` to force SSL off |

```bash
# .env.local — Neon-style (after vercel env pull or paste from Neon console)
# DATABASE_URL=postgres://...@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
# DATABASE_URL_MIGRATE=postgres://...@ep-xxx.region.aws.neon.tech/neondb?sslmode=require

# .env.local — Docker / discrete vars
TRAIL_DB_PGHOST=localhost
TRAIL_DB_PGPORT=5432
TRAIL_DB_PGUSER=trail_user
TRAIL_DB_PGPASSWORD=localdevpassword
TRAIL_DB_PGDATABASE=trail_overlay
TRAIL_DB_PGSSLMODE=disable

# Optional — first-load basemap (Catalog is the default; set osm for Classic)
# NEXT_PUBLIC_MAP_BASE_STYLE=osm
```

`NEXT_PUBLIC_MAP_BASE_STYLE` — omit (or `stylized`) for **Catalog** as the first-load default; `osm` selects **Classic**. Both modes use **standard OpenStreetMap** raster tiles; Catalog only adds a light warm CSS filter so the base sits closer to the app’s paper/forest palette ([`lib/map-basemap.ts`](lib/map-basemap.ts)). **Classic / Catalog** is chosen from the layers tool button under **zoom to my location** (top-left) and persists in `localStorage` (`trail-overlay-basemap-style`), overriding the env default on return visits until cleared.

---

## Running Locally

```bash
npm run dev
# → http://localhost:3000
```

### Local Postgres with Docker (golden path)

1. Start the DB and print a matching `.env.local` snippet:

   ```bash
   npm run db:local-docker
   ```

   (Uses `docker compose` or `docker-compose`; credentials match [`docker-compose.yml`](docker-compose.yml).)

2. Merge the printed `TRAIL_DB_*` lines into `.env.local`, then:

   ```bash
   npm run db:migrate
   npm run dev
   ```

### Copy production data into local Postgres

Use this when the map or sidebar look empty against a local database that has no trails/networks (or is missing official maps / digitization tasks).

1. **Production** must define `DEV_DUMP_SECRET` (Vercel env) — the same value must appear in your **local** `.env.local`.
2. **Local** `.env.local`: set `DEV_DUMP_SECRET` (must match production). For the dump URL, set `PROD_APP_URL` **or** rely on `NEXT_PUBLIC_APP_URL` (same origin as production). Use the same DB credentials as `npm run db:migrate` (`DATABASE_URL` / `TRAIL_DB_*` / optional `DATABASE_URL_MIGRATE`).
3. Run migrations locally so tables exist (including `012_map_overlays_and_digitization_tasks.sql`):

   ```bash
   npm run db:migrate
   ```

4. Pull and seed:

   ```bash
   npm run db:pull-prod
   ```

`GET /api/dev/dump` returns trails, networks, `network_trails`, `map_overlays`, `map_overlay_alignment_points`, and `network_digitization_tasks`. The seed script uses `ON CONFLICT DO NOTHING` for core rows, then **replaces** overlay-related rows when the dump includes `mapOverlays` (so local matches prod for official maps and tasks). Optional user FKs on overlays/tasks are stored as NULL locally to avoid missing `users` rows.

`npm run db:migrate` and `npm run db:pull-prod` use the same env rules as [`lib/db.ts`](lib/db.ts): password auth via `DATABASE_URL` and/or `TRAIL_DB_*` (see [`scripts/db-script-pool.mjs`](scripts/db-script-pool.mjs)). To hit **Docker** Postgres while `.env.local` points at Neon, override `TRAIL_DB_*` or unset `DATABASE_URL` in your shell **before** `npm run …` (same values as `npm run db:local-docker` prints).

### Production migrations (GitHub Actions)

Pushes to `main` that change `migrations/**` or related DB scripts run [`.github/workflows/db-migrate-production.yml`](.github/workflows/db-migrate-production.yml), which executes `npm run db:migrate:prod` against **Neon** using connection-string auth (same env model as local `npm run db:migrate:prod`). You can also run it manually: **Actions → Production DB migrations → Run workflow**.

Configure **either** Neon connection string secrets or discrete **`TRAIL_DB_*`** + password:

- **Recommended (Neon):** set **`DATABASE_URL_MIGRATE`** to the **direct** (non-pooler) connection string from the Neon dashboard so DDL runs off the pooler. If you also store a pooled URL elsewhere, you can set **`DATABASE_URL`** in Actions too; when both exist, the migrate script applies **`DATABASE_URL` first, then `DATABASE_URL_MIGRATE` wins** for host/user/password (see [`lib/pg-connection-env.mjs`](lib/pg-connection-env.mjs)).
- **Single secret:** one **`DATABASE_URL`** is enough if it already targets the **direct** host (fine for a small project).
- **Discrete vars:** non-empty **`TRAIL_DB_PGPASSWORD`** plus host, user, database, port (any Postgres-compatible host, including Neon).

**Switching to a new Neon project:** update **`DATABASE_URL`** / **`DATABASE_URL_MIGRATE`** (and Vercel env) from the new project’s connection details, then re-run migrations if needed. GitHub secret names stay the same; only values change.

```bash
# Option A — one secret (simplest for Neon)
gh secret set DATABASE_URL --body "postgres://...@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"

# Option B — pooled app URL + direct migrate URL (typical Neon + Vercel)
gh secret set DATABASE_URL --body "postgres://...@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
gh secret set DATABASE_URL_MIGRATE --body "postgres://...@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"

# Option B2 — Actions-only: direct URL in DATABASE_URL_MIGRATE (no DATABASE_URL secret)
gh secret set DATABASE_URL_MIGRATE --body "postgres://...@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"

# Option C — discrete vars (any Postgres)
gh secret set TRAIL_DB_PGHOST --body "your-host"
gh secret set TRAIL_DB_PGUSER --body "your-user"
gh secret set TRAIL_DB_PGPASSWORD --body "your-password"
gh secret set TRAIL_DB_PGDATABASE --body "neondb"
gh secret set TRAIL_DB_PGPORT --body "5432"
gh secret set TRAIL_DB_PGSSLMODE --body "require"
```

List configured names (not values): `gh secret list`

### Moving data from another Postgres (e.g. old Aurora)

- **Fresh start:** point Vercel at Neon, run `npm run db:migrate:prod` (or migrate from an empty DB), deploy. No data transfer.
- **Keep existing rows:** take a logical dump from the source (`pg_dump`), restore into Neon (`pg_restore` or `psql`). Ensure the **`_migrations`** table matches already-applied files under [`migrations/`](migrations/) so CI does not re-apply DDL. Easiest: dump **after** migrations are fully applied on the old DB, restore, then compare `_migrations` to the repo’s `.sql` list.

---

## Gotchas

- **CORS** — not an issue; API routes run on the same origin as the frontend
- **DB connections** — use the pool via `query` / `queryOne`; don't create a new connection per request
- **First DB access** — [`lib/db.ts`](lib/db.ts) builds the pool on first query; misconfigured env surfaces as an error at runtime on the first DB route, not necessarily at deploy time
- **Vercel body limit** — 4.5MB default; increase in `next.config.ts` if needed
- **Leaflet CSS** — must be imported in the client component, not `globals.css`
- **`NEXT_PUBLIC_` prefix** — only needed for env vars that must be readable in the browser; keep `TRAIL_DB_*` and `DATABASE_URL` unprefixed (server-only)
