import { describe, it, expect } from 'vitest';
import { isStructured, parseBlocks, readableUnits, readableText, STRUCTURED_KINDS } from './lessonBlocks.js';
import { splitParagraphs } from './pauses.js';

const BODY = [
  'An opening paragraph about faith.',
  '# Ideas for Learning',
  '@ Moses 1',
  '## I have a divine destiny.',
  'First idea paragraph.',
  '- a list item\n- another item',
  '> See also Hymns, no. 301.',
  'Last paragraph.',
].join('\n\n');

describe('which lessons are read as structured text', () => {
  it('is only Come, Follow Me: every other lesson stays plain paragraphs', () => {
    expect(STRUCTURED_KINDS).toEqual(['comefollowme']);
    expect(isStructured('comefollowme')).toBe(true);
    for (const k of ['scripture', 'talk', 'lesson', 'proclamation', 'video', 'audio', 'podcast', '', undefined]) expect(isStructured(k), String(k)).toBe(false);
  });
});

describe('the blocks of a structured lesson', () => {
  it('knows what each block is from how it begins', () => {
    expect(parseBlocks(BODY).map((b) => [b.type, b.unit])).toEqual([
      ['paragraph', 1], ['section', null], ['kicker', null], ['heading', null], ['paragraph', 2], ['list', 3], ['note', 4], ['paragraph', 5],
    ]);
  });

  it('keeps the words, without the marks', () => {
    const blocks = parseBlocks(BODY);
    expect(blocks[1].text).toBe('Ideas for Learning');
    expect(blocks[2].text).toBe('Moses 1');
    expect(blocks[3].text).toBe('I have a divine destiny.');
    expect(blocks[5].items).toEqual(['a list item', 'another item']);
    expect(blocks[6].text).toBe('See also Hymns, no. 301.');
  });

  it('counts only what is read when placing a question: headings and labels belong to what follows', () => {
    expect(readableUnits(BODY)).toEqual(['An opening paragraph about faith.', 'First idea paragraph.', 'a list item\nanother item', 'See also Hymns, no. 301.', 'Last paragraph.']);
    expect(splitParagraphs(BODY, 'comefollowme')).toHaveLength(5);                  // "after paragraph 5" is the last thing read
  });

  it('is not fooled by marks that are not at the start of a block, or are not followed by words', () => {
    const b = parseBlocks('A # in the middle.\n\n#nospace\n\n#\n\n- \n\nPlain 1 - 2 > 3 @ 4');
    expect(b.every((x) => x.type === 'paragraph')).toBe(true);
    expect(b).toHaveLength(5);
  });

  it('is a list only when every line is an item', () => {
    expect(parseBlocks('- one\n- two')[0].type).toBe('list');
    expect(parseBlocks('- one\nthen text')[0].type).toBe('paragraph');
    expect(parseBlocks('- one\nthen text')[0].text).toBe('- one then text');
  });

  it('joins the lines of one block, and tolerates odd spacing and line endings', () => {
    const b = parseBlocks('First line\r\nsecond line\r\n\r\n\r\n\r\n#   Spaced   out   heading  ');
    expect(b[0].text).toBe('First line second line');
    expect(b[1]).toMatchObject({ type: 'section', text: 'Spaced out heading' });
  });

  it('is empty for no text', () => {
    for (const nothing of ['', '   \n\n  ', null, undefined]) { expect(parseBlocks(nothing)).toEqual([]); expect(readableUnits(nothing)).toEqual([]); expect(readableText(nothing)).toBe(''); }
  });

  it('gives all the words a student reads, to work out how long it takes', () => {
    const words = readableText(BODY).split(/\s+/).filter(Boolean);
    expect(words).not.toContain('#');
    expect(words).not.toContain('@');
    expect(words).not.toContain('-');
    expect(words).not.toContain('>');
    expect(words).toContain('Moses');
    expect(words).toContain('another');
  });
});

describe('plain lessons are still counted the way they were', () => {
  it('splits on blank lines, or on line breaks when there are none, whatever the text looks like', () => {
    expect(splitParagraphs('One.\n\nTwo.\n\nThree.', 'talk')).toEqual(['One.', 'Two.', 'Three.']);
    expect(splitParagraphs('1 In the beginning\n2 And then', 'scripture')).toEqual(['1 In the beginning', '2 And then']);
    expect(splitParagraphs('# not a heading here\n\n- nor a list', 'talk')).toEqual(['# not a heading here', '- nor a list']);
    expect(splitParagraphs('# not a heading here\n\n- nor a list')).toEqual(['# not a heading here', '- nor a list']);   // no kind given
  });
});
