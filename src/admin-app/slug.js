import { supabaseBrowser } from '../lib/supabase/browser-client';
import { RESERVED_EVENT_SLUGS } from '../lib/eventPhase.js';

export function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

// Appends -2, -3, ... until an unused slug is found in the given table.
export async function uniqueSlug(table, base) {
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-constant-condition -- bounded by DB state, admin-only action
  while (true) {
    const { data } = await supabaseBrowser.from(table).select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${n++}`;
  }
}

// An event's page URL is /events/<slug>, permanent once created. "archive" is
// taken by /events/archive, so a title that slugifies to it gets "-event".
export async function uniqueEventSlug(title) {
  let base = slugify(title);
  if (RESERVED_EVENT_SLUGS.includes(base)) base = `${base}-event`;
  return uniqueSlug('calendar_events', base);
}
