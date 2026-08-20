// Multi-language scaffold. All content is English-only today -- there's no
// translated-content data model in Supabase yet, so this deliberately isn't
// full i18n (no per-locale routing, no translation loader). It's the one
// choke point that work would extend: BaseLayout.astro reads DEFAULT_LOCALE
// instead of hardcoding lang="en", so adding a second language later means
// wiring a locale here rather than hunting down every hardcoded "en".
export const DEFAULT_LOCALE = 'en';
