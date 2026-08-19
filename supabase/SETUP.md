# Supabase Setup (one-time, manual)

Creating the actual Supabase account/project has to happen on your end — here's exactly what to do. This has been tested against a real Postgres locally (with Supabase's `auth`/`storage` schemas stubbed), so the SQL itself is verified; these are just the account-level steps.

1. **Create a project** at [supabase.com](https://supabase.com) (free tier). Note the project's URL and anon (public) API key — you'll need `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` for the Astro app's environment variables later.

2. **Run the migrations, in order.** Simplest path (no CLI/Docker needed): open the project's **SQL Editor** in the Supabase dashboard, paste in each file under `supabase/migrations/` and run it, in filename order (`0001_init.sql`, `0002_seed_directory_fields.sql`, `0003_admin_profiles.sql`, `0004_documents_bucket.sql`, `0005_nav_structure.sql`, `0006_all_pages_editable.sql`, `0007_fix_directory_field_dedup.sql`, `0008_rename_council_label.sql`, `0009_dynamic_directories.sql`, `0010_change_history.sql`, and any added later). (If you later install the Supabase CLI, `supabase link` + `supabase db push` does the same thing from the command line.)

3. **Disable public sign-up** (Authentication → Sign In / Providers → Email → disable "Allow new users to sign up"). This is required — without it, anyone could self-register an account, and since any authenticated user is a full admin, that would let strangers edit the site. Admins are added only via the invite flow (Phase 3).

4. **Create the `images` storage bucket policies check**: the migration already creates the `images` bucket and its policies via SQL — nothing else to do here, just confirm in Storage → Buckets that `images` exists and is marked public.

5. **Set `site_settings.contact_notify_email`** to a real email address once you know it (defaults to a placeholder) — either via the Table Editor now, or later from the admin UI once that's built.

6. **Note your project's API keys are needed as GitHub Actions secrets later** (Phase 5) — `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` get added as repository secrets so the build step can fetch published content. Never use the `service_role` key anywhere except inside Edge Function secrets (Phase 3/5/9) — it must never reach client code or the Astro build.

## Known limitation: email rate limit (revisit in Phase 9)

Supabase's default built-in email sender (used for admin invite emails and password resets) is heavily rate-limited — a handful of emails per hour — and explicitly meant only for light testing, not production. Confirmed via a real invite attempt: auth, validation, and the `admin_profiles` insert all worked correctly; only the actual email send was blocked ("email rate limit exceeded").

**Fix (deferred until Phase 9):** create a free [Resend](https://resend.com) account and configure it as Supabase's custom SMTP provider (Authentication → Emails → SMTP Settings). This removes the rate limit entirely and is the same service Phase 9 already needs for contact-form email notifications — one integration serves both. Until then, admin invites will work but may hit this rate limit if sent too frequently; retry after the limit resets (roughly an hour) if needed.
