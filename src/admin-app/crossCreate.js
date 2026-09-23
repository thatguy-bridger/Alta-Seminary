import { supabaseBrowser } from '../lib/supabase/browser-client';
import { slugify, uniqueSlug } from './slug.js';
import { linkContent } from './contentLinks.js';

// Which OTHER kinds each kind can spin off a new, pre-filled, auto-linked
// item of -- shown as "+ Create & link a new X" buttons on Events/
// Announcements/Gallery screens alike, all driven by this one map instead
// of each screen hand-rolling its own pair (this started as EventsScreen-
// only, event -> announcement/album; generalized so every kind can create
// every other kind).
export const CROSS_CREATE_TARGETS = {
  event: ['announcement', 'album'],
  announcement: ['event', 'album'],
  album: ['event', 'announcement'],
};

const TARGET_LABEL = { event: 'Event', announcement: 'Announcement', album: 'Photo Album' };
export function crossCreateLabel(targetKind) { return TARGET_LABEL[targetKind]; }

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

// Best-effort "smart parsing" of a date (and optionally a time) out of free
// text -- an announcement or album has no structured date field the way an
// event does, just a title/excerpt an admin already wrote in plain English
// ("Fall Fireside — September 22 at 7pm"), so this is what lets creating an
// EVENT from one of those skip re-typing a date that's already sitting
// right there, most of the time. Deliberately narrow (month-name dates and
// slash dates only, one straightforward time-of-day pattern) rather than a
// full NLP date library -- anything it can't confidently parse is simply
// left for the admin to fill in via the missing-fields dialog, which is
// always a safe fallback.
export function parseDateTimeFromText(text) {
  if (!text) return null;
  const monthPattern = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
  const namedDateRe = new RegExp(`\\b(${monthPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'i');
  const slashDateRe = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
  const timeRe = /\b(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)\b/i;

  let year, month, day;
  const named = text.match(namedDateRe);
  if (named) {
    month = MONTHS[named[1].toLowerCase()];
    day = Number(named[2]);
    year = named[3] ? Number(named[3]) : undefined;
  } else {
    const slash = text.match(slashDateRe);
    if (!slash) return null;
    month = Number(slash[1]) - 1;
    day = Number(slash[2]);
    year = slash[3] ? (slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3])) : undefined;
  }
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;

  const now = new Date();
  if (year === undefined) {
    // No year written -- assume the nearest occurrence that isn't already
    // well in the past (an admin writing "September 22" in October almost
    // always means NEXT September, not the one that already happened).
    year = now.getFullYear();
    const guess = new Date(year, month, day);
    if (guess.getTime() < now.getTime() - 24 * 60 * 60 * 1000) year += 1;
  }

  const timeMatch = text.match(timeRe);
  let hours = 0, minutes = 0, allDay = true;
  if (timeMatch) {
    allDay = false;
    hours = Number(timeMatch[1]) % 12;
    minutes = timeMatch[2] ? Number(timeMatch[2]) : 0;
    if (/p/i.test(timeMatch[3])) hours += 12;
  }
  const d = new Date(year, month, day, hours, minutes);
  if (Number.isNaN(d.getTime())) return null;
  return { date: d, allDay };
}

function pad(n) { return String(n).padStart(2, '0'); }
// Local "YYYY-MM-DDTHH:mm" (or plain "YYYY-MM-DD" for all-day) -- the same
// shape EventsScreen's own EventDialog inputs use, so a parsed date can
// drop straight into that dialog's fields with no extra conversion.
function toLocalInputValue(date, allDay) {
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return allDay ? datePart : `${datePart}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Builds a starting draft for `targetKind`, pre-filled from whatever
// `sourceKind`/`sourceRow` already has (directly for structured fields like
// an event's own location, via parseDateTimeFromText for free-text ones),
// plus the list of required fields it could NOT fill in -- the caller only
// needs to show a dialog at all when `missing.length > 0`.
export function buildCrossCreateDraft(sourceKind, sourceRow, targetKind) {
  if (targetKind === 'event') {
    const text = sourceKind === 'event' ? '' : `${sourceRow.title || sourceRow.name || ''} ${sourceRow.excerpt || sourceRow.description || ''}`;
    const parsed = parseDateTimeFromText(text);
    const draft = {
      title: sourceRow.title || sourceRow.name || '',
      description: sourceRow.excerpt || sourceRow.description || '',
      location: sourceRow.location || '',
      all_day: parsed ? parsed.allDay : true,
      start_at: parsed ? toLocalInputValue(parsed.date, parsed.allDay) : '',
      end_at: '',
      status: 'draft',
    };
    return { draft, missing: draft.start_at ? [] : ['start_at'] };
  }
  if (targetKind === 'announcement') {
    const when = sourceKind === 'event' && sourceRow.start_at
      ? new Date(sourceRow.start_at).toLocaleString(undefined, sourceRow.all_day
        ? { month: 'long', day: 'numeric', year: 'numeric' }
        : { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '';
    const subheading = sourceKind === 'event'
      ? (sourceRow.location ? `${when} · ${sourceRow.location}` : when)
      : '';
    const title = sourceRow.title || sourceRow.name || '';
    const draft = {
      title, excerpt: subheading, heroHeading: title, heroSubheading: subheading, status: 'draft',
      unpublish_at: sourceKind === 'event' ? (sourceRow.end_at || sourceRow.start_at) : undefined,
    };
    // Every field an announcement needs has a sensible default (worst case,
    // an empty subheading) -- nothing here is ever hard-required, so this
    // direction never needs to interrupt with a dialog.
    return { draft, missing: [] };
  }
  if (targetKind === 'album') {
    const title = sourceRow.title || sourceRow.name || '';
    const draft = { name: `${title} Photos`, status: 'draft' };
    return { draft, missing: [] };
  }
  throw new Error(`Unknown cross-create target: ${targetKind}`);
}

// Creates the target row, links it back to the source via content_links
// (the same generic table LinkedContentPanel reads from either side), and
// returns where the admin should land next -- the event list has no
// dedicated per-event page, so that one just reports "done" and lets the
// caller re-fetch its own list instead of navigating away.
export async function createCrossLinkedItem(sourceKind, sourceId, targetKind, draft) {
  if (targetKind === 'event') {
    const patch = {
      title: draft.title.trim(),
      description: draft.description || null,
      location: draft.location || null,
      start_at: draft.all_day ? new Date(`${draft.start_at}T00:00`).toISOString() : new Date(draft.start_at).toISOString(),
      end_at: draft.end_at ? (draft.all_day ? new Date(`${draft.end_at}T00:00`).toISOString() : new Date(draft.end_at).toISOString()) : null,
      all_day: draft.all_day,
      status: 'draft',
    };
    const { data: event } = await supabaseBrowser.from('calendar_events').insert(patch).select().single();
    if (!event) return null;
    await linkContent(sourceKind, sourceId, 'event', event.id);
    return { redirect: null };
  }
  if (targetKind === 'announcement') {
    const slug = await uniqueSlug('blog_posts', slugify(draft.title));
    const { data: post } = await supabaseBrowser.from('blog_posts').insert({
      slug, title: draft.title, excerpt: draft.excerpt, status: 'draft',
      draft_blocks: [{
        id: crypto.randomUUID(), type: 'hero',
        props: { heading: draft.heroHeading, subheading: draft.heroSubheading, align: 'center', background: 'none', headingSize: 'normal', overlayOpacity: 'medium', textColor: 'auto' },
      }],
      unpublish_at: sourceKind === 'event' ? (draft.unpublish_at || null) : null,
    }).select().single();
    if (!post) return null;
    await linkContent(sourceKind, sourceId, 'announcement', post.id);
    return { redirect: `/admin/posts/edit?slug=${post.slug}${sourceKind === 'event' ? '&schedule=1' : ''}` };
  }
  if (targetKind === 'album') {
    const { data: album } = await supabaseBrowser.from('gallery_albums').insert({
      name: draft.name, status: 'draft', sort_order: 0,
    }).select().single();
    if (!album) return null;
    await linkContent(sourceKind, sourceId, 'album', album.id);
    return { redirect: `/admin/gallery?album=${album.id}` };
  }
  throw new Error(`Unknown cross-create target: ${targetKind}`);
}
