# Alta Seminary App — Planning Questions

Answer inline (replace the `_______` or bullet in with your answer), skip anything you're not sure about yet, and send it back whenever you're ready. Organized by topic so you can tackle it in chunks.

## A. Vision & Scope

1. In one or two sentences, what is this app for — what problem does it solve for Alta Seminary?
2. Who is the primary user: students, teachers, both, or also parents/administrators?
3. Is this meant for daily/production use by real students this school year, or is it a prototype/pitch first?
4. What's the single most important feature — the thing that, if nothing else worked, would still make this worth using?
5. Are you building this solo, or is there a seminary teacher/administrator who'll want input or approval?
6. Is there an existing system (paper attendance, a spreadsheet, a Church-provided tool) this is replacing? What's wrong with it today?
7. What does success look like in 3 months? (e.g., "every teacher uses it for attendance," "students check it daily")

## B. Users & Roles

8. How many distinct roles does the app need? (e.g., Student, Teacher, Seminary Coordinator/Admin)
9. Can one person have more than one role (e.g., a teacher who is also a parent)?
10. Do students log in individually, or is there a shared class-login model?
11. How do teachers get added to the system — self-signup, invited by an admin, or manually provisioned by you?
12. Roughly how many students and how many teachers/classes will actually use this?
13. Should parents/guardians have any visibility (e.g., into attendance or announcements) at all?

## C. Attendance

14. Who marks attendance — the teacher only, or can students self-check-in?
15. Is attendance taken once per class period per day, or does it need to track multiple periods/tracks (early morning seminary vs. release time, etc.)?
16. What statuses do you need beyond Present/Excused/Missing (e.g., Late, Excused-Church-Activity)?
17. Does an excused absence need a reason/note field, or just a status?
18. Do you need attendance history/reports (e.g., "show me Emma's attendance for the semester")?
19. Should attendance ever notify anyone (student, parent) automatically?
20. Is there a "streak" or incentive element (e.g., perfect attendance recognition), or keep it purely functional?

## D. Scripture Reading / Daily Content

21. Who supplies the daily scripture passage and reflection — you manually, the teacher, or a synced curriculum (e.g., Come, Follow Me)?
22. Should students be able to mark a reading "complete," and does that need to persist/track over time?
23. Do you want space for a short reflection/journal entry per day, or is a checkbox enough?
24. Should past days' readings remain browsable (an archive), or is only "today" shown?
25. Any interest in linking out to the Church's scripture study app/website, or should content live entirely inside this app?

## E. Class Schedule

26. Is the schedule the same every week, or does it change (rotating periods, special events, holidays)?
27. Who edits the schedule — you, or should a teacher/admin be able to update it themselves?
28. Do students need to see schedules for classes they're not enrolled in, or only their own?
29. Should the schedule integrate with a calendar app (Google Calendar, Apple Calendar) via export/sync?

## F. Announcements

30. Who can post an announcement — only an admin, or any teacher?
31. Do announcements need to target a specific class/group, or are they always seminary-wide?
32. Do you want read receipts / "seen by" tracking on announcements?
33. Should announcements expire or archive after a certain date, or stay forever?
34. Any need for attachments (a flyer PDF, a photo) on an announcement?

## G. Accounts & Authentication

35. How should people log in — email/password, a Church Account (SSO), Google sign-in, or something else?
36. Do you want self-service sign-up, or should accounts be created/invited only by you or a teacher?
37. Password reset — self-service via email, or manual?
38. Any age/privacy considerations you're already aware of for the students (most seminary students are 14–18)?

## H. Notifications

39. Do you want push notifications at all in v1, or is in-app-only fine to start?
40. If push: what should trigger one — announcements, schedule changes, attendance issues, reading reminders?
41. Email notifications as a fallback/addition to push?
42. Should users be able to control which notifications they get?

## I. Data, Backend & Hosting

43. Do you have a backend/database already in mind (Firebase, Supabase, a custom server), or is that open?
44. Roughly what's your comfort level/budget for ongoing hosting costs — free-tier only, or willing to pay a small monthly amount?
45. Who owns/manages the data long-term — you personally, or does it need to be handed off to the seminary/Church organization eventually?
46. Any requirement to export data (e.g., attendance records) to a spreadsheet or another system?

## J. Platform & Tech

47. Target platform: mobile app (iOS/Android), a responsive web app, or both?
48. If mobile: native (Swift/Kotlin) or cross-platform (React Native, Flutter, etc.)? Any existing preference or constraint?
49. Given the design system is built in React/JSX — is a web app (or React Native) the assumed direction, or open to something else?
50. Do you need offline support (e.g., mark attendance with no signal, syncs later)?
51. Any devices/browsers you specifically need to support (older phones, school-issued Chromebooks, etc.)?

## K. Privacy & Compliance

52. Since this involves minors, do you know of any specific privacy requirements from the school district or the Church you need to follow?
53. Should student data (attendance, reading progress) ever be visible to anyone outside the seminary program?
54. Do you need a way to fully delete a student's data (e.g., when they graduate or leave)?

## L. Admin/Teacher Tools

55. Do teachers need a roster management view (add/remove/edit students in their class)?
56. Should there be a "seminary coordinator" role that oversees multiple teachers/classes across the whole program?
57. Any reporting needs beyond attendance — e.g., reading-completion rates, engagement stats?

## M. Launch, Scope & Timeline

58. What's your target timeline — is there a date this needs to be usable by (e.g., start of a term)?
59. Should we build the full thing at once, or start with a minimal version (e.g., attendance + schedule only) and add features later?
60. Is this just for Alta's seminary, or could it eventually be reused/white-labeled for other seminaries (affects how hard-coded "Alta" branding should be)?
61. Do you want me to set up the actual backend/auth/hosting as part of this build, or are you handling infrastructure separately?

---

Once you've answered what you can, I'll turn this into a proper feature spec and build plan.
