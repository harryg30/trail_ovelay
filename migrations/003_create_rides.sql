CREATE TABLE IF NOT EXISTS rides (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  distance      NUMERIC     NOT NULL DEFAULT 0,
  elevation     NUMERIC     NOT NULL DEFAULT 0,
  polyline      JSONB       NOT NULL,
  point_count   INTEGER     NOT NULL DEFAULT 0,
  timestamp     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rides_user_id_idx ON rides (user_id);
