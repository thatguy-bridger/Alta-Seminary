// "Elder Test · April 2026 general conference": who it is by and where it is from, without saying the name twice
// (a talk's reference usually already starts with the speaker's name).
export function byline(lesson) {
  const author = String(lesson?.author || '').trim();
  const reference = String(lesson?.reference || '').trim();
  if (author && reference && reference.toLowerCase().includes(author.toLowerCase())) return reference;
  return [author, reference].filter(Boolean).join(' · ');
}
