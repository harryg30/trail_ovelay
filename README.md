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

---

## Gotchas

- **CORS** — not an issue; API routes run on the same origin as the frontend
- **DB connections** — use the pool; don't create a new connection per request
- **Vercel body limit** — 4.5MB default; increase in `next.config.ts` if needed
- **Leaflet CSS** — must be imported in the client component, not `globals.css`
- **`NEXT_PUBLIC_` prefix** — only needed for env vars that must be readable in the browser; keep `DATABASE_URL` unprefixed
