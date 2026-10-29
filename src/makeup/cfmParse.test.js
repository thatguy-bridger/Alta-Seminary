import { describe, it, expect } from 'vitest';
import { parseHtml, textOf, decode, parseWeekTitle, lessonFromChurchPage, courseFromManual, weeklySlugs } from './cfmParse.js';
import { parseBlocks } from './lessonBlocks.js';

const FILLER = 'This is a sentence of the lesson that is here so that the lesson is long enough to look real. '.repeat(8);

// A page shaped like the Church's: the reference lines and header first, then the lesson, then the pages to print.
const PAGE_HTML = `
<p class="reference" id="reference1">“January 5–11. ‘This Is My Work and My Glory’: Moses 1; Abraham 3,” <cite>Come, Follow Me</cite></p>
<p class="short-reference" id="short_reference1">“January 5–11,” <cite>Come, Follow Me: 2026</cite></p>
<header>
<img alt="stars" id="img1" src="https://example.org/a.jpg" />
<p class="title-number" id="title_number1">January 5–11: “This Is My Work and My Glory”</p>
<h1 id="title1"><a class="scripture-ref" href="/study/scriptures/pgp/moses/1?lang=eng">Moses 1</a>; <a class="scripture-ref" href="/x">Abraham 3</a></h1>
</header>
<div class="body-block">
<p id="p1">The Bible begins with the words “in the beginning” (<a class="scripture-ref" href="/y">Genesis 1:1</a>). But what was there <em>before</em> this? Faith&nbsp;&amp; works&#8217; reward. ${FILLER}</p>
<p id="p2">A second opening paragraph.<br/>It has a line break. ${FILLER}</p>
<section>
<header><img alt="study icon" class="icon" src="https://example.org/i.png"/><h2 id="h2a">Ideas for Learning at Home and at Church</h2></header>
<section>
<header>
<p class="scripture-title">Moses 1</p>
<h3>As a child of God, I have a divine destiny.</h3>
<img alt="seminary icon" class="icon" src="https://example.org/s.png"/>
</header>
<p>“If the Lord were speaking to you directly,” President Nelson taught. <a class="cross-ref" href="/z">Read more</a></p>
<a class="cross-ref" href="/z">A link on its own</a>
<p>See also “I Am a Child of God,” <i>Hymns</i>, no. 301.</p>
<figure class="video" id="figure1"><video preload="none" data-video-title="Our True Identity" data-duration-string="3:39" data-video-id="1"><source src="https://example.org/v.m3u8" type="application/vnd.apple.mpegurl"/></video><figcaption><header><p class="title">Our True Identity</p></header></figcaption></figure>
<figure class="for-teacher" id="figure2"><p>Learning at home can be planned but also spontaneous.</p></figure>
<figure class="image no-print"><img alt="a painting" src="https://example.org/p.jpg"/><figcaption><p>A painting caption</p></figcaption></figure>
</section>
<section>
<header><p class="scripture-title">Moses 1:12–26</p><h3>I can resist Satan.</h3></header>
<table class="vertical-axis"><thead><tr><th><p class="label">Symbol</p></th><th><p class="label">Possible meanings</p></th><th><p class="label">My message</p></th></tr></thead>
<tbody>
<tr><td><div class="card-label"><p class="label">Symbol</p></div><p><i>The lamb</i> (verses 3–5).</p></td><td><div class="card-label"><p class="label">Possible meanings</p></div><p>See John 1:29.</p></td><td></td></tr>
<tr><td></td><td></td><td></td></tr>
</tbody></table>
<ul class="bullet"><li><p>First thing to try.</p></li><li><p>Second <a href="/q">thing</a> to try.</p></li></ul>
</section>
<section>
<header><h3>Scripture Helps</h3></header>
<ul class="no-marker"><li><p><a class="cross-ref" href="/h1">What is the book of Moses?</a></p></li><li><p><a class="cross-ref" href="/h2">What is the book of Abraham?</a></p></li></ul>
<p><a class="cross-ref" href="/more">Click to see more.</a></p>
</section>
</section>
<section>
<header><img alt="children" class="icon" src="https://example.org/c.png"/><h2>Ideas for Teaching Children</h2></header>
<section><header><p class="scripture-title">Moses 1:1–4</p><h3>I am a child of God.</h3></header><ul class="bullet"><li><p>Let your children look at their reflection in a mirror.</p></li></ul></section>
</section>
<a class="cross-ref" href="/end">An ending link</a>
<img alt="banner" src="https://example.org/banner.png"/>
<div class="resources"><figure class="handout"><p>Primary activity page</p></figure></div>
</div>`;
const PAGE = { meta: { title: 'January 5–11. “This Is My Work and My Glory”: Moses 1; Abraham 3', ogTagImageUrl: 'https://www.churchofjesuschrist.org/imgs/abc/full/%21500%2C/0/default' }, content: { body: PAGE_HTML } };
const COURSE = { slug: 'come-follow-me-for-home-and-church-old-testament-2026', year: 2026, name: 'Come, Follow Me: Old Testament 2026' };
const convert = (page = PAGE, over = {}) => lessonFromChurchPage(page, { slug: '02', number: 2, course: COURSE, ...over });

