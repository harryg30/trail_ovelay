CREATE TABLE trail_photos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strava_unique_id TEXT NOT NULL UNIQUE,
  ride_id          UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  trail_id         UUID REFERENCES trails(id) ON DELETE SET NULL,
  blob_url         TEXT NOT NULL,
  caption          TEXT,
  pin_lat          DOUBLE PRECISION,
  pin_lon          DOUBLE PRECISION,
  original_lat     DOUBLE PRECISION,
  original_lon     DOUBLE PRECISION,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trail_photos_trail_id_idx ON trail_photos(trail_id);
CREATE INDEX trail_photos_ride_id_idx  ON trail_photos(ride_id);
