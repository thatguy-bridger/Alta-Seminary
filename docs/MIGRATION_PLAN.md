# Handing the Alta Seminary website to a new owner

**Goal:** a new person owns and runs everything, and the site, the admin, the logins, the students' Makeup Work link and the teacher emails never stop working.

**The one idea that keeps everything from breaking:** *hand over the existing accounts' project, do not rebuild it.* If the same Vercel project and the same Supabase project simply change owner, nothing about the site changes: the same data, the same logins, the same keys, and the same image links stored inside the content. Rebuilding is the fallback (see the end), and it is far riskier.

## The steps at a glance

| # | Step | Who | Time |
|---|---|---|---|
| 1 | Get ready and make a safety copy | Current owner | 1 hour |
| 2 | The new person creates their accounts | New person | 20 min |
| 3 | Move the code (GitHub) | Both | 10 min |
| 4 | Move the website host (Vercel) | Both | 20 min |
| 5 | Move the data host (Supabase) | Both | 30 min |
| 6 | Move the secrets and email | New person | 30 min |
| 7 | Move the admin team | Both | 15 min |
| 8 | Check everything works | Both | 30 min |
| 9 | Replace the old Google site at altaseminary.com with the new site | New person (they own the domain) | 1 hour, then wait up to a day |
| 10 | Hand over and clean up | Current owner | 30 min |

Do steps 3, 4 and 5 on a quiet day (not a day students need Makeup Work). Do them in this order, and check the site after each one.

---

## What is being moved

| Piece | Where it lives now | What it does |
|---|---|---|
| **The code** | GitHub: `thatguy-bridger/Alta-Seminary` (a personal account) | The website's source. Vercel rebuilds the site from it whenever it changes. |
| **The website host** | Vercel project `alta-seminary` (a personal team that also holds 5 unrelated projects). Address: `alta-seminary-omega.vercel.app`. | Serves the public site, the admin and the student Makeup Work page. |
| **The data host** | Supabase project "Alta Seminary Web App" (a free account that also holds one unrelated project, "Portfolio Storage") | Holds all content, the admin logins (4), 3 file storage areas (about 115 MB), the scheduled jobs and the two small server functions. |
| **Teacher email** | Not set up yet (Resend) | Emails a teacher when a student finishes Makeup Work. Optional: submissions are saved without it. |
| **Analytics** | A Google Analytics ID in the site settings | Optional visit counts. |
| **The public address** | `altaseminary.com`, which the **new person already owns** (the same owner as the old site). It was set up through Google: a Google Sites page, on a domain registered through Google Domains (which Google sold to Squarespace in 2023, so it is now at Squarespace Domains). It still shows the **old** site. The new site's only address today is the Vercel one. | What people type and what students are sent. |
| **The domain's records (DNS)** | At Squarespace Domains, under the new person's login | Say where the website goes. Nobody uses email at this domain, so there are no email records to protect. |

**Never hand over the whole Vercel or Supabase account.** Each also holds the current owner's other projects. Only move the Alta Seminary project.

The Church's text, talks and captions come from public Church addresses, and videos come from YouTube. None of that needs an account or a move.

---

## 1. Get ready and make a safety copy
**Current owner.**

- **Check the site is healthy first.** Open the admin, then Diagnostics, and re-run the checks. Fix anything red before moving it, so a problem is never blamed on the move.
- **Do the tidy-ups** (they remove things that would otherwise have to be moved). Once migration 0049 is applied, the GitHub timer is gone and the 240 MB scheduler log is cleared, so the database is about 21 MB instead of 261 MB. See "Already tidied" below, including which parts still need doing.
- **Make a safety copy of the data.** In Supabase, Project Settings, Database, copy the connection string, then run `pg_dump` against it to save the database to a file. Download the three storage areas (`images`, `documents`, `audio`) with the Supabase command line (`supabase storage cp -r ... --experimental`; check `supabase storage --help`). Keep both somewhere safe for 30 days.
- **Write down every setting.** Use the list near the end of this document ("Every setting and secret"). Copy the values of the ones you can see, and note which ones you cannot see (secrets).
- **Tell the teachers** the date, and that the Makeup Work link will keep working.

