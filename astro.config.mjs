// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// Moved off GitHub Pages (static-only) to Vercel specifically so content
// edits show up on the next page load instead of waiting on a GitHub
// Actions rebuild -- see the "instant updates" discussion in chat history.
// `output: 'server'` + the Vercel adapter means every route below renders
// per-request by default; `site`/`base` no longer need the GitHub Pages
// repo-subpath dance since Vercel serves from the deployment's own root.
export default defineConfig({
  // Swap to the real altaseminary.com once the custom domain is pointed.
  site: 'https://alta-seminary-omega.vercel.app',
  output: 'server',
  adapter: vercel(),
  integrations: [
    react(),
    sitemap({
      // /admin/* is the editor, not public content — keep it out of the sitemap entirely.
      filter: (page) => !page.includes('/admin/'),
    }),
  ],
});
