CREATE TABLE IF NOT EXISTS users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  strava_athlete_id BIGINT      NOT NULL UNIQUE,
  name              TEXT        NOT NULL,
  profile_picture   TEXT,
  access_token      TEXT        NOT NULL,
  refresh_token     TEXT        NOT NULL,
  token_expires_at  TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_strava_athlete_id_idx ON users (strava_athlete_id);

ALTER TABLE trails ADD COLUMN IF NOT EXISTS uploaded_by_user_id UUID REFERENCES users(id);
