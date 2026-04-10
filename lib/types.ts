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
  difficulty: "easy" | "intermediate" | "hard" | "pro" | "not_set";
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
  networkId?: string;
}

export type EditMode =
  | 'add-trail'
  | 'edit-trail'
  | 'refine-trail'
  | 'add-network'
  | 'edit-network'
  | 'network-map'
  | 'draw-trail'
  | 'add-trail-photo'
  | null

export interface DraftTrail {
  localId: string
  isDraft: true
  name: string
  difficulty: Trail["difficulty"]
  direction: Trail["direction"]
  polyline: [number, number][]
  distanceKm: number
  elevationGainFt: number
  notes?: string
  source: string
  sourceRideId?: string
  networkId?: string
  createdAt: string
}

export interface Network {
  id: string;
  name: string;
  polygon: [number, number][];
  trailIds: string[];
  createdAt: Date;
  /** Present when loaded from GET /api/networks (joined map_overlays). */
  hasOfficialMap?: boolean;
  /** True when a map_overlays row exists and transform is set (showable on basemap). */
  officialMapAligned?: boolean;
}

export interface RidePhoto {
  id: string;
  rideId: string;
  blobUrl: string;
  thumbnailUrl?: string;
  lat?: number;
  lon?: number;
  takenAt?: Date;
  trailId?: string;
  trailLat?: number;
  trailLon?: number;
  accepted: boolean;
}

export interface TrailPhoto {
  id: string;
  blobUrl: string;
  thumbnailUrl?: string;
  lat?: number;
  lon?: number;
  takenAt?: Date;
  trailId?: string;
  trailLat?: number;
  trailLon?: number;
  accepted: boolean;
  status: 'published' | 'hidden' | 'flagged';
  createdByUserId?: string;
  createdAt: Date;
  /** Client-only demo photo (not persisted). */
  isLocal?: boolean;
}

export interface SaveTrailRequest {
  trails: Omit<Trail, "id" | "createdAt" | "uploadedByEmail">[];
}

export interface SaveTrailResponse {
  success: boolean;
  savedTrails?: Trail[];
  error?: string;
}

export type DigitizationTaskKind =
  | "named_route"
  | "intersection_route"
  | "loop"
  | "other";

/** Persisted JSON from `buildMapOverlayTransform` (lib/map-overlay-transform). */
export type MapOverlayTransformJson = {
  kind: "similarity_two_point";
  imageWidth: number;
  imageHeight: number;
  p1Img: { x: number; y: number };
  p1Ll: { lat: number; lon: number };
  p2Img: { x: number; y: number };
  p2Ll: { lat: number; lon: number };
  southWest: [number, number];
  northEast: [number, number];
};

export interface MapOverlayRecord {
  id: string;
  networkId: string;
  blobUrl: string;
  sourceUrl?: string;
  title?: string;
  printedDate?: string;
  imageWidth: number;
  imageHeight: number;
  transform: MapOverlayTransformJson | null;
  opacity: number;
  createdAt: Date;
}

export interface MapOverlayAlignmentPoint {
  seq: 1 | 2;
  imgX: number;
  imgY: number;
  lat: number;
  lon: number;
}

export interface NetworkDigitizationTask {
  id: string;
  networkId: string;
  mapOverlayId?: string;
  kind: DigitizationTaskKind;
  label: string;
  description?: string;
  sortOrder: number;
  completedTrailId?: string;
  completedAt?: Date;
  completedByUserId?: string;
  createdAt: Date;
}

/** Draw-trail flow: publishing can complete a task; networkId pre-fills network membership. */
export type PendingDigitizationTask = { id: string; label: string; networkId: string }

/** Client payload for rendering the georeferenced official map on Leaflet. */
export type OfficialMapLayerPayload = {
  /** Which network this overlay belongs to (row toggle / panel sync). */
  networkId?: string;
  blobUrl: string;
  opacity: number;
  transform: MapOverlayTransformJson | null;
  visible: boolean;
};
