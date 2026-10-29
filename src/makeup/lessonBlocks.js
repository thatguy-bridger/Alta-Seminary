// The text of a "structured" lesson (Come, Follow Me): paragraphs plus headings, a label above a heading, lists and notes. It is
// kept as plain text in the lesson's body, a block at a time with a blank line between blocks, and a block's first characters say
// what it is, so an admin can read and edit it without any tool:
//
//   # A section title          a big heading (the Church's "Ideas for Learning at Home and at Church")
//   @ Moses 1                  a small label above the heading that follows it
//   ## A heading               a heading
//   - one item                 a list: every line of the block starts with "- "
//   - another item
//   > See also ...             a note (a "see also", or the title of a video to find in the Gospel Library)
//   anything else              a paragraph
//
// Only lessons of a structured kind are read this way. Every other lesson is plain paragraphs, exactly as before, so a talk that
// happens to start a line with "-" is never turned into a list.
//
// Pause questions are placed "after paragraph N". In a structured lesson N counts what is read (paragraphs, lists and notes), not
// headings or labels, which belong to what follows them.

export const STRUCTURED_KINDS = ['comefollowme'];
export const isStructured = (kind) => STRUCTURED_KINDS.includes(kind);

const clean = (s) => s.replace(/\s+/g, ' ').trim();

// -> [{ type: 'section' | 'kicker' | 'heading' | 'list' | 'note' | 'paragraph', text?, items?, unit }]
// `unit` numbers the blocks a pause question can follow (1, 2, 3, ...); headings and labels have none.
export function parseBlocks(body) {
  const text = String(body || '').replace(/\r/g, '').trim();
  if (!text) return [];
  const blocks = [];
  let unit = 0;
  for (const raw of text.split(/\n{2,}/)) {
    const block = raw.trim();
    if (!block) continue;
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const first = lines[0];
    if (/^#\s+\S/.test(first) && !/^##/.test(first)) blocks.push({ type: 'section', text: clean(lines.join(' ').replace(/^#\s+/, '')), unit: null });
    else if (/^##\s+\S/.test(first)) blocks.push({ type: 'heading', text: clean(lines.join(' ').replace(/^##\s+/, '')), unit: null });
    else if (/^@\s+\S/.test(first)) blocks.push({ type: 'kicker', text: clean(lines.join(' ').replace(/^@\s+/, '')), unit: null });
    else if (lines.every((l) => /^-\s+\S/.test(l))) blocks.push({ type: 'list', items: lines.map((l) => clean(l.replace(/^-\s+/, ''))), unit: ++unit });
    else if (/^>\s*\S/.test(first)) blocks.push({ type: 'note', text: clean(lines.map((l) => l.replace(/^>\s*/, '')).join(' ')), unit: ++unit });
    else blocks.push({ type: 'paragraph', text: clean(lines.join(' ')), unit: ++unit });
  }
  return blocks;
}

// What is read, one string per place a pause question can follow.
export const readableUnits = (body) => parseBlocks(body).filter((b) => b.unit !== null).map((b) => (b.type === 'list' ? b.items.join('\n') : b.text));

// All the words a student reads, without the markup, for working out how long a lesson takes.
export const readableText = (body) => parseBlocks(body).map((b) => (b.type === 'list' ? b.items.join(' ') : b.text)).join('\n\n');
