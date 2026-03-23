# Trail Overlay MVP - Next.js Implementation Guide

**Switching from:** React + separate Express backend  
**Switching to:** Next.js 14+ (App Router) with API Routes  
**Updated:** March 2024

---

## Why Next.js Changes Your Architecture

Instead of:

```
Frontend (React/Vite)          Backend (Express)
   ↓                                 ↓
Vercel                          Heroku/Railway
```

You get:

```
Next.js (Frontend + Backend)
   ↓
Single Deployment (Vercel)
```

**Advantages:**

- Deploy everything to one place (Vercel, simpler than managing two services)
- No CORS headaches (API routes run on same origin)
- Built-in image optimization, font loading
- Server components for data fetching (simpler than fetch on client)
- TypeScript support baked in (optional but recommended)
- Hot reloading during development

**Trade-offs:**

- You're not learning a separate backend framework (Express)
- Next.js API routes are simpler but less flexible than Express for complex scenarios
- Slightly more opinionated structure

---

## Updated Architecture with Next.js

```
┌─────────────────────────────────────────────────────────────┐
│                   Next.js Application                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  app/                                                    │ │
│  │  ├─ page.tsx          (Home/map page)                   │ │
│  │  ├─ layout.tsx        (Root layout)                     │ │
│  │  └─ api/                                                │ │
│  │     ├─ upload/route.ts        (POST /api/upload)       │ │
│  │     ├─ trails/route.ts        (POST/GET /api/trails)   │ │
│  │     └─ health/route.ts        (GET /api/health)        │ │
│  │                                                          │ │
│  │  components/                                            │ │
│  │  ├─ Map.tsx           (Leaflet map)                    │ │
│  │  ├─ LeftDrawer.tsx    (Upload, segmentation)           │ │
│  │  ├─ MetadataForm.tsx  (Trail metadata)                 │ │
│  │  └─ ...                                                │ │
│  │                                                          │ │
│  │  lib/                                                   │ │
│  │  ├─ db.ts            (PostgreSQL connection pool)      │ │
│  │  ├─ gpx-parser.ts    (GPX parsing utilities)           │ │
│  │  └─ geo-utils.ts     (PostGIS helpers)                 │ │
│  │                                                          │ │
│  │  public/              (Static assets)                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  On Vercel:                                                 │
│  ├─ Node.js runtime for API routes                         │ │
│  └─ Static/SSG for page content                            │ │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    PostgreSQL Database
                    (Vercel Postgres, AWS RDS,
                     or DigitalOcean)
```

---

## Folder Structure & Key Files

```
traildb/
├─ app/
│  ├─ layout.tsx           # Root layout (header, footer, theme provider)
│  ├─ page.tsx             # Home page (map + drawer)
│  ├─ api/
│  │  ├─ upload/
│  │  │  └─ route.ts       # POST /api/upload
│  │  ├─ trails/
│  │  │  └─ route.ts       # GET/POST /api/trails
│  │  └─ health/
│  │     └─ route.ts       # GET /api/health
│  └─ globals.css          # Global styles
│
├─ components/
│  ├─ Map.tsx              # Leaflet map component
│  ├─ LeftDrawer.tsx       # Main drawer shell
│  ├─ UploadZone.tsx       # Drag-drop upload
│  ├─ RidesList.tsx        # List of uploaded rides
│  ├─ SegmentationTool.tsx # Trail cutting UI
│  ├─ MetadataForm.tsx     # Name/difficulty/direction form
│  └─ TrailPopup.tsx       # Trail info on click
│
├─ lib/
│  ├─ db.ts                # PostgreSQL connection & queries
│  ├─ gpx-utils.ts         # GPX parsing (gpxparser wrapper)
│  ├─ geo-utils.ts         # PostGIS helpers (polyline → LINESTRING)
│  ├─ validation.ts        # Input validation (Zod or simple)
│  └─ types.ts             # TypeScript types (Trail, Ride, etc.)
│
├─ public/
│  ├─ images/
│  └─ icons/
│
├─ .env.local              # Local secrets (DB connection string)
├─ .env.example            # Example env vars
├─ next.config.js          # Next.js config
├─ tsconfig.json           # TypeScript config
├─ package.json
└─ README.md
```

---

## Key Implementation Details

### 1. API Routes (Replaces Express)

**Next.js API routes** are simpler than Express—they're just handler functions:

