import React from 'react';
import { Dialog } from '../design-system/components/core/Dialog.jsx';
import { Input } from '../design-system/components/forms/Input.jsx';
import { Button } from '../design-system/components/forms/Button.jsx';
import { linkContent, unlinkContent, kindLabel, kindIcon } from './contentLinks.js';
import { loadContentIndex, relatedItems } from './contentIndex.js';
import { CROSS_CREATE_TARGETS, buildCrossCreateDraft, createCrossLinkedItem } from './crossCreate.js';
import { CrossCreateMissingFieldsDialog } from './CrossCreateMissingFieldsDialog.jsx';
import { withBase } from '../lib/url.js';

// ONE place to manage what an event / announcement / album is connected to,
// replacing the old stack of linked-item chips, a kind dropdown, an item
// dropdown, a "Link" button and a row of "+ Create & link a new X" shortcuts
// that every row used to carry. Three plain sections instead:
//   1. what's linked now (remove with one click),
//   2. add an existing item -- one search box across ALL kinds, not a
//      kind-then-item pair of dropdowns,
//   3. create a brand-new related item, prefilled from this one.
//
// Controlled: the parent owns `index` (see contentIndex.js) and reloads it via
// `onChanged` after every change, so the Content list's chips update
// underneath this dialog as it works.
export function RelatedContentDialog({ item, index, onChanged, onClose }) {
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [pending, setPending] = React.useState(null); // { targetKind, draft } when a create needs more info

  const linked = relatedItems(index, item);
  const linkedKeys = new Set(linked.map((l) => l.key));
  const q = query.trim().toLowerCase();
  const candidates = index.items
    .filter((i) => i.key !== item.key && !linkedKeys.has(i.key))
    .filter((i) => !q || i.title.toLowerCase().includes(q) || kindLabel(i.kind).toLowerCase().includes(q))
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, 8);

  async function run(fn) {
    setBusy(true);
    await fn();
    await onChanged();
    setBusy(false);
  }

  async function startCreate(targetKind) {
    const { draft, missing } = buildCrossCreateDraft(item.kind, item.raw, targetKind);
    if (missing.length) { setPending({ targetKind, draft }); return; }
    await finishCreate(targetKind, draft);
  }

  async function finishCreate(targetKind, draft) {
    setBusy(true);
    const result = await createCrossLinkedItem(item.kind, item.id, targetKind, draft);
    setPending(null);
    if (result?.redirect) { window.location.href = withBase(result.redirect); return; }
    await onChanged();
    setBusy(false);
  }

  return (
    <>
      {/* `wide`, and no min-width of its own: the dialog panel is capped (440px by
          default, less on a phone), and content that insists on a minimum wider
          than that doesn't fit -- the rows and buttons spilled out of the panel. */}
      <Dialog open wide title={`Related to “${item.title}”`} onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <Section title={`Linked (${linked.length})`}>
            {linked.length === 0 ? (
              <p style={mutedText}>Nothing linked yet. Link an existing item below, or create a new one.</p>
            ) : linked.map((l) => (
              <Row key={l.key} item={l}>
                <button onClick={() => run(() => unlinkContent(item.kind, item.id, l.kind, l.id))} disabled={busy} style={textButton}>Remove</button>
              </Row>
            ))}
          </Section>

          <Section title="Add an existing item">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events, announcements and albums…" aria-label="Search content to link" />
            {candidates.length === 0 ? (
              <p style={mutedText}>{index.items.length <= 1 ? 'There is nothing else to link to yet.' : 'No matches.'}</p>
            ) : candidates.map((c) => (
              <Row key={c.key} item={c}>
                <button onClick={() => run(() => linkContent(item.kind, item.id, c.kind, c.id))} disabled={busy} style={{ ...textButton, color: 'var(--text-link)' }}>Link</button>
              </Row>
            ))}
          </Section>

          <Section title="Or create a new one from this">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {CROSS_CREATE_TARGETS[item.kind].map((k) => (
                <Button key={k} variant="outline" size="sm" disabled={busy} onClick={() => startCreate(k)}>
                  + New {kindLabel(k)}
                </Button>
              ))}
            </div>
            <p style={mutedText}>Prefilled with this item's title and details, and linked automatically.</p>
          </Section>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      </Dialog>
      {pending && (
        <CrossCreateMissingFieldsDialog
          targetKind={pending.targetKind}
          initialDraft={pending.draft}
          saving={busy}
          onCancel={() => setPending(null)}
          onConfirm={(draft) => finishCreate(pending.targetKind, draft)}
        />
      )}
    </>
  );
}

// "🔗 Related" button that works anywhere -- loads the content index itself
// when opened, so a screen that doesn't already hold one (the album photo
// manager) can use the exact same dialog as the Content list.
export function RelatedContentButton({ kind, id, title, raw }) {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(null);

  async function reload() { setIndex(await loadContentIndex()); }
  async function openDialog() { setOpen(true); await reload(); }

  const item = index && index.items.find((i) => i.kind === kind && i.id === id);
  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog}>🔗 Related</Button>
      {open && index && (
        <RelatedContentDialog
          item={item || { key: `${kind}:${id}`, kind, id, title, raw }}
          index={index}
          onChanged={reload}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <h4 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</h4>
      {children}
    </section>
  );
}

function Row({ item, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
      <span aria-hidden>{kindIcon(item.kind)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>{kindLabel(item.kind)}</div>
      </div>
      {children}
    </div>
  );
}

const mutedText = { margin: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-muted)' };
const textButton = { flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-muted)', padding: 4 };
