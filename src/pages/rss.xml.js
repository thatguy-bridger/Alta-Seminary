import rss from '@astrojs/rss';
import { supabaseBuild } from '../lib/supabase/build-client';
import { withBase } from '../lib/url.js';

export async function GET(context) {
  const { data } = await supabaseBuild
    .from('public_blog_posts')
    .select('slug, title, excerpt, published_at')
    .order('published_at', { ascending: false });

  return rss({
    title: 'Alta Seminary Announcements',
    description: 'Announcements from Alta Seminary.',
    site: context.site,
    items: (data || []).map((post) => ({
      title: post.title,
      description: post.excerpt || undefined,
      pubDate: post.published_at ? new Date(post.published_at) : undefined,
      link: withBase(`/announcements/${post.slug}`),
    })),
  });
}
