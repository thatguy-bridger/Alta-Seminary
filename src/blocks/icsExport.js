// Minimal RFC 5545 .ics builder -- just enough for calendar_events (title,
// description, location, start/end, all_day). No recurrence, no timezone
// database, since none of that exists in the schema to export.

function escapeText(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toIcsDate(iso, allDay) {
  const d = new Date(iso);
  if (allDay) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  }
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function eventToVEvent(event) {
  const start = toIcsDate(event.start_at, event.all_day);
  // A calendar with no explicit end renders as a zero-duration event in most
  // apps -- default to +1 day (all-day) or +1 hour (timed) so it's visible.
  const end = event.end_at
    ? toIcsDate(event.end_at, event.all_day)
    : event.all_day
      ? toIcsDate(new Date(new Date(event.start_at).getTime() + 86400000).toISOString(), true)
      : toIcsDate(new Date(new Date(event.start_at).getTime() + 3600000).toISOString(), false);
  const dateKey = event.all_day ? 'DATE' : 'DATE-TIME';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.id}@altaseminary`,
    `DTSTAMP:${stamp}`,
    event.all_day ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
    event.all_day ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  lines.push('END:VEVENT');
  return lines;
}

export function buildIcs(events) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Alta Seminary//Events//EN', 'CALSCALE:GREGORIAN'];
  for (const event of events) lines.push(...eventToVEvent(event));
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(events, filename) {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
