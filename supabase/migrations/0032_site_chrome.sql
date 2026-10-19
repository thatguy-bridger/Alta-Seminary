-- Editable site header/footer: one jsonb value on the single-row site_settings
-- table (validated in the admin UI; the public site falls back to defaults for
-- anything blank), exposed to the public site through a view of just that column.
alter table public.site_settings add column if not exists site_chrome jsonb;

create or replace view public.public_site_chrome with (security_invoker = false) as
  select site_chrome from public.site_settings where id = true;
grant select on public.public_site_chrome to anon, authenticated;
