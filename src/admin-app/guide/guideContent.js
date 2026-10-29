// The admin tour. ONE list of slides drives everything: the step-through guide
// (GuideDialog), the (i) buttons placed beside features (InfoButton, which
// links to a slide), and the written guide in docs/ADMIN_GUIDE.md.
export const SLIDES = [
  {
    id: 'welcome', title: 'Welcome to the Alta Seminary admin',
    what: 'This is where you edit the public website. Nothing you do here goes live until you press Publish, so you can explore safely.',
    steps: [
      'The menu on the left is your map: Pages, Content (announcements, events, photos), Directories, Makeup Work, Team, History, Diagnostics.',
      'Look for the small (i) buttons beside features. They explain what the thing is, and "Demonstrate for me" jumps to that slide of this guide.',
      'You can reopen this guide any time from "Guide" in the left menu.',
    ],
  },
  {
    id: 'pages', title: 'Pages and navigation',
    what: 'Every page on the site, in the order it appears in the top menu.',
    steps: [
      'Press Edit on a page to change what is on it.',
      'The eye icon controls whether a page appears in the top menu; the arrows reorder it.',
      '+ New Page creates one, and you can nest a page under a parent to make a sub-page.',
      'Rename, copy and delete are the icons on the right of each row. A page keeps its web address when renamed, and old links are redirected.',
    ],
    tip: 'Unpublish takes a page offline without deleting it.',
  },
  {
    id: 'editing', title: 'Editing a page',
    what: 'Pages are built from blocks (text, images, buttons, columns, sliders...). You edit them right on the page.',
    steps: [
      'Click any text or image to change it directly.',
      'Click a block to select it. Drag the "Move" bar to reorder, or use Duplicate and Remove at its top right.',
      'Changes save automatically as a draft. The "Draft saved" note confirms it.',
    ],
  },
  {
    id: 'add-block', title: 'Adding blocks',
    what: 'The red "Add block" button stays pinned to the bottom of the editor, so it is always within reach.',
    steps: [
      'Press Add block and pick from the groups (Layout, Media, Informational, Interactive, Live Content).',
      'The new block appears at the bottom; drag it where you want it.',
      'Columns and sliders can hold other blocks inside them.',
    ],
  },
  {
    id: 'settings', title: 'Block settings',
    what: 'Everything about a block that is not its text: colors, spacing, links, layout, speed.',
    steps: [
      'Select a block and press Settings. A panel opens on the right.',
      'For something inside a slider or columns, use the Settings button under that item. The panel names exactly which one you are editing.',
      'Press Settings again, or "Hide panel", to give the page more room.',
    ],
  },
  {
    id: 'publish', title: 'Publishing',
    what: 'Editing saves a draft. Publish makes it live; the public site updates in about a minute.',
    steps: [
      'Press Publish at the top of the editor. You can also schedule it for later, or set it to unpublish itself on a date.',
      'If you typed a phone number, email or web address without linking it, a list offers to turn them into links. Tick the ones you want.',
      'Unpublish takes it back offline at any time. Your content stays saved.',
    ],
    tip: 'Not sure how it will look? Use the Preview tab first.',
  },
  {
    id: 'preview', title: 'Previewing',
    what: 'See the page as visitors will, before publishing.',
    steps: [
      'Switch from Edit to Preview at the top of the editor.',
      'Try the Desktop, Tablet and Phone sizes. Most visitors are on phones.',
    ],
  },
  {
    id: 'header-footer', title: 'Header and footer',
    what: 'The strip at the top and bottom of every page. It sits at the top of the Pages list in red because it is always there and cannot be deleted or renamed.',
    steps: [
      'Open it from the red "Header & Footer" bar on the Pages list.',
      'Header: the logo, an optional announcement bar above it, and whether search, text size and light/dark buttons show.',
      'Footer: your text, contact details, quick links and social links. Each link can have an icon.',
      'Required parts (logo description, footer text, at least one link) cannot be left blank.',
    ],
  },
  {
    id: 'content', title: 'Announcements, events and photos',
    what: 'Content is for things that change often.',
    steps: [
      'Announcements are short news posts shown on the Announcements page.',
      'Events are pages of their own. Switch on "Show in announcements" to list one there until it ends, after which it moves to the Events archive on its own.',
      'Photo albums hold galleries. Link an album to an event, and its photos appear on the event page.',
      'Use "Related" on any item to connect events, announcements and albums.',
      'The Gallery page opens on the Image library: every picture used anywhere on the site, found in one place. Anything uploaded anywhere is added to it automatically, and so are the pictures that come with the site (the paintings, the logo) and the ones only linked from other websites (the Church\'s picture for a talk, YouTube\'s picture for a video).',
      'Type in the search box to find a picture. The start of a word is enough, and it looks in the title, tags, description, alt text and credit. You can also narrow by tag, by where it came from, or by where it is used (including "Not used anywhere", to find leftovers).',
      'Open a picture to describe it: a title, alt text, a description, tags, a credit and a permission note. The more you write, the easier it is to find later. The same page shows every place that uses it, with a link to each.',
      'A picture that something uses cannot be deleted, so nothing on the site can lose its image by accident. "Replace the picture" puts a new picture at the same address, so it changes everywhere it is used, and it asks first when it is used. A picture that only lives on another website can be removed from the library but never changed.',
      'Anywhere you choose "an existing image" (a page, an announcement, a directory photo, a lesson picture) you get the same library, with the same search.',
    ],
  },
  {
    id: 'directory', title: 'Directories',
    what: 'Lists of people (faculty, staff, councils) shown as cards on the site.',
    steps: [
      'Choose a directory, then add or edit people: name, role, photo and bio.',
      'Visitors click a card to see the full profile.',
    ],
  },
  {
    id: 'makeup', title: 'Makeup Work',
    what: 'Where students make up missed class time, and where you set it up.',
    steps: [
      'Add each class and the teacher\'s email. Each time a student finishes, their teacher is emailed (set that up once under "Email to teachers" in the top card; until then, submissions are saved here and marked "Not emailed"). One general class comes ready-made so students are never locked out; press Edit on it to add a teacher.',
      'Press "Manage lessons" for the Lessons page. Every lesson has a picture and a type, grouped by type and then by collection (the books of scripture, each conference). Open any lesson to change it from beginning to end: its text or YouTube link, transcript, picture, a guiding line, how long students stay, and questions that pause them. Everything that came ready-made can be edited, hidden or deleted. Every scripture chapter also has a "Listen" version: the Church\'s own recording with each verse lighting up as it is read.',
      'Pictures are quiet by default. A lesson only shows its picture, and a painting of the Savior on each step, when "Show pictures to students" is on in that lesson; each collection also has "Pictures on" and "Pictures off" buttons to do a whole group at once.',
      'On a lesson, "Preview as a student" opens it exactly as a student sees it. On the Makeup Work page, "Try the student experience" goes through the whole thing, with skip tools you can turn off.',
      'Students move through the steps with two small pills beside the progress ridge. Back goes to any earlier step; forward opens only once the step they are on is finished (a lesson played enough, a truth written, both answers given), so nothing can be skipped over. Everything they did stays, and a lesson they finished stays finished.',
      'Students can keep private notes from a button in the header on every step; you never see them, and they are not emailed. A student\'s place is also saved on their own device for 14 days, so closing the page or the phone and coming back picks up exactly where they were, answers and notes included, and a "Start over" link clears it. On a shared computer, remind students to press Start over if they leave without finishing.',
      'Switch on "Makeup Work is open to students" when you are ready. The card then shows the link students use (it ends in /makeup-work/start). It is not in the site menu, so share the link or add a button for it on your Makeup Work page. Switch it off and students see "not open right now".',
      'Under Submissions, mark each one Accepted, or Needs redo with a note. You can see who was emailed and send it again, print a record, or download a spreadsheet. The signal also tells you if a student skipped through a video or audio, or had the player\'s sound off for most of it (they may have been reading the transcript).',
      'Every recording and video shows a bar like the one the student saw: green where it was played, red where it was skipped (even a few seconds), grey where they never got to. The exact skipped parts are written out too. You will find it in the email, under each submission, in the printed record and in the spreadsheet. A student can tap a red part to play it again, starting from the beginning of that line of the transcript.',
    ],
    tip: 'Responses are kept for 90 days, then deleted automatically.',
  },
  {
    id: 'team', title: 'Team',
    what: 'Who can sign in to this admin.',
    steps: [
      'Invite a new admin by email. They get a link to set their password.',
      'Everyone here can edit everything, so only invite people you trust.',
    ],
  },
  {
    id: 'history', title: 'History',
    what: 'A record of changes: what was edited, when, and by whom.',
    steps: [
      'Use it to see what changed if something looks wrong.',
      'If a publish ever fails to go live, a red notice at the top of the admin links here.',
    ],
  },
  {
    id: 'diagnostics', title: 'Diagnostics and page health',
    what: 'Checks that help keep the site in good shape, plus a few tools.',
    steps: [
      'Page health flags things worth fixing, like an image with no description.',
      'The same notes show on the Pages list as small badges.',
    ],
  },
  {
    id: 'accessibility', title: 'Accessibility',
    what: 'Almost all of it is automatic: page headings, link names, color contrast, keyboard use and reduced-motion are handled for you.',
    steps: [
      'The one job that is yours: when you add a photo, fill in its description ("Alt text") so people using screen readers know what it shows.',
      'Write what the picture shows, in a short sentence. Skip "image of".',
    ],
  },
];

