import { describe, it, expect } from 'vitest';
import { classify, detectInHtml, linkifyHtml, findUnlinked, applyLinks } from './linkDetect.js';

describe('detectInHtml / linkifyHtml', () => {
  it('finds a phone, an email and a url in plain paragraphs', () => {
    const f = detectInHtml('<p>Call (801) 555-0100 or mail a@b.org, see https://alta.org/x.</p>');
    expect(f.map((m) => [m.kind, m.text])).toEqual([['phone', '(801) 555-0100'], ['email', 'a@b.org'], ['url', 'https://alta.org/x']]);
  });
  it('ignores anything already inside a link', () => {
    expect(detectInHtml('<p><a href="tel:8015550100">801-555-0100</a> and <a href="mailto:a@b.org">a@b.org</a></p>')).toEqual([]);
  });
  it('links the text and keeps the rest', () => {
    expect(linkifyHtml('<p>Mail a@b.org now</p>')).toBe('<p>Mail <a href="mailto:a@b.org">a@b.org</a> now</p>');
    expect(linkifyHtml('<p>801-555-0100</p>')).toBe('<p><a href="tel:8015550100">801-555-0100</a></p>');
    expect(linkifyHtml('<p>www.alta.org.</p>')).toBe('<p><a href="https://www.alta.org" target="_blank" rel="noopener noreferrer">www.alta.org</a>.</p>');
  });
  it('can link only chosen occurrences', () => {
    expect(linkifyHtml('<p>a@b.org and c@d.org</p>', (i) => i === 1)).toBe('<p>a@b.org and <a href="mailto:c@d.org">c@d.org</a></p>');
  });
  it('classify', () => expect(classify('hello')).toBeNull());
});

describe('findUnlinked / applyLinks', () => {
  const blocks = [
    { id: 'r', type: 'rich-text', props: { content: '<p>Email office@alta.org</p>' } },
    { id: 'b', type: 'button', props: { label: '801-555-0100', href: '' } },
    { id: 'b2', type: 'button', props: { label: '801-555-0100', href: '/already' } },
    { id: 'c', type: 'columns', props: { columns: [{ id: 'x', type: 'rich-text', props: { content: 'Visit https://alta.org' } }] } },
  ];
  it('finds rich text, empty-link buttons and nested blocks, but not linked buttons', () => {
    const f = findUnlinked(blocks);
    expect(f.map((s) => [s.blockLabel, s.kind, s.where])).toEqual([['Text', 'email', 'rich'], ['Button / CTA', 'phone', 'button'], ['Text', 'url', 'rich']]);
  });
  it('applies only the accepted ones, immutably', () => {
    const f = findUnlinked(blocks);
    const out = applyLinks(blocks, f, new Set([f[0].id, f[1].id, f[2].id]));
    expect(out[0].props.content).toContain('<a href="mailto:office@alta.org">');
    expect(out[1].props.href).toBe('tel:8015550100');
    expect(out[3].props.columns[0].props.content).toContain('<a href="https://alta.org"');
    expect(blocks[0].props.content).toBe('<p>Email office@alta.org</p>');
    const some = applyLinks(blocks, f, new Set([f[1].id]));
    expect(some[0]).toBe(blocks[0]);
  });
  it('is quiet when there is nothing to suggest', () => expect(findUnlinked([{ id: 'h', type: 'hero', props: { heading: 'Call 801-555-0100' } }])).toEqual([]));
});
