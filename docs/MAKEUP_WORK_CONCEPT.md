# Makeup Work: concept

Status: concept for review. Nothing here is built yet. Decisions marked **(decide)** are yours.

## What you told me

| Topic | Decision |
|---|---|
| Purpose | Replace missed **class time** (not specific assignments) |
| Review | A **teacher reviews**; delivery by **email to the teacher** first. A printable/exportable record comes later, once there is feedback |
| Sign-in | **None**: the student types their name (plus grade and class) |
| Length | **Depends on days missed**; the student says how many days |
| What they produce | All of: written reflection, guided questions, spoken response, personal commitment. Each optional, switched on per lesson by you |
| Anti-copy/AI | **Firm + design-based**: paste blocked, effort signals recorded, personal prompts |
| Access | **Voice option always available** plus a **teacher exception** |
| Teacher sees | Response **plus effort signals** |
| Sources | Scripture, Church video, audio, talk/article. **Curated core + admins can add more**; stay **in-app, embeds only** |
| Rights | You have permission to use Church content |
| Feel | Calm, reverent; start with a **prayer prompt**; "what stood out to me" questions; closing commitment. Same design language, but a distinct, **immersive study space** |
| Flow | One step at a time, with a visible **progress path** |
| Fun | Smooth motion and a quiet "well done"; light progress only |
| Privacy | Store name, class, response, effort data (with a delete-after window) |
| Devices | Phones and laptops about equally |

## The idea in one line

A short, quiet, guided "study journey" the student walks through one screen at a time: **settle, choose how to learn, learn, ponder, respond in your own words, commit**. A teacher gets an email that reads like a personal note, with a small effort summary.

The page feels like part of the Alta site (same fonts, red, pills, dark/light), but while a student is inside the journey it becomes a calm full-screen space: no header or footer, one thing at a time, slow eased transitions like the existing "glide in" motion.

## The student journey

A thin progress path across the top (a line with 6 dots that fills as they go).

1. **Welcome.** A name field, grade, class/teacher, and "how many days did you miss?" Big friendly type. A note that this takes about 15 minutes per day missed, so 2 days is 2 short sessions.
2. **A moment to begin.** Full screen, mostly empty. A prayer prompt: *"Take a moment. Invite the Spirit before you begin."* A quiet "I'm ready" button that stays disabled for a few seconds, so people slow down.
3. **Choose how you want to learn.** Four large cards: **Read** (scripture or talk), **Watch** (Church video), **Listen** (audio/talk/hymn), plus **Surprise me**. Each card shows time and a one-line description. They choose one.
4. **Learn.** The source appears inside the page (embedded video/audio, or the scripture/talk shown in a reader). A subtle timer so they stay with it. No copy: text selection is disabled on the reader and context menus are off.
5. **Ponder.** One prompt, one screen: *"What stood out to you? Why do you think that?"* Optional second prompt personal to them, such as *"Describe a time you felt this was true in your own life."* (Prompts are chosen to be about the student, not the material, which is what AI cannot answer.)
6. **Respond.** The student writes (paste blocked) **or** presses **Speak** and records. Either way, it is theirs, live.
7. **Commit.** *"What will you do this week because of what you learned?"* One sentence. This is the closing testimony moment.
8. **Done.** A quiet, slow "Well done." A short confirmation that the teacher will see it, and a line of encouragement. If they owe more days, "Begin the next one."

## Anti-copy and anti-AI design (honest version)

Nothing online can fully prevent AI use, especially on a phone. The goal is to make cheating *harder and more visible* than just doing it. Layers:

- **No paste.** Paste, drag-drop and the context menu are blocked in the response fields. Each attempt is recorded.
- **Reader is not copyable.** Text selection and copy are disabled on the in-app reader (a determined person can still retype).
- **Effort signals (stored for the teacher):** active time on each step, time spent in the source, number of paste attempts, large jumps in text (a lot typed in a second), tab switches/leaving the page, typing rhythm summary. Not keystrokes themselves.
- **Design-based:** the main prompts ask what *they* felt, saw, and will do. These have no "correct" answer to look up.
- **Voice path:** speaking is hard to fake and a good fit for students who type slowly. Transcribed on-device or by the browser; the audio can be kept for the teacher.
- **Teacher-readable flags,** not automatic punishments: a calm "Looks typed live" or "Worth a conversation" with the reasons.
- **Exceptions:** the teacher or office can unlock a student, such as a pasted answer from a screen reader.