```typescript
// app/api/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { parseGPX, parseZip } from "@/lib/gpx-utils";

export async function POST(request: NextRequest) {
  try {
    // Get multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File too large (max 100MB)" },
        { status: 413 }
      );
    }

    // Parse based on file type
    let rides: Ride[] = [];

    if (file.name.endsWith(".zip")) {
      rides = await parseZip(file);
    } else if (file.name.endsWith(".gpx")) {
      rides = await parseGPX(file);
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Use .gpx or .zip" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      rides,
      uploadId: crypto.randomUUID()
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: "Upload failed" },
      { status: 500 }
    );
  }
}
```

**Differences from Express:**

- No `req`, `res` parameters—use `NextRequest`, `NextResponse` instead
- Request body is accessed via methods like `.json()`, `.formData()`
- Return `NextResponse.json()` instead of `res.json()`
- No middleware chains—logic goes directly in route handler
- Much simpler for this use case

---

### 2. Database Connection Pool

**Create a reusable DB connection** in `lib/db.ts`:

```typescript
// lib/db.ts

import { Pool } from "pg";

let pool: Pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }
  return pool;
}

export async function query<T = any>(
  text: string,
  values?: any[]
): Promise<T[]> {
  const result = await getPool().query(text, values);
  return result.rows;
}

export async function queryOne<T = any>(
  text: string,
  values?: any[]
): Promise<T | null> {
  const result = await getPool().query(text, values);
  return result.rows[0] || null;
}

// Example usage in route handlers:
// const trail = await queryOne('SELECT * FROM trails WHERE id = $1', [trailId]);
```

**Why a connection pool?**

- Vercel serverless functions are ephemeral—don't re-create connections on every request
- Pool reuses connections across invocations
- Prevents "too many connections" errors

---

### 3. File Uploads (Multipart Form Data)

Next.js doesn't have built-in multipart handling like Express + multer. You have options:

**Option A: Manual handling (simple files, works well for GPX/ZIP)**

```typescript
// Parsing ZIP files manually
import { Buffer } from "buffer";
import JSZip from "jszip";

export async function parseZip(file: File): Promise<Ride[]> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const zip = new JSZip();
  await zip.loadAsync(buffer);

  const rides: Ride[] = [];

  for (const [name, file] of Object.entries(zip.files)) {
    if (name.endsWith(".gpx")) {
      const content = await file.async("string");
      const ride = parseGPXContent(content);
      rides.push(ride);
    }
  }

  return rides;
}
```

**Option B: Use a library (more features)**

```typescript
// If you need advanced form parsing, use next-form or manually with formidable
// For MVP, Option A is simpler—just parse the file as Buffer
```

**Recommended:** Use Option A (manual parsing). GPX and ZIP are simple formats to parse.

---

### 4. Client Components vs Server Components

Next.js 14+ splits components into **Server** and **Client**:

**Server Components** (default):

- Run only on the server
- Can access database directly
- Good for data fetching
- Not interactive

**Client Components** (need `'use client'`):

- Run in the browser
- Can use hooks (useState, useEffect)
- Handle interactivity
- Can't access database directly (use API routes instead)

**For TrailDB:**

```typescript
// app/page.tsx - SERVER COMPONENT (no 'use client')
// Fetches initial trails, renders layout

export default async function Home() {
  // Could fetch initial trails here if desired
  // But for MVP, fetch on client for simplicity

  return (
    <div className='flex'>
      <MapContainer /> {/* Client component */}
      <LeftDrawer /> {/* Client component */}
    </div>
  );
}

// components/Map.tsx - CLIENT COMPONENT
("use client");

import { useState, useEffect } from "react";
import L from "leaflet";

export default function MapContainer() {
  const [trails, setTrails] = useState([]);

  useEffect(() => {
    // Fetch trails from /api/trails on mount and when bounds change
    fetchTrails();
  }, []);

  const fetchTrails = async () => {
    const res = await fetch(
      "/api/trails?minLat=42.3&maxLat=42.4&minLng=-71.2&maxLng=-71.0"
    );
    const data = await res.json();
    setTrails(data.trails);
  };

  return <div id='map' />; // Leaflet initializes here
}
```

**Rule of thumb:** Keep components client unless they need server-only features.

---

### 5. Environment Variables

Next.js handles `.env.local` automatically.

```bash
# .env.local (local development)
DATABASE_URL=postgres://user:pass@localhost:5432/traildb
NODE_ENV=development

# .env.production (deployed to Vercel)
DATABASE_URL=postgres://...  # Set in Vercel dashboard, not in file
```

**In code:**

