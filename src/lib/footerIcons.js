// A small, focused icon set for footer links (24x24 grid, drawn as strokes).
// Picked for an LDS seminary site: faith/learning/community icons first, then
// the handful of everyday website ones. Each icon is just a list of path
// strings so the public Astro footer and the admin picker draw the same thing.
export const FOOTER_ICONS = [
  // Contact and reach out
  { id: 'contact', label: 'Contact (address book)', paths: ['M20 6v12a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2z', 'M10 16h6', 'M13 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M4 8h3', 'M4 12h3', 'M4 16h3'] },
  { id: 'mail', label: 'Email', paths: ['M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M3 7l9 6 9-6'] },
  { id: 'phone', label: 'Phone', paths: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2'] },
  { id: 'message', label: 'Message', paths: ['M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z'] },
  { id: 'map-pin', label: 'Location', paths: ['M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z', 'M12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'] },
  // Faith and learning
  { id: 'temple', label: 'Temple', paths: ['M12 1.5v3', 'M9.5 11V8L12 4.5 14.5 8v3', 'M5 12V9.5L6.5 8 8 9.5V12', 'M16 12V9.5L17.5 8 19 9.5V12', 'M3 21h18', 'M5 21v-9h14v9', 'M10.5 21v-4a1.5 1.5 0 0 1 3 0v4'] },
  { id: 'book', label: 'Scriptures', paths: ['M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z', 'M5 17a3 3 0 0 1 3-3h11'] },
  { id: 'book-open', label: 'Study (open book)', paths: ['M12 6C10 4.5 7 4 3 4v14c4 0 7 .5 9 2 2-1.5 5-2 9-2V4c-4 0-7 .5-9 2z', 'M12 6v14'] },
  { id: 'graduation', label: 'Seminary / graduation', paths: ['M2 9l10-5 10 5-10 5z', 'M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5', 'M22 9v6'] },
  { id: 'light', label: 'Light / inspiration', paths: ['M9 18h6', 'M10 21h4', 'M12 3a6 6 0 0 0-3.5 10.9c.7.6 1 1.3 1 2.1h5c0-.8.3-1.5 1-2.1A6 6 0 0 0 12 3z'] },
  { id: 'tree', label: 'Tree of life', paths: ['M12 21v-6', 'M12 3c3.5 0 6 2.5 6 5.5S15.5 14 12 14 6 11.5 6 8.5 8.5 3 12 3z', 'M8 21h8'] },
  { id: 'heart', label: 'Service / love', paths: ['M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z'] },
  { id: 'users', label: 'Community', paths: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M16 4.3a3.5 3.5 0 0 1 0 6.4', 'M18 14a6.5 6.5 0 0 1 3.5 6'] },
  { id: 'music', label: 'Hymns / music', paths: ['M9 18V6l11-2v12', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'] },
  { id: 'star', label: 'Star', paths: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'] },
  { id: 'sparkles', label: 'Sparkles', paths: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M19 16v4', 'M17 18h4'] },
  { id: 'mountain', label: 'Mountains (Alta)', paths: ['M2 20l7-12 4.5 7.5 2.5-4L22 20z'] },
  // Everyday website
  { id: 'home', label: 'Home', paths: ['M3 11l9-8 9 8', 'M5 10v10h14V10', 'M10 20v-6h4v6'] },
  { id: 'calendar', label: 'Calendar', paths: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M16 3v4', 'M8 3v4', 'M3 11h18'] },
  { id: 'clock', label: 'Schedule', paths: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'] },
  { id: 'bell', label: 'Announcements', paths: ['M6 16V11a6 6 0 0 1 12 0v5l2 2H4z', 'M10 21h4'] },
  { id: 'info', label: 'Information', paths: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5', 'M12 8h.01'] },
  { id: 'help', label: 'Help / FAQ', paths: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5', 'M12 17h.01'] },
  { id: 'file', label: 'Document / form', paths: ['M6 3h8l5 5v13H6z', 'M14 3v5h5', 'M9 13h6', 'M9 17h6'] },
  { id: 'download', label: 'Download', paths: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'] },
  { id: 'link', label: 'Link', paths: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'] },
  { id: 'globe', label: 'Website', paths: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18'] },
  { id: 'user', label: 'Person', paths: ['M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 21a7.5 7.5 0 0 1 15 0'] },
];

const BY_ID = new Map(FOOTER_ICONS.map((i) => [i.id, i]));
export const getFooterIcon = (id) => BY_ID.get(id) || null;

// Stored values: '' = automatic, 'none' = no icon, otherwise an icon id.
export const cleanIconChoice = (v) => (v === 'none' || BY_ID.has(v) ? v : '');

// What to draw before a footer link. '' = automatic: the Contact link gets the
// address book, a social link gets its site's favicon, anything else none.
export function pickFooterIcon(link, kind, social) {
  if (link.icon === 'none') return null;
  const chosen = getFooterIcon(link.icon);
  if (chosen) return { type: 'svg', icon: chosen };
  if (kind === 'social') return social ? { type: 'favicon', domain: social.domain } : null;
  const isContact = /\/contact\/?$/i.test(link.url) || link.label.toLowerCase() === 'contact';
  return isContact ? { type: 'svg', icon: getFooterIcon('contact') } : null;
}
