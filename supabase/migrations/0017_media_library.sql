-- Every image any admin uploads gets tracked here, so the "choose an
-- existing image" picker (ImageSourceMenu.jsx) has something fast to query
-- instead of recursively listing every folder in the images storage bucket.
create table public.media_library (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  storage_path text not null,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index media_library_created_at_idx on public.media_library (created_at desc);

alter table public.media_library enable row level security;
create policy "admin read media library" on public.media_library for select using (auth.role() = 'authenticated');
create policy "admin insert media library" on public.media_library for insert with check (auth.role() = 'authenticated');
grant select, insert on public.media_library to authenticated;
