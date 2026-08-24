-- Storage bucket for uploaded audio (Background Music block, and any future
-- audio use) -- separate from `documents` since that bucket's own
-- allowed_mime_types list (0004_documents_bucket.sql) doesn't include audio,
-- and separate from `images` for the same reason.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', true, 52428800, array[
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a'
])
on conflict (id) do nothing;

create policy "public read audio" on storage.objects for select using (bucket_id = 'audio');
create policy "admin upload audio" on storage.objects for insert with check (bucket_id = 'audio' and auth.role() = 'authenticated');
create policy "admin update audio" on storage.objects for update using (bucket_id = 'audio' and auth.role() = 'authenticated') with check (bucket_id = 'audio' and auth.role() = 'authenticated');
create policy "admin delete audio" on storage.objects for delete using (bucket_id = 'audio' and auth.role() = 'authenticated');
