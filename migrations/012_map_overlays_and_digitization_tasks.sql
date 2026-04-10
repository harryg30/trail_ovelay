-- Official park map per network (georeferenced with two image/map point pairs).
CREATE TABLE map_overlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  blob_url TEXT NOT NULL,
  source_url TEXT,
  title TEXT,
  printed_date DATE,
  image_width INT NOT NULL CHECK (image_width > 0),
  image_height INT NOT NULL CHECK (image_height > 0),
  transform JSONB,
  opacity NUMERIC NOT NULL DEFAULT 0.55 CHECK (opacity >= 0 AND opacity <= 1),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT map_overlays_one_per_network UNIQUE (network_id)
);

CREATE TABLE map_overlay_alignment_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_overlay_id UUID NOT NULL REFERENCES map_overlays(id) ON DELETE CASCADE,
  seq SMALLINT NOT NULL CHECK (seq IN (1, 2)),
  img_x DOUBLE PRECISION NOT NULL,
  img_y DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  UNIQUE (map_overlay_id, seq)
);

CREATE INDEX map_overlay_alignment_points_overlay_idx ON map_overlay_alignment_points (map_overlay_id);

CREATE TABLE network_digitization_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  map_overlay_id UUID REFERENCES map_overlays(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('named_route', 'intersection_route', 'loop', 'other')),
  label TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  completed_trail_id UUID REFERENCES trails(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  completed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX network_digitization_tasks_network_idx ON network_digitization_tasks (network_id);
