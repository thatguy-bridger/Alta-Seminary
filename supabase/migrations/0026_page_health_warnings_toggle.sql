-- Lets an admin turn off the Pages list's health badges (Unpublished
-- changes / Empty / Missing meta description / Image missing alt text --
-- see computeHealth() in PagesListScreen.jsx) if they're more noise than
-- help. Defaults to true (today's behavior, unchanged for anyone who
-- doesn't touch this).
alter table public.site_settings add column show_page_health_warnings boolean not null default true;
