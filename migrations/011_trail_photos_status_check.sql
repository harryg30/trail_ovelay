-- Align DB with app union: 'published' | 'hidden' | 'flagged'
ALTER TABLE trail_photos
  ADD CONSTRAINT trail_photos_status_check
  CHECK (status IN ('published', 'hidden', 'flagged'));
