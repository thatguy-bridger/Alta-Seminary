import { weekLabel } from './weeks.js';

// "Elder Test · April 2026 general conference": who it is by and where it is from, without saying the name twice
// (a talk's reference usually already starts with the speaker's name). A Come, Follow Me lesson says which week it is for:
// "January 5–11 · Moses 1; Abraham 3".
export function byline(lesson) {
  const author = String(lesson?.author || '').trim();
  const reference = String(lesson?.reference || '').trim();
  const week = weekLabel(lesson);
  if (week) return [week, reference].filter(Boolean).join(' · ');
  if (author && reference && reference.toLowerCase().includes(author.toLowerCase())) return reference;
  return [author, reference].filter(Boolean).join(' · ');
}
