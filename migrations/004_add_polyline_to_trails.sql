-- Add columns that may be missing if the trails table was created before migration 001 was updated
ALTER TABLE trails ADD COLUMN IF NOT EXISTS polyline          JSONB;
ALTER TABLE trails ADD COLUMN IF NOT EXISTS distance_km       NUMERIC;
ALTER TABLE trails ADD COLUMN IF NOT EXISTS elevation_gain_ft NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE trails ADD COLUMN IF NOT EXISTS direction         TEXT    NOT NULL DEFAULT 'not_set';
ALTER TABLE trails ADD COLUMN IF NOT EXISTS difficulty        TEXT    NOT NULL DEFAULT 'not_set';
ALTER TABLE trails ADD COLUMN IF NOT EXISTS source            TEXT;
ALTER TABLE trails ADD COLUMN IF NOT EXISTS source_ride_id    TEXT;
ALTER TABLE trails ADD COLUMN IF NOT EXISTS uploaded_by_email TEXT;
