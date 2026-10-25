# Makeup Work: the starting library

**209 lessons are already loaded** in the database (Makeup Work, in the admin, lists them; the test page uses them).

| Kind | How many | What |
|---|---|---|
| Scripture | 75 | Christ-centered chapters and the seminary reading blocks: 24 Book of Mormon, 20 New Testament, 10 Old Testament, 16 Doctrine and Covenants, 5 Pearl of Great Price. Full verse text, verse numbers included. |
| Conference talk (text) | 97 | Every substantive talk from April 2026, October 2025 and April 2025 general conferences (sustaining votes, reports and the like are left out). |
| Audio talk | 17 | A spread of talks (8 to 15 minutes) as audio, each with its **real timestamped captions** (the English caption track of the talk's video, about 130 to 220 lines each). Students can follow along, click a line to jump there, and cite a moment. |
| Video talk | 17 | The **same 17 talks as video, played from YouTube** (the Church's own "General Conference of The Church of Jesus Christ" channel), with the same timestamped transcript beside the video. See "Video" below. |
| Proclamation | 3 | The Family: A Proclamation to the World; The Living Christ; The Restoration of the Fulness of the Gospel of Jesus Christ. Full text. Shown as "Deep study", once per student. |

Every lesson records where it came from (`origin_url`), its author, and its series, and the admin list is searchable and filterable by type.

## How it got there

Nothing was hand-copied. A builder (`scripts/build_makeup_library.py`) and a one-time Supabase edge function (`scripts/makeup-library-import.edge.ts`, now replaced by a do-nothing stub) pulled from:

- **Scripture text:** the open-source JSON editions at `github.com/bcbooks/scriptures-json` (2013 text, with the Church's footnotes, summaries and introductions already removed by that project; the Old and New Testaments are King James).
- **Talks, and the address of each audio file:** the Church's public content API (`churchofjesuschrist.org/study/api/v3/...`), the same data the Gospel Library site uses.
- **Captions:** the English caption track attached to each talk's video.

Audio is **not copied**: the journey plays it straight from the Church's own file address (it supports seeking). The text and transcripts are stored in our database.

## Video

YouTube is the default for video: no files to host, the Church publishes there, and it already carries captions.

- **How it plays:** through YouTube's player in privacy-enhanced mode (`youtube-nocookie.com`, no tracking cookies until play), with YouTube's own captions switched on. We still keep our own transcript beside the video, because YouTube does not share its captions with other sites, and the transcript is what powers the live line, click-to-jump and "Cite this moment". Played time is counted the same way as for audio (skipping ahead earns nothing).
- **Why these 17 line up:** the captions came from the Church's own video, so a YouTube copy only matches if it is the same recording. Each of the 17 was matched on the official channel, by title, and by length (all within 1 second of the stored length). Checked in a real browser: YouTube's on-screen caption was the same line the transcript highlighted, and jumping to a line moves the video and adds almost nothing to played time.
- **Adding more:** in the admin, choose Type: Video and paste a YouTube link. The form says what it understood ("Plays as: YouTube video") and will not add an address the player cannot play. Paste or upload the captions (.vtt or .srt) and the length; both are required. For a batch of talks, `scripts/makeup-find-youtube.py` finds and checks the official video for each (see its header), and the new rows can copy the transcript from the matching audio row with SQL.
- **Also supported:** a direct video file (`.mp4`, `.webm`). The Church publishes `.mp4` files for each talk with the captions built in, at the same host as the audio, but browsers other than Safari do not show built-in captions, so YouTube is the simpler default.
- **If a video is taken down or made private,** that lesson shows "This video could not be played." Switch it off in the admin or swap the link.

## Be careful with this

- This copies Church-owned text and captions into our database. The school has permission to use the Church's text and captions in the library (confirmed by the site owner). Keep the permission on file, and use whatever attribution wording it asks for. Each talk shows its speaker and conference; each scripture shows its reference.
- If the Church ever moves or removes an audio file, that lesson stops playing. The admin can swap the address.
- The scripture list is curated, not exhaustive (the full standard works would bury the good chapters). The reading blocks follow a third-party list of the seminary required passages; verify them against the official *Seminary Scripture Passages* document.
- Titles for scripture chapters (like "A seed of faith") are short descriptions I wrote. Edit any that miss.

## Adding more later

- By hand: **Makeup Work, Sources**, add a source (text, a video or audio address, plus its captions for video or audio).
- In bulk: edit the lists at the top of `scripts/build_makeup_library.py` (the passage list `S`, and `CONFERENCES`), run it, and import with the edge function pattern. The importer skips anything already loaded (matched on `origin_url`), so re-running is safe.
- Not yet included: videos beyond the 17 talks above, hymns and music, Come, Follow Me lessons, and the Institute manuals.
