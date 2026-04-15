-- Trail versioning: change sets, per-trail revisions, and revision comments
-- Adds updated_at / updated_by_user_id convenience columns to trails.

-- 1. updated_at / updated_by_user_id on trails (denormalised convenience)
ALTER TABLE trails
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. trail_change_sets — optional grouping (OSM-changeset-lite)
CREATE TABLE IF NOT EXISTS trail_change_sets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trail_change_sets_user_idx
  ON trail_change_sets (created_by_user_id);
CREATE INDEX IF NOT EXISTS trail_change_sets_created_at_idx
  ON trail_change_sets (created_at DESC);

-- 3. trail_revisions — append-only audit + rollback source
CREATE TABLE IF NOT EXISTS trail_revisions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id            UUID        NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
  change_set_id       UUID        REFERENCES trail_change_sets(id) ON DELETE SET NULL,
  parent_revision_id  UUID        REFERENCES trail_revisions(id) ON DELETE SET NULL,
  action              TEXT        NOT NULL CHECK (action IN ('create', 'update', 'delete', 'rollback')),
  summary             TEXT,
  payload             JSONB       NOT NULL
);

CREATE INDEX IF NOT EXISTS trail_revisions_trail_id_idx
  ON trail_revisions (trail_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trail_revisions_created_at_idx
  ON trail_revisions (created_at DESC);
CREATE INDEX IF NOT EXISTS trail_revisions_change_set_idx
  ON trail_revisions (change_set_id)
  WHERE change_set_id IS NOT NULL;

-- 4. trail_revision_comments — discussion thread per trail (optionally tied to a revision)
CREATE TABLE IF NOT EXISTS trail_revision_comments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id        UUID        NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  revision_id     UUID        REFERENCES trail_revisions(id) ON DELETE SET NULL,
  author_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trail_revision_comments_trail_idx
  ON trail_revision_comments (trail_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trail_revision_comments_revision_idx
  ON trail_revision_comments (revision_id)
  WHERE revision_id IS NOT NULL;
