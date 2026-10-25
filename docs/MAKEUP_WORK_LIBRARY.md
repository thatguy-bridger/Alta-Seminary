# Makeup Work: the starting library

**189 lessons are already loaded** in the database (Makeup Work, in the admin, lists them; the test page uses them).

| Kind | How many | What |
|---|---|---|
| Scripture | 75 | Christ-centered chapters and the seminary reading blocks: 24 Book of Mormon, 20 New Testament, 10 Old Testament, 16 Doctrine and Covenants, 5 Pearl of Great Price. Full verse text, verse numbers included. |
| Conference talk (text) | 97 | Every substantive talk from April 2026, October 2025 and April 2025 general conferences (sustaining votes, reports and the like are left out). |
| Audio talk | 17 | A spread of talks (8 to 15 minutes) as audio, each with its **real timestamped captions** (the English caption track of the talk's video, about 130 to 220 lines each). Students can follow along, click a line to jump there, and cite a moment. |

Every lesson records where it came from (`origin_url`), its author, and its series, and the admin list is searchable and filterable by type.

## How it got there

Nothing was hand-copied. A builder (`scripts/build_makeup_library.py`) and a one-time Supabase edge function (`scripts/makeup-library-import.edge.ts`, now replaced by a do-nothing stub) pulled from:

- **Scripture text:** the open-source JSON editions at `github.com/bcbooks/scriptures-json` (2013 text, with the Church's footnotes, summaries and introductions already removed by that project; the Old and New Testaments are King James).
- **Talks, and the address of each audio file:** the Church's public content API (`churchofjesuschrist.org/study/api/v3/...`), the same data the Gospel Library site uses.
- **Captions:** the English caption track attached to each talk's video.

Audio is **not copied**: the journey plays it straight from the Church's own file address (it supports seeking). The text and transcripts are stored in our database.

## Be careful with this

- This copies Church-owned text and captions into our database. You said the school has permission; I would still get that in writing, and ask whether they want attribution wording. Each talk shows its speaker and conference; each scripture shows its reference.
- If the Church ever moves or removes an audio file, that lesson stops playing. The admin can swap the address.
- The scripture list is curated, not exhaustive (the full standard works would bury the good chapters). The reading blocks follow a third-party list of the seminary required passages; verify them against the official *Seminary Scripture Passages* document.
- Titles for scripture chapters (like "A seed of faith") are short descriptions I wrote. Edit any that miss.

## Adding more later

- By hand: **Makeup Work, Sources**, add a source (text, a video or audio address, plus its captions for video or audio).
- In bulk: edit the lists at the top of `scripts/build_makeup_library.py` (the passage list `S`, and `CONFERENCES`), run it, and import with the edge function pattern. The importer skips anything already loaded (matched on `origin_url`), so re-running is safe.
- Not yet included: video (the Church's video files are large; audio plus captions is lighter), hymns and music, the Proclamations (Family, The Living Christ, the Restoration), Come, Follow Me lessons, and the Institute manuals.
