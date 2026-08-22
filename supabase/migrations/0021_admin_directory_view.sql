-- The Team screen only ever showed admin_profiles' own few columns (name/
-- email/invited date) -- nowhere near what Supabase's own Auth > Users table
-- shows for the same accounts (created date, last sign-in, whether they've
-- actually confirmed/set a password yet, sign-in method). auth.users itself
-- has none of that reachable from the browser client (no anon/authenticated
-- grant, and it shouldn't -- it also holds password hashes and other
-- sensitive columns this view deliberately never selects).
--
-- security_invoker = false (the default) is required here, same reasoning as
-- public_pages/public_blog_posts in 0001_init.sql: it makes the view run as
-- its OWNER (who can see auth.users) rather than as the querying admin (who
-- can't), so the view itself becomes the safe, narrow window onto exactly
-- the columns below -- nothing else in auth.users is reachable through it.
create view public.admin_directory with (security_invoker = false) as
select
  p.id,
  p.email,
  p.display_name,
  p.invited_at,
  p.invited_by,
  u.created_at,
  u.last_sign_in_at,
  u.email_confirmed_at is not null as confirmed,
  coalesce(u.raw_app_meta_data->>'provider', 'email') as provider
from public.admin_profiles p
join auth.users u on u.id = p.id;

grant select on public.admin_directory to authenticated;
