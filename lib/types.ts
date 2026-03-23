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

export type EditMode = 'add-trail' | 'edit-trail' | null

export interface SaveTrailRequest {
  trails: Omit<Trail, "id" | "createdAt" | "uploadedByEmail">[];
}

export interface SaveTrailResponse {
  success: boolean;
  savedTrails?: Trail[];
  error?: string;
}
