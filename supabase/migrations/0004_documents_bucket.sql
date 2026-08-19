-- Storage bucket for downloadable documents (permission slips, forms, etc.)
-- Separate from `images` since that bucket is restricted to image/* mime types.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', true, 20971520, array[
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png', 'image/jpeg'
])
on conflict (id) do nothing;

create policy "public read documents" on storage.objects for select using (bucket_id = 'documents');
create policy "admin upload documents" on storage.objects for insert with check (bucket_id = 'documents' and auth.role() = 'authenticated');
create policy "admin update documents" on storage.objects for update using (bucket_id = 'documents' and auth.role() = 'authenticated') with check (bucket_id = 'documents' and auth.role() = 'authenticated');
create policy "admin delete documents" on storage.objects for delete using (bucket_id = 'documents' and auth.role() = 'authenticated');
