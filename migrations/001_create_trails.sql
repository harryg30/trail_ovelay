CREATE TABLE IF NOT EXISTS trails (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  difficulty        TEXT        NOT NULL DEFAULT 'not_set',
  direction         TEXT        NOT NULL DEFAULT 'not_set',
  polyline          JSONB       NOT NULL,
  distance_km       NUMERIC     NOT NULL,
  elevation_gain_ft NUMERIC     NOT NULL DEFAULT 0,
  notes             TEXT,
  source            TEXT        NOT NULL,
  source_ride_id    TEXT,
  uploaded_by_email TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