describe('reading the Church\'s HTML', () => {
  it('turns entities into the characters they stand for, and leaves what it does not know alone', () => {
    expect(decode('Faith&nbsp;&amp; works &#8217;s &#x2019; &lt;b&gt; &quot;q&quot; &hellip; &bogus; &#0; &#99999999;')).toBe('Faith & works ’s ’ <b> "q" … &bogus; &#0; &#99999999;');
  });

  it('builds a tree from tags, attributes, void tags, self-closing tags and comments', () => {
    const tree = parseHtml('<!-- note --><div class="a b" data-x=\'1\'><p>One<br>two <img src="x.png" alt="a > b"/> three</p><input disabled></div>');
    const div = tree.children[0];
    expect(div).toMatchObject({ tag: 'div', attrs: { class: 'a b', 'data-x': '1' } });
    expect(div.children.map((c) => c.tag)).toEqual(['p', 'input']);
    expect(div.children[0].children.find((c) => c.tag === 'img').attrs.alt).toBe('a > b');
    expect(textOf(div)).toBe('One two  three');
  });

  it('copes with a stray closing tag and an unclosed one', () => {
    expect(textOf(parseHtml('<p>one</span></p><p>two'))).toBe('onetwo');
  });

  it('does not read scripts, styles or a chart\'s repeated column names as text', () => {
    expect(textOf(parseHtml('<p>a<script>alert(1)</script><style>p{}</style><div class="card-label">Symbol</div>b</p>'))).toBe('ab');
  });
});

describe('the dates of a week', () => {
  const at = (text, number = 5, year = 2026) => parseWeekTitle(text, { year, number });

  it('reads a week within a month, across a month, and with the title after it', () => {
    expect(at('January 5–11: “Title”')).toEqual({ week_start: '2026-01-05', week_end: '2026-01-11', rest: '“Title”' });
    expect(at('August 31–September 6: Title')).toEqual({ week_start: '2026-08-31', week_end: '2026-09-06', rest: 'Title' });
    expect(at('June 8–14')).toEqual({ week_start: '2026-06-08', week_end: '2026-06-14', rest: '' });
    expect(at('March 30–April 5 : Easter')).toMatchObject({ week_start: '2026-03-30', week_end: '2026-04-05', rest: 'Easter' });
  });

  it('puts the first week of a course in December of the year before, and the end of it in January', () => {
    expect(at('December 29–January 4: First', 1)).toEqual({ week_start: '2025-12-29', week_end: '2026-01-04', rest: 'First' });
    expect(at('December 21–27: Christmas', 52)).toEqual({ week_start: '2026-12-21', week_end: '2026-12-27', rest: 'Christmas' });
  });

  it('is nothing for text that is not a week', () => {
    for (const bad of ['', 'Introduction', 'Febtober 5–11: x', 'January fifth: x', null]) expect(at(bad), String(bad)).toBeNull();
  });
});

