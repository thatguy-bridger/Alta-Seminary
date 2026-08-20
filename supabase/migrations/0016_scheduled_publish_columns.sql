-- publish_at: when a 'scheduled' row should actually go live (sweep-scheduled-
-- content Edge Function flips it to 'published' once publish_at <= now(),
-- using whatever draft_blocks looks like AT THAT MOMENT -- same as clicking
-- Publish by hand, just deferred).
-- unpublish_at: optional, only meaningful once published -- the same sweep
-- flips a published row back to 'draft' once this passes. Content itself
-- (published_blocks) is left alone, so re-publishing later needs no rework.
alter table public.pages add column publish_at timestamptz;
alter table public.pages add column unpublish_at timestamptz;
alter table public.blog_posts add column publish_at timestamptz;
alter table public.blog_posts add column unpublish_at timestamptz;