Honest limits: a phone keyboard with dictation, a second device, or retyping AI text can slip past. The teacher email is the real safeguard; this raises the effort needed to cheat. Also, effort data about minors should be minimal, explained to students, and deleted after a window (suggest 90 days). **(decide: retention)**

## Sources, and staying in-app

A **library** managed in the admin, each item: title, type (scripture / video / audio / talk), the embed or reference, estimated minutes, and an optional note or suggested prompts. Students pick from it; admins add more at any time.

What I found when I checked:
- **YouTube / Vimeo / Church video:** embeds work; our content-security policy already allows YouTube and Vimeo. Church media may use its own player; to confirm.
- **churchofjesuschrist.org pages (scriptures, conference talks):** the site did not send headers blocking being shown inside another page, so embedding looks possible, but it would show their full page and navigation, which lets a student wander off and breaks the calm feel. **To test in a real browser before committing.**
- **Better for calm:** a built-in **reader** that shows a passage inside our design (clean typography, nothing else). It needs the text in our database or fetched from an official source; you said you have permission, so we need an agreed way to get it. **(decide: reader text source)**
- **Audio:** an in-app player for audio we host or an approved stream; podcasts via their embed player.

So the plan: **videos and audio embed directly; scripture and talks use our own calm reader** where we can, and an embedded Church page as the fallback.

## Teacher side

- **Email on submit** to the teacher: the student's name and class, how many days, the source they chose, their response (and audio link if recorded), their commitment, and the effort summary with plain-language flags. Reads like a note, not a database dump.
- **Needs:** an email service. The site has none today, and Supabase's built-in email is rate-limited. A free **Resend** account is the usual answer. **(decide: which email service / address)**
- **Backup:** every submission is also stored, so it isn't lost if an email fails.
- **Later (when you have feedback):** an admin queue with approve / ask to redo, and a printable/exportable record per student or class.

## Admin controls (kept small)

- Turn the Makeup Work page on or off (there's already a setting).
- Manage the source library.
- Per lesson/session: which of the four response types are on (reflection, guided questions, voice, commitment), and the prompts.
- Set the teacher email per class.
- Grant a student an exception.

## How it fits the site

The experience is its own full-screen mode inside the same app: the same logo, fonts, red, pills and dark/light, but with bigger type, generous space, and the slow glide-in motion already used across the site. Reduced-motion and keyboard use are respected, and it is accessible from the start.

## Build plan

**Phase 1: a real first version you can show teachers**
Journey screens 1 to 8; one or two sources of each kind from a small curated library; written reflection plus commitment; paste blocked and effort signals collected; teacher email; submissions stored; admin on/off.

**Phase 2: depth**
Voice response; the in-app reader; admin-managed library; per-lesson response settings; teacher exceptions.

**Phase 3: after teacher feedback**
Admin review queue, printable/exportable records, retention tools, streaks (only if teachers want them).

## Open questions for you

1. **Teacher email:** a single address for all, or per teacher/class? And OK to set up a free Resend account for sending?
2. **Scripture/talk text:** how can we obtain it for our own reader (an official feed, a one-time import, or your own list of approved passages)?
3. **Prompts:** do you want to write them, or should I draft a starter set for you to edit?
4. **How many days max** in one sitting, and is "about 15 minutes per day missed" about right?
5. **Retention:** delete submissions and effort data after 90 days?
6. **Students under 13 / parental consent:** is there a school policy on collecting names and recordings?
7. **Spam:** with no sign-in, anyone could submit. A short class code the student gets from the teacher would stop strangers. OK to add?
