ALTER TABLE trails ADD COLUMN IF NOT EXISTS osm_way_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_trails_osm_way_id ON trails (osm_way_id) WHERE osm_way_id IS NOT NULL;
