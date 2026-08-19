-- Directories are no longer a fixed 3-value enum -- admins can create their
-- own beyond Seminary Council / Missionaries / Staff. This new `directories`
-- table is the admin-managed catalog (name shown on the tab, optional
-- singular_label for "+ New X Member" buttons, sort order). directory_kind on
-- directory_entries/directory_field_definitions becomes plain text holding
-- whichever slug the admin picked, instead of being locked to the enum.
--
-- Existing data needs no backfill: the enum's 3 values ('council',
-- 'missionary', 'staff') are seeded below as matching slugs, so every
-- existing directory_entries/directory_field_definitions row already points
-- at the right catalog row once the column is just retyped to text.

create table public.directories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  singular_label text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.directories (slug, name, singular_label, sort_order) values
  ('council', 'Seminary Council', 'Seminary Council', 1),
  ('missionary', 'Missionaries', 'Missionary', 2),
  ('staff', 'Staff', 'Staff', 3);

alter table public.directories enable row level security;
create policy "public read directories" on public.directories for select using (true);
create policy "admin full access" on public.directories for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- Belt-and-suspenders: Supabase's default per-schema grants normally cover
-- this already (matching every other public table here), but granting
-- explicitly removes any doubt for a table this central.
grant select on public.directories to anon, authenticated;
grant insert, update, delete on public.directories to authenticated;

alter table public.directory_entries alter column directory_kind type text using directory_kind::text;

do $$
declare
  cname text;
begin
  select tc.constraint_name into cname
  from information_schema.table_constraints tc
  where tc.table_schema = 'public'
    and tc.table_name = 'directory_field_definitions'
    and tc.constraint_type = 'UNIQUE';
  if cname is not null then
    execute format('alter table public.directory_field_definitions drop constraint %I', cname);
  end if;
end $$;

alter table public.directory_field_definitions alter column directory_kind type text using directory_kind::text;

alter table public.directory_field_definitions
  add constraint directory_field_definitions_directory_kind_field_key_key
  unique nulls not distinct (directory_kind, field_key);

drop type if exists public.directory_kind;
