// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// NOTE on `site`/`base`:
// - Before the custom domain is pointed, this deploys to https://<user>.github.io/<repo>/,
//   which requires `base: '/<repo>'` (uncomment + set below) so internal links/asset paths resolve.
// - Once `public/CNAME` is added and the domain is repointed in GitHub Pages settings,
//   switch back to `base: '/'` (the default) and update `site` to the real domain.
// Getting this wrong is the most common GitHub Pages footgun — see PROJECT_SPEC.md / build plan.
export default defineConfig({
  site: 'https://altaseminary.com',
  // base: '/REPLACE_WITH_REPO_NAME', // uncomment while serving from username.github.io/<repo>
  integrations: [
    react(),
    sitemap({
      // /admin/* is the editor, not public content — keep it out of the sitemap entirely.
      filter: (page) => !page.includes('/admin/'),
    }),
  ],
});
