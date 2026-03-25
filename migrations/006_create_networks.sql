CREATE TABLE networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  polygon JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE network_trails (
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  trail_id   UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  PRIMARY KEY (network_id, trail_id)
);
