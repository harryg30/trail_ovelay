import { NextRequest, NextResponse } from "next/server";
import { parseGPX, parseZip } from "@/lib/gpx-utils";
import { getSessionUserId } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Ride } from "@/lib/types";

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File too large (max 100MB)" },
        { status: 413 }
      );
    }

    const name = file.name.toLowerCase();

    if (!name.endsWith(".gpx") && !name.endsWith(".zip")) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Use .gpx or .zip" },
        { status: 400 }
      );
    }

    const parsedRides = name.endsWith(".zip")
      ? await parseZip(file)
      : await parseGPX(file);

    const rides: Ride[] = []
    for (const ride of parsedRides) {
      const rows = await query<{ id: string }>(
        `INSERT INTO rides (user_id, name, distance, elevation, polyline, point_count, timestamp)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         RETURNING id`,
        [userId, ride.name, ride.distance, ride.elevation, JSON.stringify(ride.polyline), ride.pointCount, ride.timestamp]
      )
      if (rows[0]) {
        rides.push({ ...ride, id: rows[0].id })
      }
    }

    return NextResponse.json({ success: true, rides });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: "Upload failed" },
      { status: 500 }
    );
  }
}
