# Alta Seminary Design System

A design system for **Alta High School LDS Seminary**, part of Seminaries and Institutes (S&I) of the Church of Jesus Christ of Latter-day Saints. No brand codebase, Figma file, or slide deck was provided for this project — the system is built from the **published Church/S&I public style guides** (linked below) rather than a proprietary source.

## Sources
- Seminaries and Institutes Style Guide — https://www.churchofjesuschrist.org/si/style-guide?lang=eng (approved fonts, colors, imagery rules)
- Church Communication Guide, 4.2.5 Colors — https://guide.churchofjesuschrist.org/4-2-5-colors?lang=eng (color philosophy)
- No codebase, Figma file, or slide deck was attached to this project.

**No logo was provided or used.** The S&I style guide explicitly prohibits using official Church logos, icons, or light rays outside correlated channels — so a wordmark set in serif type stands in for a mark throughout (see `guidelines/brand-wordmark.card.html`). If Alta Seminary has its own school/seminary logo, attach it and it will replace the wordmark.

## Content fundamentals
- **Fonts are restricted, not stylistic.** The S&I guide names only Times New Roman, Helvetica, and Arial as approved — this system uses system font stacks, no custom webfonts (nothing to substitute or flag; the restriction *is* the brand choice).
- **Tone:** warm, direct, reverent, personal. Copy speaks to real students doing real things ("Bring your scriptures," "Meet at the seminary building at 5:30 AM") rather than marketing language.
- **Voice:** plain, service-oriented, second person for instructions ("Bring...", "Check the Schedule tab"), first-person-plural for community ("we're excited to start a new year together").
- **Casing:** sentence case for body copy and announcements; title case for headings and nav labels.
- **No emoji.** The Church's own guidance favors plain, respectful communication; no emoji appear in any source material.
- **Imagery captions/attribution:** when photos of real students are used, the guide encourages naming people to add credibility and authenticity.

## Visual foundations
- **Color:** updated to follow **Alta High School's own colors — black and silver** (the school's official colors; some retailer listings cite red/black instead, so we kept the color story simple and confirmed: black + silver as the core identity). A single crimson accent (not an official school color) is layered in for links, secondary CTAs, and status highlights, since black + silver alone leaves no room for interactive emphasis. Neutrals now run cool (blue-gray undertone) instead of the earlier warm S&I-inspired tones. The previous gold/teal palette (derived from generic Church color philosophy) has been replaced — see git history / earlier versions if needed.
- **Type:** serif (Times New Roman) for display/heading moments — scripture quotes, section titles — evoking print/devotional materials; sans (Arial) for all UI and body text. No decorative or display webfonts.
- **Backgrounds:** flat warm-neutral surfaces, no gradients, no textures or patterns. Photography (when used) should be candid and real, never staged — per the S&I guide's imagery rules — and both color and black-and-white are acceptable.
- **Animation:** minimal — short (120–200ms) ease-standard fades/transitions on hover and toggle states only. No bounce, no decorative motion.
- **Hover states:** solid color darkens one step (e.g. gold-500 → gold-600); outline/ghost buttons gain a subtle sunken background.
- **Press states:** buttons scale to 98%, no color flash.
- **Borders:** thin (1px), subtle warm-gray, used sparingly to separate cards/rows rather than boxing every element.
- **Shadows:** soft, low-elevation, warm-tinted (brown-black at low opacity), never harsh or cool-gray.
- **Corner radii:** small (4px) for controls/inputs, medium (8px) for compact surfaces, large (14px) for cards, pill for badges/switches.
- **Cards:** white surface, 1px subtle border, soft shadow, generous padding, no colored left-border accents.
- **Transparency/blur:** used only for modal overlays (semi-transparent dark scrim); no frosted-glass or blur effects elsewhere.
- **Layout:** simple, single-column or two-pane; no fixed/sticky decorative elements beyond a persistent sidebar nav in the product UI kit.

## Theming
Light, dark, and automatic (system) modes — an original addition, since altaseminary.com and the S&I guides have no dark mode. Semantic tokens (`--surface-*`, `--text-*`, `--brand-*`, `--border-*`, `--tint-*-bg`) flip under a `[data-theme="dark"]` scope; every component is built on those tokens so nothing else needs to change per-theme. `theme-init.js` (load once in `<head>`) resolves Auto via `prefers-color-scheme`, persists the user's choice to localStorage, and exposes `window.AltaTheme.set("light"|"dark"|"auto")`. `ThemeToggle` is the three-way UI control.

## Iconography
No icon font, sprite sheet, or SVG set exists in the source material (S&I's own style guide covers logos/typography/color, not app iconography). **Substitution:** Lucide icons via CDN — a simple, minimal-stroke line icon set that matches the brand's plain, unadorned visual language. No emoji or Unicode glyphs are used as icons. If Alta Seminary has its own icon set, attach it to replace this substitution.

## Components
Standard primitive set (no component source was provided, so a conventional inventory was authored sized to the product's needs):
- **Forms:** Button, IconButton, Input, Select, Checkbox, Radio, Switch
- **Core:** Card, Badge, Tag, Tabs, Dialog, Tooltip, Toast, ThemeToggle

### Intentional additions
- `IconButton` — not in any source; added as a standard companion to `Button` for icon-only actions (notifications, etc).

## Index
- `src/design-system/styles.css` — root stylesheet, imports everything under `tokens/`
- `src/design-system/tokens/colors.css`, `typography.css`, `spacing.css`, `effects.css`, `components.css` — design tokens and component base styles
- `guidelines/` — foundation specimen cards (colors, type, spacing, radii/shadows, wordmark, iconography)
- `src/design-system/components/forms/` — Button, IconButton, Input, Select, Checkbox, Radio, Switch
- `src/design-system/components/core/` — Card, Badge, Tag, Tabs, Dialog, Tooltip, Toast
- `docs/thumbnail.html` — project homepage tile
- `docs/SKILL.md` — portable skill definition for use in Claude Code
- `docs/PLANNING_QUESTIONS.md` — planning-phase notes from before the build started

---

## The actual site (Astro app)

This directory now also contains the Astro application that consumes this design system (see [PROJECT_SPEC.md](PROJECT_SPEC.md) and the approved build plan for the full architecture). Quick reference:

| Command | Action |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start local dev server at `localhost:4321` |
| `npm run build` | Build production site to `./dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run astro -- --help` | Astro CLI help |

Design-system source files (`tokens/`, `styles.css`, `components/`, `theme-init.js`, `guidelines/`) are being consumed from `src/design-system/` inside the Astro app — see that directory for how they're wired in.

### Caching

GitHub Pages doesn't support custom cache-control headers (no `_headers`-style config, unlike Netlify/Vercel) — its CDN sets its own headers automatically, and that's not something we can override. The caching that matters is already handled by two things working together, not a setting to turn on:

- **Every JS/CSS asset Astro builds gets a content hash in its filename** (e.g. `_astro/client.a1b2c3.js`). Since the filename itself changes whenever the content does, these are safe to cache "forever" — a stale cached copy is never actually wrong, because a real change gets a new filename instead of overwriting the old one.
- **HTML pages** (the actual `.astro` routes) don't have hashed filenames, so GitHub's CDN caches them for a shorter default window and revalidates more often — which is correct, since HTML is what changes on every publish.

Net effect: nothing to configure here, and nothing currently fights this default behavior.
