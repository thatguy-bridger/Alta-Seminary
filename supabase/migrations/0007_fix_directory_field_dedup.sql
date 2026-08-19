-- The original `unique (directory_kind, field_key)` constraint on
-- directory_field_definitions never caught duplicate universal rows
-- (directory_kind IS NULL) -- standard SQL treats every NULL as distinct from
-- every other NULL for uniqueness purposes, so re-running 0002's seed insert
-- (its `on conflict do nothing` never fired for those rows) silently
-- duplicated role/email/phone each time. Kind-specific rows (non-null)
-- deduplicated correctly the whole time.

-- Keep the earliest row per field_key among the universal (null-kind) rows; drop the rest.
delete from public.directory_field_definitions a
using public.directory_field_definitions b
where a.directory_kind is null
  and b.directory_kind is null
  and a.field_key = b.field_key
  and a.id > b.id;

-- Replace the constraint with one that treats NULLs as equal to each other too.
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

alter table public.directory_field_definitions
  add constraint directory_field_definitions_directory_kind_field_key_key
  unique nulls not distinct (directory_kind, field_key);
