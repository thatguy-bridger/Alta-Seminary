import { supabaseBrowser } from '../lib/supabase/browser-client';
import { withBase } from '../lib/url.js';

// Where a teaser block actually points is mostly at a KIND/ALBUM/"recent N",
// not one specific item -- calendar_events and blog_posts have no per-item
// reference in a teaser block's props at all (events-teaser just shows
// "upcoming"/"all" events, posts-teaser just shows the N most recent posts),
// so "used on" below is scoped to what's actually true: which pages/
// announcements contain a block that would show this KIND of content, not a
// (non-existent) link to one specific event/post.
//
// Walks every page's/post's OWN draft_blocks -- the in-progress version, so
// a block an admin just added shows up here immediately, before they've
// even published -- including blocks nested inside a carousel slide or
// columns block, since those can carry a directory-teaser/events-teaser/etc
// same as a top-level block can.
function walkBlocks(blocks, visit) {
  for (const block of blocks || []) {
    if (!block || typeof block !== 'object') continue;
    visit(block);
    if (block.type === 'carousel') walkBlocks((block.props?.items || []).filter((it) => it?.type), visit);
    if (block.type === 'columns') walkBlocks((block.props?.columns || []).filter((c) => c?.type), visit);
  }
}

async function fetchContentRows() {
  const [{ data: pages }, { data: posts }] = await Promise.all([
    supabaseBrowser.from('pages').select('id, title, slug, route_path, page_kind, draft_blocks'),
    supabaseBrowser.from('blog_posts').select('id, title, slug, draft_blocks'),
  ]);
  return [
    ...(pages || []).map((p) => ({
      key: `page-${p.id}`, title: p.title,
      href: withBase(p.page_kind === 'builder' ? `/admin/pages/edit?slug=${p.slug}` : '/admin'),
      draft_blocks: p.draft_blocks,
    })),
    ...(posts || []).map((p) => ({
      key: `post-${p.id}`, title: p.title,
      href: withBase(`/admin/posts/edit?slug=${p.slug}`),
      draft_blocks: p.draft_blocks,
    })),
  ];
}

// predicate(block) -> true if this block counts as "using" the thing being
// looked up. Returns [{key, title, href}] for every page/post with at least
// one matching block, title-sorted -- used by DirectoryScreen.jsx (per
// kind), GalleryScreen.jsx (per album), EventsScreen.jsx and
// PostsListScreen.jsx (both generic, see the comment above).
export async function findPagesUsingBlock(predicate) {
  const rows = await fetchContentRows();
  const matches = [];
  for (const row of rows) {
    let used = false;
    walkBlocks(row.draft_blocks, (block) => { if (predicate(block)) used = true; });
    if (used) matches.push({ key: row.key, title: row.title, href: row.href });
  }
  return matches.sort((a, b) => a.title.localeCompare(b.title));
}

// Unlike findPagesUsingBlock (one row per PAGE), this returns one row per
// BLOCK INSTANCE -- for the two "announcement" block types that aren't
// backed by their own database table (Announcement Banner, Timed Popup):
// they're just props sitting on whatever page an admin dropped them on,
// with no list view of their own anywhere. PostsListScreen.jsx surfaces
// them here, next to the real (blog_posts-backed) announcements, so all
// three "kinds of announcement" are visible from one place -- editing one
// still happens on its actual page (blockPath below), there's no separate
// edit UI for it.
export async function findBlockInstances(types) {
  const rows = await fetchContentRows();
  const instances = [];
  for (const row of rows) {
    let i = 0;
    walkBlocks(row.draft_blocks, (block) => {
      if (types.includes(block.type)) {
        instances.push({ key: `${row.key}-${block.id || i++}`, pageTitle: row.title, pageHref: row.href, block });
      }
    });
  }
  return instances.sort((a, b) => a.pageTitle.localeCompare(b.pageTitle));
}
