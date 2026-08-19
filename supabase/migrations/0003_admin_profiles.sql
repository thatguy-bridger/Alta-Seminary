-- Lightweight admin directory so the Team screen can list who has access without
-- needing service-role calls from the browser (auth.users isn't PostgREST-exposed).
-- Populated by the invite-admin Edge Function (service role), read by any admin.
create table public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  invited_at timestamptz not null default now(),
  invited_by uuid references auth.users(id)
);

alter table public.admin_profiles enable row level security;

create policy "admins can view the team" on public.admin_profiles
  for select using (auth.role() = 'authenticated');

create policy "admins can update their own profile" on public.admin_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- No insert/delete policy for regular clients — those only happen via the
-- invite-admin Edge Function's service-role client, which bypasses RLS.