```typescript
const dbUrl = process.env.DATABASE_URL;
// Works in both client and server (Vercel handles secrets)
```

**For Vercel deployment:**

1. Set env vars in Vercel project settings (dashboard)
2. Next.js picks them up automatically during build/runtime

---

### 6. Static Generation vs On-Demand

For MVP, **don't worry about this**—fetch data on the client (simpler).

Post-MVP, you could optimize:

```typescript
// Revalidate trails every 60 seconds
export const revalidate = 60;

export default async function Home() {
  const trails = await fetch("https://yoursite.com/api/trails?radius=100");
  // ...
}
```

But this adds complexity. Start with client-side fetch.

---

### 7. Styling Approach

**Recommended for Next.js:**

Option 1: **Tailwind CSS** (most common)

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

```tsx
// components/Map.tsx
"use client";

export default function Map() {
  return (
    <div className='flex h-screen w-full'>
      <div className='flex-1 bg-gray-100'>{/* Map here */}</div>
      <div className='w-80 bg-white shadow-lg'>{/* Drawer here */}</div>
    </div>
  );
}
```

Option 2: **CSS Modules** (if you prefer scoped CSS)

```tsx
// components/Map.module.css
.container {
  display: flex;
  height: 100vh;
}

// components/Map.tsx
import styles from './Map.module.css';
export default function Map() {
  return <div className={styles.container}>...</div>;
}
```

**Recommendation:** Use Tailwind for faster development.

---

### 8. TypeScript (Highly Recommended)

Next.js ships with TypeScript support. Create `lib/types.ts`:

```typescript
// lib/types.ts

export interface Ride {
  id: string;
  name: string;
  distance: number;
  elevation: number;
  polyline: [number, number][]; // Array of [lat, lng]
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

export interface SaveTrailRequest {
  trails: Omit<Trail, "id" | "createdAt" | "uploadedByEmail">[];
}

export interface SaveTrailResponse {
  success: boolean;
  savedTrails?: Trail[];
  error?: string;
}
```

Then use in components:

```typescript
// components/MapContainer.tsx
"use client";

import { useState } from "react";
import { Trail } from "@/lib/types";

export default function MapContainer() {
  const [trails, setTrails] = useState<Trail[]>([]);
  // TypeScript now knows what properties trails have
}
```

---

### 9. Leaflet in Next.js

Leaflet is a client-only library. Make sure to import in client components:

```typescript
// components/Map.tsx
"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

export default function Map() {
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map("map").setView([42.3526, -71.0552], 11);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      }).addTo(mapRef.current);
    }
  }, []);

  return <div id='map' style={{ height: "100vh", width: "100%" }} />;
}
```

**Known issue:** Leaflet's CSS and icons need to be imported:

```typescript
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Leaflet icon issue on markers—fix it:
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon.src,
  shadowUrl: iconShadow.src
});

L.Marker.prototype.setIcon(DefaultIcon);
```

**Or just use a package** that handles this: `next-leaflet` (experimental) or stick with vanilla Leaflet + the above fix.

---

### 10. Deployment to Vercel

**Vercel is built for Next.js—seamless deployment:**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

**First time:**

1. Vercel CLI prompts you to link to a project
2. Creates a project on vercel.com
3. Builds and deploys your app
4. Gives you a live URL

**For database:**

- Option A: Use Vercel Postgres (managed PostgreSQL + PostGIS)

  - Cost: ~$9–15/month
  - Easiest: Just create and get connection string
  - No ops headache

- Option B: Use external RDS (AWS, DigitalOcean, etc.)
  - Cost: Varies ($5–20/month for small instance)
  - More control
  - You manage backups/scaling

**Recommend:** Vercel Postgres for MVP (simplest, no separate vendor).

---

### 11. Middleware (Optional)

For MVP, skip this. But if you need to log requests, validate tokens, etc., use middleware:

```typescript
// middleware.ts (at root of project)

import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Example: Log API requests
  if (request.nextUrl.pathname.startsWith("/api/")) {
    console.log(`${request.method} ${request.nextUrl.pathname}`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"] // Only run on API routes
};
```

---

### 12. Error Handling

Use Next.js error boundaries:

