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

```typescript
// lib/db.ts
import { Pool } from "pg";

let pool: Pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function query<T = any>(text: string, values?: any[]): Promise<T[]> {
  const result = await getPool().query(text, values);
  return result.rows;
}

export async function queryOne<T = any>(text: string, values?: any[]): Promise<T | null> {
  const result = await getPool().query(text, values);
  return result.rows[0] || null;
}
```

Vercel serverless functions are ephemeral — the pool reuses connections across invocations.

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

### Environment Variables

```bash
# .env.local
DATABASE_URL=postgres://user:pass@localhost:5432/traildb

# Optional — first-load basemap (Catalog is the default; set osm for Classic)
# NEXT_PUBLIC_MAP_BASE_STYLE=osm
```

`DATABASE_URL` has no `NEXT_PUBLIC_` prefix — server-only. Set it in the Vercel dashboard for production.

`NEXT_PUBLIC_MAP_BASE_STYLE` — omit (or `stylized`) for **Catalog** as the first-load default; `osm` selects **Classic**. Both modes use **standard OpenStreetMap** raster tiles; Catalog only adds a light warm CSS filter so the base sits closer to the app’s paper/forest palette ([`lib/map-basemap.ts`](lib/map-basemap.ts)). **Classic / Catalog** is chosen from the layers tool button under **zoom to my location** (top-left) and persists in `localStorage` (`trail-overlay-basemap-style`), overriding the env default on return visits until cleared.

---

## Running Locally

```bash
npm run dev
# → http://localhost:3000
```

### Copy production data into local Postgres

Use this when the map or sidebar look empty against a local database that has no trails/networks (or is missing official maps / digitization tasks).

1. **Production** must define `DEV_DUMP_SECRET` (Vercel env) — the same value must appear in your **local** `.env.local`.
2. **Local** `.env.local`: set `DEV_DUMP_SECRET` (must match production). For the dump URL, set `PROD_APP_URL` **or** rely on `NEXT_PUBLIC_APP_URL` (same origin as production). Use the same `TRAIL_DB_*` values as `npm run db:migrate` (password **or** IAM — see below).
3. Run migrations locally so tables exist (including `012_map_overlays_and_digitization_tasks.sql`):

   ```bash
   npm run db:migrate
   ```

4. Pull and seed:

   ```bash
   npm run db:pull-prod
   ```

`GET /api/dev/dump` returns trails, networks, `network_trails`, `map_overlays`, `map_overlay_alignment_points`, and `network_digitization_tasks`. The seed script uses `ON CONFLICT DO NOTHING` for core rows, then **replaces** overlay-related rows when the dump includes `mapOverlays` (so local matches prod for official maps and tasks). Optional user FKs on overlays/tasks are stored as NULL locally to avoid missing `users` rows.

`npm run db:migrate` and `npm run db:pull-prod` use the same DB auth as production migrate: non-empty `TRAIL_DB_PGPASSWORD` → password auth (typical Docker); otherwise IAM RDS (`TRAIL_DB_AWS_REGION`, `TRAIL_DB_AWS_ROLE_ARN`). `ExpiredTokenException` means refresh AWS credentials (e.g. `aws sso login`). To seed **Docker** Postgres while `.env.local` points at RDS, set `TRAIL_DB_PGHOST=localhost`, `TRAIL_DB_PGUSER=trail_user`, `TRAIL_DB_PGPASSWORD=localdevpassword`, `TRAIL_DB_PGDATABASE=trail_overlay`, `TRAIL_DB_PGSSLMODE=disable` in your shell **before** `npm run …` (values match `docker-compose.yml`).

### Production migrations (GitHub Actions)

Pushes to `main` that change `migrations/**` or `scripts/migrate.mjs` run [`.github/workflows/db-migrate-production.yml`](.github/workflows/db-migrate-production.yml), which executes `npm run db:migrate:prod`. You can also run it manually: **Actions → Production DB migrations → Run workflow**.

Create the same values you use in Vercel (see `TRAIL_DB_*` in the dashboard) as **repository secrets** — for example with [GitHub CLI](https://cli.github.com/). This workflow is currently wired for **password auth** (it fails fast if `TRAIL_DB_PGPASSWORD` is missing/empty).

```bash
gh secret set TRAIL_DB_PGHOST --body "your-host"
gh secret set TRAIL_DB_PGUSER --body "your-user"
gh secret set TRAIL_DB_PGPASSWORD --body "your-password"
gh secret set TRAIL_DB_PGDATABASE --body "postgres"
gh secret set TRAIL_DB_PGPORT --body "5432"
# Optional — match Vercel (e.g. require / disable)
gh secret set TRAIL_DB_PGSSLMODE --body "require"
# gh secret set TRAIL_DB_SSL --body "false"
```

List configured names (not values): `gh secret list`

---

## Gotchas

- **CORS** — not an issue; API routes run on the same origin as the frontend
- **DB connections** — use the pool; don't create a new connection per request
- **Vercel body limit** — 4.5MB default; increase in `next.config.ts` if needed
- **Leaflet CSS** — must be imported in the client component, not `globals.css`
- **`NEXT_PUBLIC_` prefix** — only needed for env vars that must be readable in the browser; keep `DATABASE_URL` unprefixed
