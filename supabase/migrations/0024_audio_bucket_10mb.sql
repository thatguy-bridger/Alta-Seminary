-- Lowers the `audio` bucket's own file_size_limit from its original 50MB
-- (0022_audio_bucket.sql) to 10MB, matching fileUpload.js's client-side
-- check -- the client check alone is only a UX nicety (a modified/replayed
-- request could skip past it), so the bucket itself needs to actually
-- enforce the real limit.
update storage.buckets set file_size_limit = 10485760 where id = 'audio';
