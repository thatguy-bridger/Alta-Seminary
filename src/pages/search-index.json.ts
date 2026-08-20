import { getSearchIndex } from '../lib/pages.js';

// Static JSON manifest of every searchable page/announcement, generated at
// build time and fetched once by SiteSearch.jsx.
export async function GET() {
  const index = await getSearchIndex();
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
}