// Where each (i) button points. `blurb` is the one-line explanation in its popup.
export const FEATURES = {
  pages: { slide: 'pages', title: 'Pages and navigation', blurb: 'Every page on the site, in menu order. Edit, add, reorder, hide or remove them here.' },
  'header-footer': { slide: 'header-footer', title: 'Header and footer', blurb: 'The top and bottom of every page. Always present; you can change what they say and show.' },
  editing: { slide: 'editing', title: 'Editing', blurb: 'Click text and images to edit them right on the page. Changes save as a draft.' },
  'add-block': { slide: 'add-block', title: 'Add block', blurb: 'Adds a new piece of content (text, image, button, slider...) to the page.' },
  settings: { slide: 'settings', title: 'Block settings', blurb: 'Colors, spacing, links and layout for the selected block.' },
  publish: { slide: 'publish', title: 'Publish', blurb: 'Makes your draft live on the public site, now or on a date you pick.' },
  preview: { slide: 'preview', title: 'Preview', blurb: 'See the page as visitors will, on desktop, tablet and phone sizes.' },
  content: { slide: 'content', title: 'Content', blurb: 'Announcements, events, photo albums and the searchable image library.' },
  directory: { slide: 'directory', title: 'Directories', blurb: 'The people cards (faculty, staff, councils) shown on the site.' },
  makeup: { slide: 'makeup', title: 'Makeup Work', blurb: 'Set up classes, teacher emails and lessons, and read what students submit.' },
  team: { slide: 'team', title: 'Team', blurb: 'Who can sign in to this admin, and how to invite someone.' },
  history: { slide: 'history', title: 'History', blurb: 'A log of every change, so you can see what happened and when.' },
  diagnostics: { slide: 'diagnostics', title: 'Diagnostics', blurb: 'Health checks that flag things worth fixing, like images missing a description.' },
};

export const slideIndex = (id) => Math.max(0, SLIDES.findIndex((s) => s.id === id));
