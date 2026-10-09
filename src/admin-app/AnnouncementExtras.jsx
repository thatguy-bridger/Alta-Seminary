import React from 'react';
import { Button } from '../design-system/components/forms/Button.jsx';
import { findBlockInstances } from './blockUsage.js';
import { htmlToPlainText } from '../lib/richTextHtml.js';

// The other two "kinds of announcement" on this site -- Announcement Banner
// and Timed Popup ("one-time") blocks -- aren't blog_posts at all, just props
// sitting on whatever page an admin dropped them on, so they can't live in
// the main Content list (nothing to create or delete here). Shown beneath
// the announcements instead, sorted by which page they're on -- same tab
// pattern as the Directories screen, which sorts by directory.
export function AnnouncementExtras() {
  const [banners, setBanners] = React.useState(null);
  const [popups, setPopups] = React.useState(null);
  const [activePage, setActivePage] = React.useState('all');

  React.useEffect(() => {
    findBlockInstances(['announcement-banner']).then(setBanners);
    findBlockInstances(['timed-popup']).then(setPopups);
  }, []);

  // Tabs: every page with at least one banner OR popup, deduped by href
  // since a page can have both.
  const pages = [];
  const seen = new Set();
  for (const inst of [...(banners || []), ...(popups || [])]) {
    if (seen.has(inst.pageHref)) continue;
    seen.add(inst.pageHref);
    pages.push({ href: inst.pageHref, title: inst.pageTitle });
  }
  pages.sort((a, b) => a.title.localeCompare(b.title));
  const inPage = (list) => (activePage === 'all' ? list : (list || []).filter((i) => i.pageHref === activePage));

  return (
    <section style={{ marginTop: 'var(--space-8)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', margin: '0 0 var(--space-2)' }}>Banners &amp; popups</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)', marginTop: 0, marginBottom: 'var(--space-4)' }}>
        Banner and Timed Popup announcements aren't posts -- they're blocks dropped on a page, so they're edited on that page. Sorted by which page they're on.
      </p>

      {banners !== null && popups !== null && pages.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <button onClick={() => setActivePage('all')} className={'tab' + (activePage === 'all' ? ' active' : '')}>All pages</button>
          {pages.map((p) => (
            <button key={p.href} onClick={() => setActivePage(p.href)} className={'tab' + (activePage === p.href ? ' active' : '')}>{p.title}</button>
          ))}
        </div>
      )}

      <h4 style={subheading}>
        Banner announcements <span style={subheadingNote}>-- a dismissible bar</span>
      </h4>
      <BlockInstanceList
        instances={inPage(banners)}
        emptyLabel={activePage === 'all' ? 'No banner announcements on any page.' : 'No banner announcement on this page.'}
        preview={(block) => block.props?.message}
      />

      <h4 style={{ ...subheading, marginTop: 'var(--space-6)' }}>
        One-time announcements <span style={subheadingNote}>-- a modal popup, shown once per visitor by default</span>
      </h4>
      <BlockInstanceList
        instances={inPage(popups)}
        emptyLabel={activePage === 'all' ? 'No one-time announcements on any page.' : 'No one-time announcement on this page.'}
        preview={(block) => block.props?.heading || block.props?.message}
      />
    </section>
  );
}

const subheading = { fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-secondary)', margin: '0 0 var(--space-2)' };
const subheadingNote = { color: 'var(--text-muted)', fontWeight: 'var(--fw-regular)' };

// There's no separate edit UI for a block instance's props (message/heading/
// etc) -- editing happens on the page it lives on, same as clicking any other
// block on the canvas, so "Edit" here just navigates there.
function BlockInstanceList({ instances, emptyLabel, preview }) {
  if (instances === null) return <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-small)' }}>Loading…</p>;
  if (instances.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>{emptyLabel}</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {instances.map((inst) => (
        <div
          key={inst.key}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>
              {htmlToPlainText(preview(inst.block)) || <span style={{ color: 'var(--text-muted)', fontWeight: 'var(--fw-regular)' }}>(empty)</span>}
            </div>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>on {inst.pageTitle}</span>
          </div>
          <a href={inst.pageHref} style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="sm">Edit</Button>
          </a>
        </div>
      ))}
    </div>
  );
}
