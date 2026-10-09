import rss from '@astrojs/rss';
import { supabaseBuild } from '../lib/supabase/build-client';
import { withBase } from '../lib/url.js';
import { mergeAnnouncements } from '../lib/announcementsFeed.js';

export async function GET(context) {
  const [{ data: posts }, { data: events }] = await Promise.all([
    supabaseBuild.from('public_blog_posts').select('id, slug, title, excerpt, published_at').order('published_at', { ascending: false }),
    // Events that opted into the announcements feed and haven't ended -- the
    // same rule as the on-site feed (lib/announcementsFeed.js).
    supabaseBuild.from('calendar_events')
      .select('id, slug, title, description, location, start_at, end_at, all_day, status, published_at, show_in_announcements')
      .eq('status', 'published').eq('show_in_announcements', true),
  ]);
  const data = mergeAnnouncements(posts, events);

  return rss({
    title: 'Alta Seminary Announcements',
    description: 'Announcements from Alta Seminary.',
    site: context.site,
    items: (data || []).map((post) => ({
      title: post.title,
      description: post.excerpt || undefined,
      pubDate: post.published_at ? new Date(post.published_at) : undefined,
      link: withBase(post.kind === 'event' ? `/events/${post.slug}` : `/announcements/${post.slug}`),
    })),
  });
}
