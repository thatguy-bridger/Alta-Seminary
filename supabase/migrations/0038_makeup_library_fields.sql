-- A large starting library needs to say where each item came from and be re-importable without duplicates.
alter table public.makeup_sources
  add column author text,
  add column series text,           -- e.g. "Book of Mormon", "April 2026 general conference"
  add column origin_url text;       -- where the text or audio came from (also the de-duplication key)
create unique index makeup_sources_origin_idx on public.makeup_sources (origin_url) where origin_url is not null;
create index makeup_sources_kind_idx on public.makeup_sources (kind, active);

create or replace view public.public_makeup_sources with (security_invoker = false) as
  select id, kind, title, description, reference, body, embed_url, minutes, duration_seconds, transcript, author, series
  from public.makeup_sources where active order by sort_order, title;
grant select on public.public_makeup_sources to anon, authenticated;