```typescript
// app/error.tsx (catches errors in child pages/components)

"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

---

## Updated Week 1 Tasks (Next.js Specific)

### Setup

- [ ] Create Next.js project: `npx create-next-app@latest traildb --typescript --tailwind`
- [ ] Install dependencies: `pg`, `jszip`, `gpxparser`, `axios`
- [ ] Set up `lib/db.ts` with PostgreSQL pool
- [ ] Create `lib/types.ts` with TypeScript interfaces

### Database

- [ ] Create PostgreSQL database (local or Vercel Postgres)
- [ ] Enable PostGIS
- [ ] Create `trails` and `uploads` tables
- [ ] Create `schema.sql` file for reference

### API Routes

- [ ] Create `app/api/upload/route.ts`
  - Parse GPX/ZIP files
  - Return ride data
- [ ] Create `app/api/health/route.ts`
- [ ] Test with curl or Postman

### Frontend

- [ ] Create basic `app/page.tsx`
- [ ] Create `components/Map.tsx` (Leaflet setup)
- [ ] Create `components/LeftDrawer.tsx` (shell)
- [ ] Test map loads and can zoom/pan

### Testing

- [ ] Test upload endpoint with sample GPX
- [ ] Verify parsing works correctly
- [ ] Test map renders and is interactive

---

## Package Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "pg": "^8.11.0",
    "jszip": "^3.10.1",
    "gpxparser": "^3.2.1",
    "leaflet": "^1.9.4",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.0",
    "@types/pg": "^8.10.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.31",
    "autoprefixer": "^10.4.16"
  }
}
```

---

## Gotchas & Tips

### 1. **CORS is not an issue**

- API routes run on same origin as frontend
- No need for CORS headers in Next.js (it's all one app)

### 2. **Database connections in serverless**

- Use connection pooling (shown above)
- Don't create new connection per request
- Pool reuses connections across invocations

### 3. **File size limits**

- Vercel has 4.5MB body size limit (can be increased)
- For MVP, users will upload <100MB files, so no issue
- Break large uploads into chunks if needed later

### 4. **Environment variables**

- Prefix with `NEXT_PUBLIC_` if they need to be accessible on client
- Without prefix, they're server-only (secure)
- For this MVP: keep `DATABASE_URL` server-only (no prefix)

### 5. **Hot reload during development**

```bash
npm run dev
# Changes to components reload instantly
# Changes to API routes require manual refresh
```

### 6. **Image optimization**

- Next.js Image component optimizes automatically
- Skip for MVP (not relevant for maps)
- Use for user profile pics / trail photos later

### 7. **Static vs Dynamic**

- Pages are static by default (builds once)
- Add `'use client'` or `dynamic` import for interactivity
- For this MVP, everything is client-interactive (fine)

---

## Local Development Checklist

```bash
# 1. Create project
npx create-next-app@latest traildb --typescript --tailwind
cd traildb

# 2. Install dependencies
npm install pg jszip gpxparser leaflet axios
npm install -D @types/pg

# 3. Create .env.local
echo "DATABASE_URL=postgres://user:pass@localhost:5432/traildb" > .env.local

# 4. Create database
createdb traildb
psql traildb -c "CREATE EXTENSION postgis;"

# 5. Start dev server
npm run dev

# 6. Open browser to http://localhost:3000
```

---

## Comparison: Express vs Next.js API Routes

| Feature          | Express                           | Next.js                       |
| ---------------- | --------------------------------- | ----------------------------- |
| Request handling | `req`, `res` objects              | `NextRequest`, `NextResponse` |
| Middleware       | Chain middleware                  | Per-route logic               |
| File uploads     | `multer` middleware               | Manual formData parsing       |
| Database         | Manual pooling                    | Manual pooling (same)         |
| Deployment       | Separate server (Heroku, Railway) | Vercel (integrated)           |
| Complexity       | More flexible, more setup         | Opinionated, less boilerplate |
| Learning curve   | Intermediate                      | Easier for simple APIs        |

**Verdict:** For this MVP, Next.js is simpler. You avoid managing two separate services.

---

## Summary

**Key changes with Next.js:**

1. **Single deployment** (Vercel) instead of separate frontend + backend
2. **API routes** instead of Express (simpler for this project)
3. **No CORS** (all same origin)
4. **Client vs Server components** (use `'use client'` for interactive parts)
5. **TypeScript recommended** (built-in support)
6. **Environment variables** handled by Vercel automatically on deploy
7. **Faster iteration** (hot reload, single codebase)

**Implementation order:**

1. Set up Next.js project with TypeScript + Tailwind
2. Create database schema + connection pool
3. Build `/api/upload` and `/api/trails` routes
4. Build Map component (client) with Leaflet
5. Build LeftDrawer components (client-side state)
6. Connect frontend to API routes
7. Deploy to Vercel

You're now ready to start Week 1. Let me know if you want sample code for any specific component!
