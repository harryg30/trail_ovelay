export interface Ride {
  id: string;
  name: string;
  distance: number;
  elevation: number;
  polyline: [number, number][];
  timestamp: Date;
  pointCount: number;
  stravaActivityId?: number;
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

export interface TrimPoint {
  rideId: string;
  index: number;
}

export interface TrimSegment {
  ride: Ride;
  startIndex: number;
  endIndex: number;
  polyline: [number, number][];
  distanceKm: number;
  elevationGainFt: number;
}

export interface TrimFormState {
  name: string;
  difficulty: Trail["difficulty"];
  direction: Trail["direction"];
  notes: string;
}

export type EditMode = 'add-trail' | 'edit-trail' | 'refine-trail' | 'add-network' | 'edit-network' | null

export interface Network {
  id: string;
  name: string;
  polygon: [number, number][];
  trailIds: string[];
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

export interface TrailPhoto {
  id: string
  stravaUniqueId: string
  rideId: string
  trailId: string | null
  blobUrl: string
  caption: string | null
  pinLat: number | null
  pinLon: number | null
  score: number           // SUM(value) from photo_votes
  userVote: 1 | -1 | null // null when unauthenticated
  createdAt: Date
}
