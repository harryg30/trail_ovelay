CREATE TABLE trail_photos (
  id                 UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  blob_url           TEXT             NOT NULL,
  thumbnail_url      TEXT,
  lat                DOUBLE PRECISION,
  lon                DOUBLE PRECISION,
  taken_at           TIMESTAMPTZ,
  trail_id           UUID             REFERENCES trails(id) ON DELETE SET NULL,
  trail_lat          DOUBLE PRECISION,
  trail_lon          DOUBLE PRECISION,
  accepted           BOOLEAN          NOT NULL DEFAULT false,
  status             TEXT             NOT NULL DEFAULT 'published',
  created_by_user_id UUID             REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX trail_photos_trail_id_idx ON trail_photos (trail_id);
CREATE INDEX trail_photos_created_at_idx ON trail_photos (created_at DESC);
CREATE INDEX trail_photos_lat_lon_idx ON trail_photos (lat, lon);
CREATE INDEX trail_photos_status_idx ON trail_photos (status);
