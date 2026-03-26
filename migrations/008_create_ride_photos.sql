CREATE TABLE ride_photos (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id          UUID             NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  strava_photo_id  BIGINT           UNIQUE,
  blob_url         TEXT             NOT NULL,
  thumbnail_url    TEXT,
  lat              DOUBLE PRECISION,
  lon              DOUBLE PRECISION,
  taken_at         TIMESTAMPTZ,
  trail_id         UUID             REFERENCES trails(id) ON DELETE SET NULL,
  trail_lat        DOUBLE PRECISION,
  trail_lon        DOUBLE PRECISION,
  accepted         BOOLEAN          NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX ride_photos_ride_id_idx ON ride_photos (ride_id);
CREATE INDEX ride_photos_trail_id_idx ON ride_photos (trail_id);
