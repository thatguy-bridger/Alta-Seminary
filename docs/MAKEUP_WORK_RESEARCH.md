# Makeup Work: what already exists, and how we do more

Researched in October 2026 from public pages. Local practices differ by area, so treat anything below as "what is commonly done", and confirm with your seminary leaders.

## What the Church itself says

From the Church's seminary credit page ([source](https://www.churchofjesuschrist.org/si/seminary/changes-to-seminary-credit-requirements?lang=eng)):

- Students need **at least 75% attendance** (in person or online) to earn credit.
- Credit also needs reading about **60 pages of scripture per course** (about 30 per term), from the *Seminary Scripture Passages* document. Makeup for missed reading uses those same passages.
- Students complete at least one **"Assess Your Learning"** lesson in each half of the course. Teachers give "Part 1" or "Part 2" from the teacher manual appendix as makeup.
- Teachers record credit in **WISE**; online students submit through **Canvas**.
- Personal study goals are not reported to the teacher.
- Another Church seminary page says only that makeup work "should be completed in a timely manner" and does not say what it is.
- A teacher's forum post describes mySeminary letting teachers **post makeup work in advance** so students and parents can see it before an absence.

## What Alta does today

From the current [Alta make-up page](https://www.altaseminary.com/make-up):

- Makeup is required when attendance is under 75%, even for excused absences.
- **Limit of 7 makeups per week.**
- Print a Make Up Sheet (a Google Drive file) or get one from the teacher; choose scripture passages **or conference talks**; write what you learn on the sheet or in your journal; hand it to the teacher or the Seminary Office.
- A separate **Google Form** reports reading makeup.
- Not stated: deadlines, credit values, how it is reviewed.

## What other programs do

- **Saratoga Seminary** ([page](http://www.saratoga-seminary.org/makeup/)): six options, each worth one day: a two-talk General Conference review, a self-guided lesson from the home-study manual, a missionary-prep podcast, and three **one-time** deep studies (the Restoration, Family and Christ proclamations). Each ends in questions and a submission form. More than 15 days needs an email.
- **Local seminaries** ([example](https://www.seminaryhelps.com/more/student-make-up-work)): find the lesson for the missed date, complete it in a shared doc or on paper (photograph it), and submit by form or hand it to the teacher.
- **A common worksheet** (a "Seminary Makeup" PDF used by one program) is the clearest picture of the expected work. It says **30 to 60 minutes**, and the teacher "will ask you to redo the assignment if it is apparent you did not give your full effort". The steps:
  1. **Read the content** you missed, marking important or favorite passages.
  2. **Identify a truth** (a doctrine or principle) and the verse where you found it.
  3. **Understand the truth**: how it could help a teenager, and how a teenager might apply it.
  4. **Feel the importance**: write your feelings and testimony, or a personal experience.
  5. **Apply the truth**: something you commit to do, and how it will bless your life.
  "Use all the space provided" is how it checks effort.
- **Institute** makeup, in one class document: study the missed lesson about 45 minutes and record your thoughts.

## What we learned, and what we changed

| What exists | What we do with it |
|---|---|
| Worksheet pattern: read, truth, understand, feel, apply | The journey follows it screen by screen. Same teaching pattern teachers already trust. |
| "Use all the space" as the effort check | Replaced with real effort signals and minimum thoughtful answers, which do not reward padding. |
| 30 to 60 minutes per makeup | Default is 30 minutes per missed day, a setting (`makeup_minutes_per_day`). |
| "Redo if no full effort" | Planned: the teacher can send a submission back with a note (phase 3). |
| Print, write by hand, hand in | Everything in the app, with voice as an alternative to typing. |
| Google Drive sheet plus a separate Google Form for reading | One place. Reading makeup (below) is a checklist in the app. |
| Limit of 7 makeups a week | Enforced for the student by the server (counts days covered). |
| Saratoga's options, including one-time deep studies | Source types now include lessons, podcasts and one-time studies ("once per student"). |
| Pick scripture or conference talks | Five ways to learn: read, watch, listen, conference talks, or surprise me. |
| Teacher posts makeup work ahead of time (mySeminary) | Planned: teachers pre-assign what a class should study. |
| Several missed days = several repeats | One comprehensive journey: one more way to learn per missed day, a slightly longer answer, one truth tying it together. |

## Reading makeup (not built yet)

The Church counts required scripture reading separately from attendance. A checklist of the required passages per course, with progress saved in the app, would replace the Google Form. Passage lists vary by year and course and change over time, so we should load them from the official *Seminary Scripture Passages* document, not from a third party. The structure for this is not in the database yet.

## What we cannot replace

- **WISE** is where teachers record official credit. Nothing here connects to it. The admin screen's spreadsheet download and the teacher email are meant to make entering it quick.
- **Attendance** (the 75% rule) lives in the Church's systems. We only ask "how many days did you miss?".
- We have not verified how the Church's own pages behave when embedded, nor confirmed any of this with a seminary coordinator.

## Questions worth asking a seminary leader

1. Is 30 minutes per missed day right for Alta, or is it closer to 45 to 60?
2. Does Alta want the weekly cap counted per student across classes, or per class?
3. Should makeup for the assessments ("Assess Your Learning") also be done in the app?
4. Who needs to see a completed makeup besides the teacher (the office, a parent)?
