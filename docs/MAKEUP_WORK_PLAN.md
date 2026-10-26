# Makeup Work: build plan

Companion to `MAKEUP_WORK_CONCEPT.md` and `MAKEUP_WORK_RESEARCH.md`.

**Current state:** built and opened to students behind the admin switch. The sections between here and "Status update: opened to students" at the bottom are the original plan, kept for the reasoning; the bottom section is what exists now.

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

## Status update: opened to students

- **Student page:** `/makeup-work/start` (not in the menu; the Makeup Work page can link to it). Full screen, no site header or footer. Whether it is open is the **"Makeup Work is open to students"** switch in the admin, and the database enforces it: while it is off, the student lists are empty and `submit_makeup()` refuses (signed-in admins can still test). With the switch on but no active class or no lessons, students see "not ready yet".
- **Student journey** (`src/makeup/MakeupJourney.jsx`): the Ridgeline design, all seven steps, as a real component. Admins can also take it at `/admin/makeup-work/test`.
- **Admin test page:** skip tools (back, fill in, skip step) that can be switched off to take it as a student would; phone width; sample content when the library is empty; drafts included; a test never saves unless "Really save" is on; the test run shows the email the teacher would get.
- **Videos and audio** play with a live, timestamped transcript: the spoken line lights up, clicking a line jumps there, a "Cite" button records the moment as where the student found their truth, and only seconds actually played count. **YouTube is the default for video** (privacy-enhanced mode, YouTube's own captions on, our transcript beside it); direct audio and video files are also supported. Transcripts (.vtt or .srt) are required to show a video or audio source to students.
- **Artwork:** a public-domain painting of the Savior on every step (Bloch and Hofmann), with credits.
- **Sound:** see `MAKEUP_WORK_SOUND.md`.
- **Library:** see `MAKEUP_WORK_LIBRARY.md`.
- **Library loaded:** 279 lessons (75 scriptures, 97 conference talks, 87 audio lessons (17 talks, and 70 scripture chapters read aloud, see `MAKEUP_WORK_LIBRARY.md`), 17 YouTube videos of the same talks, all with real timestamped captions, and the three Proclamations as once-per-student "Deep study"). The "Reader text" decision above is now: loaded from public sources, with the notes in `MAKEUP_WORK_LIBRARY.md` (the school has permission to use the Church's text and captions).
- **Teacher email:** the `makeup-notify` function is deployed. The student's browser calls it right after a submission is saved; it emails the class's own teacher (the address always comes from the database, never from the request), only for a submission under 15 minutes old that has not been sent. It needs two Supabase secrets, `RESEND_API_KEY` and `MAKEUP_FROM`; until they exist, submissions are saved and marked "Not emailed". The admin has "Send me a test email" (to the signed-in admin only), "Send now" and "Send again" for each submission.
- **Voice (words only):** students can choose "Say it" for the two reflection answers. The browser's speech recognition turns the voice into words; only the words and how long they spoke are kept, never audio. The answers are read-only (speak again to change them), and the teacher's email says they were written down by the browser. Chrome sends the audio to Google to do the recognition; Safari and Edge use their own services; browsers without speech recognition just show the typing option.
- **Review:** in the admin, submissions can be filtered by class and status, marked Accepted or Needs redo (a redo needs a note), emailed again, printed as a record, downloaded as a spreadsheet, or deleted.
- **Lessons page** (`/admin/makeup-work/lessons`): every lesson as a card with a type badge and a picture, organised by type and then collection (standard works in order, conferences newest first), with search, "needs attention" and show/hide filters, and show/hide for a whole collection. Each lesson opens in an editor that covers everything: type, title, collection, author, reference, description, minutes, once-per-student, shown, picture (YouTube's, the Church's own for a talk, a painting, an upload or a link), the text or the YouTube link and transcript (an existing transcript can be opened as text and edited), a guiding line, required time, and pause questions. "Preview as a student" opens one lesson exactly as students see it. Lessons can be copied and deleted. Videos and audio cannot be shown until they have a playable address, a length and a transcript.
- **Pictures:** every lesson has one in the admin: videos use YouTube's, talks use the Church's own image (filled in from the Church's site), and scriptures and Proclamations get one of 11 public-domain paintings, assigned in turn within each collection so neighbours differ. Any can be replaced. **Students see pictures only on a lesson that has "Show pictures to students" on** (off by default, so ordinary lessons are plain; there are Pictures on/off buttons for a whole collection). The shared steps (truth, understand, commit, the finish) show a painting only if a lesson in that journey has pictures on, and the first two steps never do.
- **Notes:** a button in the header on every step opens a notebook over the lesson (a video keeps playing). Notes are the student's own: not sent to the teacher, not an answer (pasting is allowed and not counted), copyable, and kept with the saved place. The first time a student presses Begin on a device, the button gets a soft pulse and a one-line tip for a few seconds, once (remembered separately from the saved place, so starting over or finishing does not bring it back).
- **Saved place:** the student page keeps everything on the student's own device (localStorage, 14 days, only on `/makeup-work/start`; the admin preview and tests never save): the screen they were on, every answer and unfinished draft, the lessons chosen, cites, notes, how much of each reading or video was played (as exact seconds, so replaying the same part after coming back still earns nothing twice) and where the video stopped, and the numbers behind the teacher's signal (paste attempts, jumps, typing, active time), which are also restored so words typed earlier are never mistaken for pasted ones. Closing the page does not count as leaving it while writing. Sending the work clears it; "Start over" (two taps) clears it too. Stored data is checked on the way back in and fitted to the lessons and classes that exist now: a removed lesson sends the student back to choosing, and a removed class back to the start. Shared computers are the one risk: the next student would see the last student's place, so the page says it is saved on this device and offers Start over.
- **Back and forward:** two small pills float at the two ends of the progress ridge. Back goes to the step before (from the first step after the lessons it lands on the last lesson; between lessons it goes to the previous one). Forward opens only when the screen the student is on is finished (the Begin details and quiet moment; the right number of picks; a lesson played enough with its questions answered; the truth and where it was found; both answers), and a tap on it before then says what is missing. The last step has no forward pill: it is finished with its own button, and nothing can move while the work is being sent. Going back never loses anything: every answer and draft stays, and each lesson keeps its own record (time read, seconds played, where it stopped, how far it got, whether it is finished). Choosing the same way again keeps the same lessons and what was done in them; choosing a different way, or changing the number of days, starts the choice again. The totals the teacher sees are worked out from those records at the moment of sending, so going back and forth can never count anything twice.
- **Timeline under every recording and video (including YouTube):** one bar for the whole length: green where it was played, red where it was skipped, grey where the student has not got to, and a marker at the playhead. "Skipped" means anything before the furthest point the playhead has been that was never played, down to a single second, so a small jump leaves a thin red mark, and dragging to the end leaves everything before it red. Replaying a red part turns it green. Each red part can be tapped: it starts at the beginning of the first transcript line that touches it (including a line that began just before the skip, so playing from there covers all of it), not the exact second skipped. The bar is also saved with the student's place and restored after leaving a lesson or closing the page.
- **What the teacher gets:** each submission carries, for every recording or video, exactly which parts were played (`media_detail`, migration 0046, cleaned by the database: at most 8 lessons, 300 ranges each, whole seconds). The teacher's email shows the same bar (an HTML table, so it works in email) with the skipped parts in words; the admin shows it under each submission, the printed record has it in words, and the spreadsheet has a "What they played" column. The skipped parts are always worked out again from what was played, never taken from the saved skipped list. The existing signal ("played only part of it") is unchanged.
- **Page background:** on a phone the stage ends where the browser's toolbar starts, and the page behind it used to show as a black bar. While the journey is open the page takes the color the stage ends in, frame by frame as the sky changes, and gives its own back afterwards.
- **Pause questions, guiding lines and required time:** per lesson. A pause question stops a video or audio at a time (or follows a paragraph of reading), and its short answer goes to the teacher with the lesson and where it appeared.
- **Video and audio player:** a large player with the transcript flowing beneath it. The current line stays lit until the next begins, the others fade with distance, and the transcript eases to each new line. Scroll away and it stops following and offers a button that points the way back (up or down); scroll the current line back to the middle and it follows again. The header has a soft fade so it stays readable over anything scrolled under it.
- **Sound:** whether the player's own sound was off is noted for the teacher, never blocked or nagged about. Off for most of what was played (30 seconds or more) counts as "worth a conversation"; less is noted. The page cannot see the computer's speakers or headphones, only the player.
- **Students are never locked out:** a general class, "Alta Seminary", exists so the student page works as soon as it is switched on; classes can exist without a teacher email.
- **Tested:** 609 automated tests across the site (about 475 of them for Makeup Work, including saved progress, notes, the page background, moving back and forward, the played/skipped timeline and what the teacher is given: rules, effort signals, transcripts, played-time and sound tracking, the YouTube player, voice, pause questions, the flowing transcript and its scrolling, the journey with and without skip tools, the student page, the teacher email, the Lessons page and editor, the admin forms and review screens, sound); 23 measured audio checks; real-browser runs including a complete student run on the real student page (a spoken reflection, a real submission saved, the email function called), real YouTube playback with a pause question that stopped the video and resumed it, real mouse-wheel scrolling of the transcript, the database rules for the on/off switch, and the deployed email function probed from outside;
- **Still not built:** the reading checklist (needs the official passage list), teachers pre-assigning what a class studies, a private link for each teacher to review their own class, keeping the audio of a spoken answer (deliberately not done), more video lessons beyond the 17 talks, and Come, Follow Me lessons.
