import GPXParser from "gpxparser";
import JSZip from "jszip";
import { Ride } from "@/lib/types";

function parseGPXContent(content: string, filename: string): Ride {
  const gpx = new GPXParser();
  gpx.parse(content);

  const track = gpx.tracks[0];
  const points = track?.points ?? [];

  const polyline: [number, number][] = points.map((p: any) => [p.lat, p.lon]);

  return {
    id: crypto.randomUUID(),
    name: track?.name || filename.replace(/\.gpx$/i, ""),
    distance: gpx.tracks[0]?.distance?.total ?? 0,
    elevation: gpx.tracks[0]?.elevation?.pos ?? 0,
    polyline,
    timestamp: points[0]?.time ? new Date(points[0].time) : new Date(),
    pointCount: points.length,
  };
}

export async function parseGPX(file: File): Promise<Ride[]> {
  const content = await file.text();
  return [parseGPXContent(content, file.name)];
}

export async function parseZip(file: File): Promise<Ride[]> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const rides: Ride[] = [];

  for (const [name, entry] of Object.entries(zip.files)) {
    if (name.endsWith(".gpx") && !entry.dir) {
      const content = await entry.async("string");
      rides.push(parseGPXContent(content, name));
    }
  }

  return rides;
}
