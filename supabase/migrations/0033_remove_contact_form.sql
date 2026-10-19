-- The contact form and its admin inbox are gone; /contact is now an ordinary
-- editable page with plain contact details. (The table held 0 rows when dropped.)
drop table if exists public.contact_submissions cascade;
drop function if exists public.enforce_contact_rate_limit();
