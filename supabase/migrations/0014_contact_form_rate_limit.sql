-- No cap on total contact submissions -- just throttles how fast the same
-- email can send repeatedly, as a server-side backstop to the client-side
-- cooldown in ContactFormBlock.jsx (which a direct API call bypasses).
create or replace function public.enforce_contact_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.contact_submissions
    where lower(email) = lower(new.email)
      and created_at > now() - interval '2 minutes'
  ) then
    raise exception 'Please wait a moment before sending another message.';
  end if;
  return new;
end;
$$;

create trigger trg_contact_rate_limit
  before insert on public.contact_submissions
  for each row execute function public.enforce_contact_rate_limit();
