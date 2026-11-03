# Handing the Alta Seminary website to a new person

**The one idea:** *move the existing projects, don't rebuild them.* Same data, same logins, same keys, so nothing breaks.

**What stays and what moves**

| Piece | What happens |
|---|---|
| Code (GitHub `thatguy-bridger/Alta-Seminary`) | **Stays yours.** The new person is added as a collaborator. |
| Website host (Vercel project `alta-seminary`) | Moves to the new person. |
| Data host (Supabase project "Alta Seminary Web App") | Moves to the new person. |
| `altaseminary.com` (Squarespace Domains) | Already theirs. Gets pointed at the new site. |

Never hand over a whole Vercel or Supabase account. Each also holds your other projects. Move only the Alta Seminary project.

---

## 1. You: check and back up (30 min)
- Admin, Diagnostics: re-run the checks and fix anything red.
- Back up: Supabase, Project Settings, Database, copy the connection string and run `pg_dump` to a file. Download the storage areas `images`, `documents`, `audio`. Keep both for 30 days.

## 2. They: make accounts (20 min)
- **GitHub**, **Vercel** (free Hobby plan; sign up with GitHub), **Supabase** (free; then create an empty organization called "Alta Seminary").
- Use an email address that won't change, and turn on two-step sign-in.
- Check they can sign in at `domains.squarespace.com` (the domain's login).

## 3. You: share the code (5 min)
- GitHub repository, Settings, Collaborators, add them with **Write** access. They accept by email.
- Ownership stays with you. The site keeps running even if sharing ever ends; only updating it needs the code.
- Ask them to press **Fork** once, so they hold their own copy as a safety net.

## 4. Move the data host (20 min)
- They invite you to their Supabase organization as Owner. You accept.
- You open "Alta Seminary Web App", Settings, General, **Transfer project**, and pick their organization. Do not move "Portfolio Storage".
- Everything comes along: data, logins, files, scheduled jobs, server functions and their secrets. The website needs no change.
- Check: the live site and admin still work; Diagnostics shows the database healthy.

## 5. Move the website host (20 min)
- Vercel, project `alta-seminary`, Settings, General, **Transfer Project**, to their account.
- They check Settings, Environment Variables: `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` are present.
- They connect the project to the repository (Settings, Git) with their GitHub login.
- **Test a deploy:** each of you pushes a tiny change. The free Vercel plan may block pushes from anyone but the project owner. If yours is blocked, the fixes are: they merge a pull request you open, or they upgrade Vercel, or Vercel watches their fork.

## 6. They: point altaseminary.com at the new site (30 min, then wait up to a day)
- In Vercel, project, Settings, Domains: add `altaseminary.com` and `www.altaseminary.com`. Vercel shows the records to use.
- In Squarespace Domains, DNS Settings: replace the old Google Sites website records with those. Leave all other records alone. Screenshot the old ones first; putting them back is the way back.
- In the old Google Site, remove the custom-domain mapping. Keep that site for 30 days.
- Old pages already land on the new home page; nothing to build.
- Update the address in four places: Vercel `PUBLIC_SITE_URL` (then redeploy), Supabase Authentication Site URL and redirect list, the Supabase function secret `SITE_URL`, and `public/.well-known/security.txt`.
- Turn on auto-renew for the domain and put the expiry date in a calendar. An expired domain takes the site down.
- Tell the teachers the new Makeup Work link: `altaseminary.com/makeup-work/start`.

## 7. Check and clean up (30 min)
Together, on the live site:
- [ ] Pages and images load on `altaseminary.com`.
- [ ] Sign in to the admin, edit something, publish it.
- [ ] Makeup Work works from start to finish (use the admin's test screen).
- [ ] Diagnostics is all healthy.

Then you:
- Leave their Supabase organization and Vercel project. **Keep your GitHub repository.**
- Revoke every token and helper you connected to your accounts, and change your passwords.
- Keep at least two working admin logins so nobody is locked out.

---

## Optional, any time
- **Teacher emails:** create a free Resend account, then add two Supabase function secrets, `RESEND_API_KEY` and `MAKEUP_FROM`. Until then submissions are saved and marked "Not emailed"; nothing is lost.
- **Leftovers to delete** (not needed, just tidy): Supabase Vault secret `deploy_webhook_secret`; the finished one-time Edge Functions (`sweep-scheduled-content`, `makeup-library-import`, `makeup-thumbnails`, `gallery-backfill`, `makeup-cfm-import`); GitHub Pages (turn off in repository Settings).
- **Free plan limits:** 500 MB database, 1 GB files, and Supabase pauses a project after about a week with no activity (site traffic counts). A paid plan removes the pause.

## Settings that matter
| Where | Name |
|---|---|
| Vercel | `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (required), `PUBLIC_SITE_URL`, `PUBLIC_GA_MEASUREMENT_ID` (optional) |
| Supabase function secrets | `SITE_URL`, `RESEND_API_KEY`, `MAKEUP_FROM` |
| Supabase Authentication | Sign-ups off; Site URL; redirect list |

## If a transfer isn't allowed
Rebuilding in new accounts is possible but risky, because stored content contains the old data host's address. The earlier, longer version of this document (in git history) has the full rebuild steps and the address-rewrite query.
