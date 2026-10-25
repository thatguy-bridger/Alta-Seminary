# Makeup Work: build plan

Companion to `MAKEUP_WORK_CONCEPT.md` and `MAKEUP_WORK_RESEARCH.md`.

**Where it stands (updated):**
- Mountains are the site's own artwork, cut from the existing banners above the lettering, cropped at valleys and mirrored so they tile without a seam. Three layers, randomized each journey. The tiles live inside the prototype file; the real build should store them as site assets.
- Direction: **Ridgeline** (`docs/prototypes/makeup-work-ridgeline.html`): flat, in the app's own logo, fonts and colors; a red line traces a ridge as you go; outlined mountains like the Alta artwork; background steps from night to morning; one small flat sun in the brand red. The earlier four directions and the glassy "First Light" are kept in `docs/prototypes/` for reference only.
- Content follows the seminary pattern found in the research: read, find a truth, understand it, feel it, apply it. Seven short screens.
- Multiple missed days are **one comprehensive journey**, not a repeat per day: one pick per missed day (up to four; the same way can be picked more than once, shown as numbered circles in order), slightly longer answers, one truth that ties it together. There is no "Day 1 of 2".
- 30 minutes per missed day by default (a setting), per what existing worksheets expect (30 to 60).

## What is already done (prefired)

Everything that does not depend on which design you pick is built, tested and, where it is database work, live.

| Piece | Where | State |
|---|---|---|
| Journey rules: the 7 steps, the gate on each, how the journey grows with days missed | `src/makeup/journey.js` | Done, tested |
| Effort signals: plain-language "looks typed live / worth a conversation" with reasons | `src/makeup/effort.js` | Done, tested |
| Writing-box tracker: blocks paste/drop/right-click, counts attempts, jumps, active time, page leaves. Stores counts, never keystrokes | `src/makeup/useEffortTracker.js` | Done, tested |
| Teacher email wording: truth, understanding, why it matters, what they will do, signal (text + HTML, escaped) | `src/makeup/teacherEmail.js` | Done, tested |
| Starter prompts and sample sources (drafts for the school to edit) | `src/makeup/prompts.js` | Done |
| Database: classes (teacher email, optional code), source library, submissions | migration `0034_makeup_work.sql` | **Live**, tested (wrong code rejected, repeat throttled, anon cannot read or purge) |
| Structure for the truth / understand / feel / apply answers, several sources, longer source types, minutes-per-day setting | migration `0035_makeup_work_structure.sql` | **Live** |
| Safe student submit: checks class and code, caps lengths, throttles repeats, **enforces Alta's 7-makeups-a-week limit** | `submit_makeup()` | Live, tested |
| Public read views: class names (no emails/codes), active sources | `public_makeup_classes`, `public_makeup_sources` | Live |
| Auto-delete after 90 days | `purge_makeup_submissions` + nightly schedule | Live |
| Teacher email sender | `supabase/functions/makeup-notify` | Written, **not deployed** (needs an email service) |
| Admin screen: on/off, classes + teacher emails, sources, submissions list, CSV download | `/admin/makeup-work` | Done; in the menu and the guide |

Nothing is visible to students yet. The public `/makeup-work` page is unchanged until the journey is built and switched on.

## What is left

### 1. Student journey (the visible part). ~1 to 2 days once a design is chosen

- One React component `MakeupJourney`, styled like the Ridgeline prototype, driven by the logic in `src/makeup/`. (If you later want another look, only markup and CSS change.)
- Load classes and sources from the two public views. Call `submit_makeup()` on finish.
- Wire `useEffortTracker` to the reflection box. Wire the done-screen "what your teacher receives" from `analyzeEffort`.
- Mount it on `/makeup-work` when `site_settings.makeup_work_enabled` is on; otherwise show a quiet "not open right now".
- Full-screen study mode: hide the site header and footer while a student is inside.
- Tests: step gating, paste blocking, a full run against a fake Supabase client (the repo already has one).
- Accessibility: focus moves to each new screen's heading, controls are real buttons, reduced motion respected (the prototype already does this).

### 2. Sources in the app. ~0.5 to 1 day

- Reader: calm in-app text with copy disabled, from `makeup_sources.body`.
- Video and audio: embed from `embed_url`. YouTube/Vimeo already pass our security policy; any other host needs adding to the allow-list in `vercel.json`.
- **Needs a real browser test** that the Church's own pages can be embedded; headers did not forbid it, but the reader is the safer default.

### 3. Teacher email. ~0.5 day plus your account

- Create a Resend account and verify a sending address, set the three secrets, deploy `makeup-notify` (steps are at the top of the file).
- Call it after a successful submit. Submissions are stored whether or not the email works; the admin list shows "not emailed" if it failed.

### 4. Voice. ~1 day

- Real recording with the browser microphone and a transcript; keep the audio for the teacher.
- The prototype simulates this. A real version needs a storage bucket for audio and a decision on whether to also store a transcript. Audio of minors is more sensitive than text: ask the school.

### 5. After teacher feedback

Review queue (approve / ask to redo), printable per-student record, teacher exceptions for the writing rules, optional streaks.

## Decisions to make, with what I will assume if you do not

| Decision | Assumed default | Why it matters |
|---|---|---|
| Which design direction | Ridgeline | Decided in practice; tell me if not |
| Class codes | Optional per class, off until a teacher wants one | With no sign-in, a code is the only thing stopping strangers |
| Retention | 90 days | Set in `purge_makeup_submissions` |
| Email service | Resend, one address per class | Sending needs an account |
| Reader text | Admin pastes approved text into a source | We do not scrape the Church site |
| Prompts | The drafts in `prompts.js` | Wording is the school's to own |

## Known limits to keep in mind

- No online tool can fully stop AI use. The writing box blocks paste and records effort; the real safeguard is the teacher reading the response. The signals are labelled "worth a conversation", never "cheating".
- Effort numbers come from the student's browser, so a determined student could fake them. They are a nudge, not proof.
- No sign-in means anyone can type any name. Class codes and teacher review are the controls.
- Student names, responses and effort data are about minors. Keep the 90-day limit, keep the page's privacy wording simple, and check the school's policy before turning voice recording on.

## File map

```
src/makeup/            logic shared by every design (tested)
src/admin-app/screens/MakeupWorkScreen.jsx   admin setup + submissions
supabase/migrations/0034_makeup_work.sql     tables, safe submit, views, retention
supabase/functions/makeup-notify/            teacher email (not deployed)
docs/prototypes/makeup-work-concepts.html    the four clickable designs
```

## Suggested order

1. Pick a direction (or tell me to start with Stillness).
2. Journey + reader + video/audio on a hidden route, tested with a few real students.
3. Email, once the Resend account exists.
4. Switch it on from the admin.
5. Voice and the review queue, driven by what teachers say.

## Added after the research

- **Reading makeup checklist** (required passages per course, progress saved) to replace the separate Google Form. Needs the official passage list; not built.
- **Teacher pre-assigns** what a class should study for a day, like mySeminary lets teachers do. Not built.
- **Send back with a note** when effort is not enough (the worksheet's "redo if no full effort"). Phase 3.
- **Assess Your Learning** makeup, if the school wants it in the app.
- Nothing here talks to WISE. Spreadsheet download and the teacher email are the bridge.
