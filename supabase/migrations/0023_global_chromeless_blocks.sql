-- Exposes every "chromeless" block (Background Music, Back to Top, Timed
-- Popup, Site Effect, ...) that an admin flagged "Show on all pages" (a
-- layout.showOnAllPages=true field, set in the block's own settings panel --
-- see registry.js's `chromeless` flag and BlockConfigPanel.jsx), from
-- WHATEVER published page it actually lives on, so PublicLayout.astro can
-- render it once on every page regardless of which one is being viewed.
-- security_invoker = false (same reasoning as public_pages/public_blog_posts
-- in 0001_init.sql): this reads published_blocks off the base `pages` table,
-- which anon/authenticated can't select directly, but only ever surfaces
-- blocks the admin explicitly published AND explicitly opted into showing
-- everywhere -- never draft content, never anything else on that page.
create view public.global_chromeless_blocks
with (security_invoker = false) as
select
  (elem->>'id') as id,
  (elem->>'type') as type,
  coalesce(elem->'props', '{}'::jsonb) as props,
  coalesce(elem->'layout', '{}'::jsonb) as layout
from public.pages p,
     jsonb_array_elements(coalesce(p.published_blocks, '[]'::jsonb)) as elem
where p.status = 'published'
  and (elem->'layout'->>'showOnAllPages') = 'true';

grant select on public.global_chromeless_blocks to anon, authenticated;
