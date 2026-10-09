import { defineConfig } from 'vitest/config';

// Plain Vite config, deliberately separate from astro.config.mjs: these tests
// cover pure logic and React components, none of which need Astro's pipeline.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{js,jsx}'],
    environment: 'node', // component tests opt in with "// @vitest-environment jsdom"
  },
  // Source files import the Supabase browser client, which throws at import
  // time without a URL. Tests never touch the network, so any placeholder will do.
  define: {
    'import.meta.env.PUBLIC_SUPABASE_URL': JSON.stringify('http://localhost:54321'),
    'import.meta.env.PUBLIC_SUPABASE_ANON_KEY': JSON.stringify('test-anon-key'),
  },
});
