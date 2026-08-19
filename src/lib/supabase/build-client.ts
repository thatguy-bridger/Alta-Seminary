// Used ONLY inside Astro frontmatter (build-time / SSR), never shipped to the browser.
// Anon key only — RLS's `public_pages`/`public_blog_posts` views and `status = 'published'`
// policies mean this can never see draft content, so there's no need for a service-role key here.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabaseBuild = createClient(url, anonKey, {
  auth: { persistSession: false },
});
