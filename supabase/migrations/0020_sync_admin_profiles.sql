-- The Team screen's "Current admins" list reads from public.admin_profiles,
-- which was only ever populated by the invite-admin Edge Function's own
-- manual insert -- so an admin added any other way (invited directly from
-- the Supabase dashboard's Auth > Users screen, a database ownership
-- transfer, anything not going through that one code path) has a real row
-- in auth.users but no corresponding admin_profiles row, and silently never
-- shows up here even though Supabase itself shows them as a real user.
--
-- This trigger makes admin_profiles self-healing: every new auth.users row,
-- from any source, gets a matching admin_profiles row automatically.
-- `on conflict do nothing` so it doesn't clobber a row the invite-admin
-- function's own insert races it to create for the same id.
create or replace function public.handle_new_admin_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data->>'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_admin_user();

-- One-time backfill: any admin that already exists in auth.users today but
-- is missing from admin_profiles (exactly the bug being fixed) gets a row
-- now too, instead of only being covered going forward.
insert into public.admin_profiles (id, email, display_name)
select u.id, u.email, u.raw_user_meta_data->>'display_name'
from auth.users u
left join public.admin_profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
