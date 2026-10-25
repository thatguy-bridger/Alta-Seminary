import type { APIContext } from 'astro';
import { supabaseBuild } from '../lib/supabase/build-client';
import { buildLlmsTxt } from '../lib/sitemap.js';

export async function GET(context: APIContext) {
  const { data } = await supabaseBuild.from('public_pages').select('route_path, title').order('title');
  const entries = (data || []).map((r: { route_path: string; title: string }) => ({ path: r.route_path, title: r.title }));
  return new Response(buildLlmsTxt(String(context.site), entries), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  });
}