describe('a whole lesson', () => {
  const row = convert();
  const blocks = parseBlocks(row.body);

  it('has the Church\'s title, subtitle, week, picture and address', () => {
    expect(row).toMatchObject({
      kind: 'comefollowme', title: '“This Is My Work and My Glory”', reference: 'Moses 1; Abraham 3', series: 'Come, Follow Me: Old Testament 2026',
      week_start: '2026-01-05', week_end: '2026-01-11', thumbnail_url: 'https://www.churchofjesuschrist.org/imgs/abc/full/%21500%2C/0/default',
      origin_url: 'https://www.churchofjesuschrist.org/study/manual/come-follow-me-for-home-and-church-old-testament-2026/02?lang=eng', sort_order: 70020,
      active: true, one_time: false, show_images: false,
    });
  });

  it('keeps the Church\'s order: introduction, the section, each idea under its label and heading, the helps', () => {
    expect(blocks.filter((b) => b.type !== 'paragraph').map((b) => `${b.type}:${b.text || b.items.join('|')}`)).toEqual([
      'section:Ideas for Learning at Home and at Church',
      'kicker:Moses 1', 'heading:As a child of God, I have a divine destiny.',
      'note:See also “I Am a Child of God,” Hymns, no. 301.', 'note:Video: Our True Identity (3:39)',
      'kicker:Moses 1:12–26', 'heading:I can resist Satan.',
      'note:Chart: Symbol · Possible meanings · My message', 'list:Symbol: The lamb (verses 3–5). — Possible meanings: See John 1:29.', 'list:First thing to try.|Second thing to try.',
      'heading:Scripture Helps', 'list:What is the book of Moses?|What is the book of Abraham?',
    ]);
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[1].type).toBe('paragraph');
  });

  it('keeps the words as they are: entities decoded, line breaks as spaces, links as their text', () => {
    expect(blocks[0].text).toContain('Faith & works’ reward.');
    expect(blocks[0].text).toContain('(Genesis 1:1)');
    expect(blocks[1].text).toContain('A second opening paragraph. It has a line break.');
    expect(blocks.find((b) => b.text?.startsWith('“If the Lord')).text).toBe('“If the Lord were speaking to you directly,” President Nelson taught. Read more');
  });

  it('leaves out what is not for a student studying: the children\'s section, teacher tips, pictures, printable pages, web-only hints', () => {
    for (const gone of ['Teaching Children', 'mirror', 'Learning at home can be planned', 'A painting caption', 'Primary activity', 'Click to see more', 'An ending link', 'A link on its own', 'January 5–11']) {
      expect(row.body, gone).not.toContain(gone);
    }
  });

  it('leaves no markup, no entities and no empty blocks', () => {
    expect(row.body).not.toMatch(/<[a-z/]|&[a-z#0-9]+;/i);
    expect(row.body.split(/\n{2,}/).every((b) => b.trim().length > 1)).toBe(true);
  });

  it('works out how long it takes from the words a student reads, not the marks', () => {
    expect(row.words).toBeGreaterThan(100);
    expect(row.minutes).toBe(Math.max(3, Math.ceil(row.words / 150)));
  });

  it('shows no picture to students until an admin turns pictures on, and uses the Church\'s own picture only when it is a web address', () => {
    expect(row.show_images).toBe(false);
    expect(convert({ ...PAGE, meta: { ...PAGE.meta, ogTagImageUrl: '' } }).thumbnail_url).toBeNull();
    expect(convert({ ...PAGE, meta: { ...PAGE.meta, ogTagImageUrl: 'javascript:alert(1)' } }).thumbnail_url).toBeNull();
    expect(convert({ content: PAGE.content }).thumbnail_url).toBeNull();
  });

  it('puts each course after the one before it', () => {
    expect(convert(PAGE, { sortBase: 71000 }).sort_order).toBe(71020);
  });

  it('says plainly what is wrong rather than saving something wrong', () => {
    expect(() => convert({ meta: {}, content: {} })).toThrow(/no content/);
    expect(() => convert({ content: { body: '<p class="title-number">Introduction</p><div class="body-block"><p>x</p></div>' } })).toThrow(/dates of the week|could not read the week/);
    expect(() => convert({ content: { body: PAGE_HTML.replace('class="body-block"', 'class="other"') } })).toThrow(/no lesson text/);
    expect(() => convert({ content: { body: '<p class="title-number">January 5–11: A title</p><div class="body-block"><p>Only a few words here.</p></div>' } })).toThrow(/too few/);
  });
});

describe('charts', () => {
  const chartOf = (html) => convert({ content: { body: PAGE_HTML.replace(/<table[\s\S]*<\/table>/, html) } }).body;

  it('keeps a chart with no header as plain rows', () => {
    const body = chartOf('<table><tbody><tr><td><p>One</p></td><td><p>Two</p></td></tr><tr><td><p>Three</p></td><td></td></tr></tbody></table>');
    expect(body).toContain('- One — Two\n- Three');
    expect(body).not.toContain('Chart:');
  });

  it('drops rows that are all blank (the spaces a student fills in)', () => {
    expect(chartOf('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td></td><td></td></tr></tbody></table>')).toContain('> Chart: A · B');
    expect(chartOf('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td></td><td></td></tr></tbody></table>')).not.toMatch(/^- $/m);
  });

  it('names each filled cell by its column only when the columns line up', () => {
    expect(chartOf('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>x</td><td>y</td></tr></tbody></table>')).toContain('- A: x — B: y');
    expect(chartOf('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>only one cell</td></tr></tbody></table>')).toContain('- only one cell');
  });
});

describe('finding a course and its weeks', () => {
  const MANUAL = { meta: { title: 'Come, Follow Me—For Home and Church: Old Testament 2026' }, content: { body: [
    '001-conversion', '004-old-testament-overview', '01-thoughts', '01', '02', '07-thoughts', '07', '52', '53-appendix-a', '02',
  ].map((s) => `<a href="/study/manual/${COURSE.slug}/${s}?lang=eng">x</a>`).join('') + `<a href="/study/manual/another-manual/03?lang=eng">x</a>` } };

  it('reads the course name and year from the manual\'s own title', () => {
    expect(courseFromManual(MANUAL, COURSE.slug)).toEqual(COURSE);
    expect(courseFromManual({ meta: { title: 'Come, Follow Me—For Home and Church: New Testament 2027' } }, 'x')).toMatchObject({ year: 2027, name: 'Come, Follow Me: New Testament 2027' });
    expect(() => courseFromManual({ meta: { title: 'No year here' } }, 'x')).toThrow(/year/);
    expect(() => courseFromManual({}, 'x')).toThrow();
  });

  it('lists only the numbered weekly lessons of that manual, once each, in order', () => {
    expect(weeklySlugs(MANUAL, COURSE.slug)).toEqual(['01', '02', '07', '52']);          // not the essays, the appendices, or another manual
    expect(weeklySlugs({}, COURSE.slug)).toEqual([]);
  });
});
