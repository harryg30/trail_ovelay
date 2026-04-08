-- Speed up "my unpinned" listings
CREATE INDEX IF NOT EXISTS trail_photos_created_by_user_unpinned_idx
  ON trail_photos (created_by_user_id, accepted)
  WHERE status = 'published';