## 2. The new person creates their accounts
**New person.**

- **GitHub** (free): one account. Turn on two-step sign-in.
- **Squarespace Domains** (where `altaseminary.com` lives): they own the domain already, so they only need to confirm they can sign in. Do this now, not on the day of step 9.
- **Vercel** (the free "Hobby" plan is enough to start; it is meant for non-commercial use, which a school site normally is): sign up using the GitHub account, so the two are already connected.
- **Supabase** (free): sign up, then create a **new organization** (for example "Alta Seminary"). Leave it empty.
- **Use a long-lived email address** (not a personal one that might change). Every service sends its important notices there.
- Both people should turn on two-step sign-in everywhere. Losing access to an owner account is the most common way a handover goes wrong.

## 3. Move the code
**Current owner starts it, new person accepts.**

- On GitHub: the repository, Settings, General, scroll to "Danger Zone", **Transfer ownership**, type the new person's GitHub name.
- The new person accepts from the email GitHub sends (within a day).
- GitHub keeps the old link working by redirecting it, so nothing breaks for anyone with the old address.
- **Check:** the new person can see the repository and its history.
- The repository no longer needs any secrets set on it. (The old scheduled-publish timer that used them is gone.)

## 4. Move the website host
**Current owner starts it, new person accepts.**

- In Vercel: the `alta-seminary` project, Settings, General, **Transfer Project** (Vercel can also send a transfer link). Choose the new person's account. Move only this project.
- The project's settings and environment values move with it. Afterwards the new person checks Settings, Environment Variables: `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` must be there (the site shows no content without them); `PUBLIC_GA_MEASUREMENT_ID` is optional.
- Settings, Git: connect the project to the transferred GitHub repository (install Vercel's GitHub app on the new GitHub account if asked). Pushing a change should now deploy automatically.
- **Check the address.** Open `https://alta-seminary-omega.vercel.app`. The default `*.vercel.app` addresses can change when a project changes owner. If it still opens, nothing more is needed here. If it does not, use whatever new Vercel address the project now has to test with, and do not give that address to teachers or students: step 9 puts the site on altaseminary.com, which never changes.
- **Check:** a small change pushed to GitHub appears on the live site after a minute.

## 5. Move the data host
**Both. The new person needs their organization from step 2.**

- **The new person** invites the current owner to their new Supabase organization as an **Owner** (Organization, Team, Invite).
- **The current owner** accepts, then opens the "Alta Seminary Web App" project, Settings, General, **Transfer project**, and picks the new organization. Do not transfer "Portfolio Storage".
- The project keeps the same address, the same keys, the same data, the same logins, the same stored files, the same scheduled jobs and the same server functions and their secrets. That is why nothing in the site has to change. The website does not need to be redeployed.
- Afterwards the current owner removes themselves from the new organization (step 10).
- **Check:** open the live site, the admin, and Diagnostics: "Database connection" should be healthy.
- **Know the limits of the free plan** (the new person will meet them): a 500 MB database, 1 GB of file storage, and a project that **pauses after about a week without any activity** (the site's own traffic counts as activity; Diagnostics warns about this). Upgrading to the paid plan removes the pause.

## 6. Move the secrets and email
**New person.**

- **Server function secrets** (Supabase, Edge Functions, Secrets). These moved with the project, but the new person should know them. `SITE_URL` (used by the admin invite emails) must be the site's public address. If it is wrong, invite links go to the wrong place.
- **Teacher email (optional, recommended).** Create a free Resend account and verify the sending address. Sending from an address at `altaseminary.com` is the most reliable choice: Resend then shows a few records (for a "send" subdomain) that the domain's owner adds in Squarespace DNS. They are *added alongside* the website records and do not replace any; do them after step 9 so the two changes never get mixed up. Then add two secrets in Supabase: `RESEND_API_KEY` and `MAKEUP_FROM` (for example `Alta Seminary <makeup@yourdomain.org>`). Then in the admin, Makeup Work, press "Send me a test email". Until this is done, submissions are saved and marked "Not emailed", and nothing is lost.
- **Admin login emails.** Supabase's built-in sender is limited to a few emails an hour. Pointing Supabase at the same Resend account (Authentication, Emails, SMTP Settings) removes the limit.
- **Supabase sign-in settings** (Authentication): public sign-up must stay **off**, and the Site URL and redirect list must contain the site's address.
- Send the current owner's list of secrets (step 1) to the new person through a password manager or other secure channel, never a plain email.

## 7. Move the admin team
**Both.**

- The 4 existing admin logins keep working after the move (they live in the database).
- The current owner (or any admin) invites the new person from the admin's Team page. The new person signs in and sets a password.
- Keep **at least two** working admin logins at all times, so nobody can be locked out.
- Remove admin logins that should no longer have access.

## 8. Check everything works
**Both.** Do all of these on the real site:

- [ ] The home page and a few other pages load, with their images.
- [ ] The admin: sign in, edit something small, publish it, see it on the live site.
- [ ] Upload an image in the admin. It appears in the library and on the page.
- [ ] Schedule a page to publish a few minutes ahead. It goes live by itself.
- [ ] Diagnostics: every check is healthy ("Scheduled-publish sweep" should say it ran within the last minute).
- [ ] Makeup Work: open `/makeup-work/start`, take a short lesson as a test, and finish. (Use the admin's test screen, so nothing is saved.)
- [ ] Teacher email: the admin's "Send me a test email" arrives.
- [ ] Invite yourself as a new admin. The email arrives and its link opens the right site.

## 9. Replace the old Google site at altaseminary.com with the new site
**New person.** They own the domain, so they do all of this themselves: add the domain in Vercel, then change the records at Squarespace. Do it **last**, after step 8 passes, on a quiet day. The current owner is not needed, but should be reachable in case something looks wrong.

Until this step, altaseminary.com keeps showing the old Google site, so nothing the public sees changes until the new site has been proven. After it, `altaseminary.com` is the one permanent address. It never changes hands when Vercel or Supabase accounts do.

Decided: the domain is owned by the **new person**, the same owner as the old site, and is registered at **Squarespace Domains** (the new home of Google Domains). Nobody uses email at the domain. Every old page simply goes to the new home page.

- **Sign in first.** Sign in at Squarespace Domains (`domains.squarespace.com`, usually with the Google account the domain was set up under). If that sign-in does not work, find out now, before anything else: it is the one thing that could stop this step.
- **Write down every DNS record first** (screenshot or export). Only the *website* records change. Leave every other record as it is, even ones you do not recognize (Squarespace and Google may have added some on their own). There is no email to protect here, but there is also nothing to gain by removing records.
- **A day ahead, lower the time-to-live (TTL)** of the website records to about 5 minutes. The switch, and the way back, then take minutes instead of hours.
- **Add the domain in Vercel** (the project, Settings, Domains): both `altaseminary.com` and `www.altaseminary.com`. Pick one as the main address and let the other redirect to it. Vercel shows exactly which records to add.
- **Switch the website records** in Squarespace (the domain, DNS Settings). For a Google Site the `www` record is typically a CNAME to Google's `ghs.googlehosted.com`, and the bare `altaseminary.com` is usually forwarded or pointed at Google. Replace those with the values Vercel shows. Wait for Vercel to say "Valid"; the padlock (HTTPS) is added automatically. This can take from minutes up to a day.
- **Then let go of Google's side.** In the old Google Site (Settings, Custom domains), remove the domain mapping so Google stops claiming it. **Do not delete the old Google Site for 30 days.** It keeps working at its own `sites.google.com` address, as an emergency fallback and as a source for old content.
- **Old pages need nothing built.** The new site already sends any address it does not have to the nearest real page, and to the home page when nothing is close. This was checked on the live site: `/make-up` and `/some/old/google/page` both land on the home page, and `/makeup-work/nonsense` lands on `/makeup-work`. So every old Google Site page arrives at the new home page, as decided.
- **Update every place that names the address:** (1) Vercel `PUBLIC_SITE_URL`, then redeploy; (2) Supabase, Authentication, URL Configuration: Site URL and redirect list; (3) the Supabase server function secret `SITE_URL`; (4) `public/.well-known/security.txt` (two lines); (5) the fallback address in `astro.config.mjs`.
- **Keep the old Vercel address working as a redirect** to altaseminary.com, and **tell the teachers the new Makeup Work link** (`altaseminary.com/makeup-work/start`).
- **Check, on a phone and a computer:**
  - [ ] `altaseminary.com` and `www.altaseminary.com` both open the new site, with a padlock.
  - [ ] An old page address (for example `/make-up`) lands on the new home page.
  - [ ] Makeup Work works from the new address, start to finish.
  - [ ] An admin invite email links to `altaseminary.com`, not the old address.
- **The way back:** if anything is wrong, put the website records back to the values written down at the start. With the short TTL the old site returns within minutes.
- **Renewals are now the new person's job.** Turn on auto-renew with a card that works, and put the expiry date in two calendars. **The new site depends on this: an expired domain takes the website down at once.** Make sure the old Google account the domain was set up under is also known to someone else, so the domain cannot be lost with it.

## 10. Hand over and clean up
**Current owner.**

- Remove yourself from the new Supabase organization, from the Vercel project and from the GitHub repository, once the new person has confirmed step 8 and step 9.
- **Revoke every access you gave to tools and helpers** (personal access tokens, API tokens, and any assistant or automation connected to your accounts), then change your own passwords.
- **Optionally rotate the keys** (Supabase, Project Settings, API). Rotating means updating the two Vercel values straight afterwards, or the site shows no content. Only do this at a quiet time.
- Delete what is dead (see "Already tidied").
- Keep the safety copy from step 1 for 30 days, then delete it.

---

## Already tidied (so there is less to move)

These were found by checking the live project. They are not needed by the website, and removing them means fewer accounts, secrets and addresses to carry across.

| What | Why it can go | Status |
|---|---|---|
| **The GitHub timer** for scheduled publishing, and its server function | The database already runs the same job itself every minute. The timer was a second copy, and it tied the project to the GitHub repository name, a GitHub secret and a hard-coded database address. | Deleted from the repository. Deleting the deployed `sweep-scheduled-content` function in Supabase (Edge Functions) is a one-click leftover. |
| **The GitHub Pages redirect** | An old redirect page that points at the current Vercel address. It will point at the wrong place after a move. | Deleted from the repository. In GitHub, Settings, Pages, turn Pages off. |
| **Diagnostics asking GitHub** | It checked the timer through GitHub's website using a hard-coded repository name, so it would break after a move. It now asks the database. | Done (needs migration 0049). |
| **A 240 MB scheduler log** | The scheduled job ran every 15 seconds and kept a log row each time, forever: 240 MB of the 261 MB database, on course to hit the free plan's 500 MB limit in about five weeks. It now runs every minute and keeps two days of log. | Migration 0049 (see its note). |
| **A dead secret** `deploy_webhook_secret` in Supabase Vault | Left over from a removed "rebuild on publish" feature. Nothing reads it. | Delete it in Supabase, Vault. |
| **Two finished one-time server functions** `makeup-library-import` and `makeup-thumbnails` | Used once to load the library, then switched off. | Delete in Supabase, Edge Functions. |
| **The site's address typed into the code** | Now one setting (`PUBLIC_SITE_URL`). | Done. |

**Optional: about 90 MB of unused audio.** Of the 18 audio files in storage (98 MB), 17 (about 90 MB) are not mentioned by any page, post or other content. Most are the same music file uploaded again and again. Likewise 3 documents and 144 images are not mentioned by any content; images in particular may be kept on purpose in the library, so those need a human decision. Removing unused audio would shrink the storage to about 25 MB and make any copy quicker. It is not required, and nothing is deleted without a decision.

---

## Every setting and secret

| Where | Name | What it is |
|---|---|---|
| Vercel, Environment Variables | `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` | The data host's address and its public key (safe to be public). Required. |
| Vercel | `PUBLIC_GA_MEASUREMENT_ID` | Google Analytics. Optional. |
| Vercel | `PUBLIC_SITE_URL` | The public address (`https://altaseminary.com`) once step 9 is done. |
| Squarespace Domains (the domain's registrar and DNS) | The `altaseminary.com` website records, and the auto-renew card | Where the address points. Owned by the new person. No email uses this domain. |
| Google Sites | The custom-domain mapping on the old site | Removed in step 9, after the new site is live. |
| Supabase, Edge Function secrets | `SITE_URL` | Used by the admin invite function for links in emails. |
| Supabase, Edge Function secrets | `RESEND_API_KEY`, `MAKEUP_FROM` | Teacher email. Not set yet. |
| Supabase, Edge Function secrets | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Provided by Supabase automatically. The service key must never leave Supabase. |
| Supabase, Authentication | Sign-ups off; Site URL; redirect list; SMTP (optional) | Who may sign in and where invite and reset links point. |
| Supabase, Vault | `deploy_webhook_secret` | Dead. Delete it. |
| Site settings (inside the admin) | Contact email, Google Analytics ID, Makeup Work on/off | Part of the data, so they move with it. |

---

## If a transfer is not possible: rebuild in new accounts

Use this only if Vercel or Supabase will not allow a transfer. It is the risky path, because content stores the current data host's address. Run it **side by side with the old site**, and keep the old one untouched for two weeks.

1. **New Supabase project** in the new organization (same region, `ca-central-1`, if possible).
2. **Create the structure:** run every file in `supabase/migrations/` in filename order (SQL editor, or `supabase db push`). This also creates the scheduled jobs.
3. **Copy the data** from the safety copy (`pg_dump` of the data only, restored into the new project).
4. **Copy the files:** download the three storage areas and upload them to the new project, with the same paths.
5. **Rewrite the stored image addresses.** About 230 addresses in the content point at the old project: `media_library.url`, `pages.draft_blocks` and `published_blocks`, `blog_posts.cover_image_url`, `draft_blocks` and `published_blocks`, `directory_entries.photo_url`, `gallery_photos.image_url` (and the edit history in `change_log`, which can be left alone). Use find-and-replace on the old project's address, with the new one. **Count before and after.** The scan below lists everything that holds it, and new features add columns, so run it again at the time:
   ```sql
   do $$
   declare r record; n bigint; out text := '';
   begin
     for r in select c.table_name, c.column_name from information_schema.columns c
       join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
       where c.table_schema = 'public' and c.data_type in ('text', 'jsonb', 'json', 'character varying', 'ARRAY')
     loop
       execute format('select count(*) from public.%I where %I::text ilike %L', r.table_name, r.column_name, '%OLD-PROJECT-REF%') into n;
       if n > 0 then out := out || r.table_name || '.' || r.column_name || ' = ' || n || E'\n'; end if;
     end loop;
     raise exception E'\n%', out;   -- the answer is shown in the error message
   end $$;
   ```
6. **Deploy the two server functions** that are in the repository (`invite-admin`, `makeup-notify`) and set their secrets (step 6).
7. **Sign-in settings:** sign-ups off, Site URL, redirect list. Passwords cannot be carried across easily, so invite the admins again.
8. **New Vercel project:** import the GitHub repository, add the three environment values (pointing at the **new** Supabase project), and deploy.
9. **Test everything** with the checklist in step 8, on the new Vercel address, while the old site still serves the public.
10. **Switch:** point altaseminary.com at the new Vercel project (step 9). Keep the old projects for two weeks as the way back, then delete them.
