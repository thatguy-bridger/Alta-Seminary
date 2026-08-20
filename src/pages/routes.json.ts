import { getAllRoutes } from '../lib/pages.js';

// Static JSON manifest of every real published path, generated at build
// time. Fetched by 404.astro to find the closest still-real ancestor page
// instead of showing a dead end.
export async function GET() {
  const routes = await getAllRoutes();
  return new Response(JSON.stringify(routes), {
    headers: { 'Content-Type': 'application/json' },
  });
}
