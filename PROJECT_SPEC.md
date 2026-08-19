# Alta Seminary Site — Project Spec

Replacement for altaseminary.com: a modern, easy-to-edit public information website. Not a school portal — no student logins, no attendance, no scripture tracking. Think "prettier, more usable Google Sites/Squarespace, purpose-built for this seminary."

## Roles

- **Admin** (teachers, 2–5 people): logs in to edit and publish site content via a drag-and-drop builder.
- **Viewer** (students/parents, general public): no login, fully open browsing.

No separate super-admin tier — any admin can do anything an admin can do.

## Editing & Publishing

- Drag-and-drop content builder (Wix/Squarespace-style), not structured forms.
- Draft + Publish workflow: admins edit freely, preview, then hit Publish.
- Publishing must be **fully automatic** — no manual command-running after clicking Publish.
- Direct image upload supported in the editor (not just pasted links).
- Any admin can post to the blog/announcements feed.

## Admin Accounts

- Simple email/password login (not GitHub OAuth or similar).
- New admins are added via an email invite link; the recipient sets their own password tied to that email.

## Site Structure / Pages

- **Home**
- **About**
- **Schedule** — informational display only (no attendance, no per-student data)
- **Announcements** — full blog/news feed (dated posts, newest first, archive)
- **Seminary Council Directory**
- **Missionary Directory**
- **Staff/Teacher Directory**
- **Enrollment/Registration** — informational only, no submission form (text + link/PDF to an external form if needed)
- **Photo gallery**
- **Events calendar**
- **Contact** — a form; submissions route to email notification

### Directory entries (Seminary Council / Missionary / Staff)
Required fields: photo, name, bio. Additional fields (role, contact info, mission location/dates, etc.) are optional and addable per-entry via a dropdown, so the field set can vary by directory type or by person.

## Roadmap (not building yet)
- **Makeup work** feature — lets students complete makeup work online. Fully new functionality vs. the old site. Show as a "Coming soon" placeholder in the nav now; build later.

## Non-functional

- **SEO matters** — should rank well in Google search for "Alta Seminary."
- **Analytics wanted** (e.g. Google Analytics) — basic visit/traffic tracking.
- **Mobile**: responsive web is sufficient; no native app planned.
- **Maintenance**: aim for something you (Bridger) could eventually hand off to someone else — avoid a bespoke, hard-to-maintain setup.
- **Budget**: free tier only for any service used.

## Deployment (as you described it)

Build locally → push to GitHub → host on GitHub Pages → point a custom domain (altaseminary.com once you have control of it, or a placeholder domain until then) → should be portable to a different host later if needed.

---

## Recommended Architecture (needs your sign-off before we build)

GitHub Pages only serves static files — it can't run a server, handle logins, or accept form submissions on its own. Your other requirements (email/password auth, fully-automatic publish, image upload, free tier, SEO, handoff-friendly) point to one clean setup:

**Astro (static site generator) + Supabase (auth + database + image storage) + GitHub Actions (auto-rebuild on publish)**

- **Supabase** (free tier) handles: admin email/password login + invite links, the actual content (pages, directory entries, blog posts) in a database, and image file storage.
- **Astro** builds the actual site as pre-rendered HTML/CSS/JS — good for SEO, fast for viewers, and it's what gets deployed to GitHub Pages.
- **Publish flow**: admin edits in the builder → saves to Supabase → hits Publish → a Supabase webhook automatically triggers a GitHub Actions workflow → it rebuilds the site with the latest content and deploys to GitHub Pages. No manual step, typically live within a minute or two.
- All pieces are mainstream, well-documented, and swappable — if you ever leave GitHub Pages, the Astro site can deploy anywhere; if you ever leave Supabase, it's a standard database you can migrate.

**Trade-off to know:** because publishing goes through a short rebuild step (not instant like a live database read), there's a ~30–90 second delay between clicking Publish and it going live. Given you want SEO and "fully automatic" (not necessarily "instant"), this is the right trade — the alternative (site reads content live at request time) would be truly instant but hurts SEO and doesn't work cleanly on GitHub Pages anyway.
