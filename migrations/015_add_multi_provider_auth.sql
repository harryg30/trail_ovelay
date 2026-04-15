-- Add multi-provider authentication support
-- Enables Google OAuth alongside existing Strava OAuth
-- Makes strava_athlete_id nullable for Google users, adds provider and google_sub columns

-- Add provider column (default 'strava' for backward compatibility)
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'strava' CHECK (provider IN ('strava', 'google', 'dev'));

-- Add google_sub for Google OAuth identity (partial unique index avoids indexing NULLs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique_idx ON users (google_sub) WHERE google_sub IS NOT NULL;

-- Add email for Google OAuth users (optional, may be populated from Google profile)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for email lookups (useful for future features like password reset)
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email) WHERE email IS NOT NULL;

-- Update existing rows to mark them as Strava users explicitly (only backfill NULLs)
UPDATE users SET provider = 'strava' WHERE provider IS NULL;

-- Make provider NOT NULL after data migration
ALTER TABLE users ALTER COLUMN provider SET NOT NULL;

-- Make strava_athlete_id nullable to support Google OAuth users who have no Strava account
-- Existing Strava users will retain their strava_athlete_id
ALTER TABLE users ALTER COLUMN strava_athlete_id DROP NOT NULL;

-- Drop the existing unique constraint on strava_athlete_id and recreate as a conditional unique index
-- This allows NULL values for Google users while keeping the constraint for Strava users
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_strava_athlete_id_key;
DROP INDEX IF EXISTS users_strava_athlete_id_idx;
CREATE UNIQUE INDEX IF NOT EXISTS users_strava_athlete_id_unique_idx ON users (strava_athlete_id) WHERE strava_athlete_id IS NOT NULL;

