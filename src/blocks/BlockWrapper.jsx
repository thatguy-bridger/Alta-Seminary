import React from 'react';
import { DEFAULT_LAYOUT } from './registry.js';
import { getScrollDirection } from './scrollDirection.js';

const SPACING_VAR = { none: '0', sm: 'var(--space-4)', md: 'var(--space-8)', lg: 'var(--space-16)', xl: 'var(--space-24)' };

// Universal per-block layout (spacing/contained/background) -- applied the same
// way whether rendering statically (Astro build, public site, Preview tab) or
// interactively (the admin edit canvas). See registry.js DEFAULT_LAYOUT/LAYOUT_FIELDS.
export function BlockWrapper({ layout, children, editable }) {
  const l = { ...DEFAULT_LAYOUT, ...layout };
  const background = l.background === 'sunken' ? 'var(--surface-sunken)' : l.background === 'inverse' ? 'var(--surface-inverse)' : undefined;
  const color = l.background === 'inverse' ? 'var(--text-on-inverse)' : undefined;
  const ref = React.useRef(null);
  const [revealed, setRevealed] = React.useState(false);
  const [revealDir, setRevealDir] = React.useState('down');

  // The "glide into view" reveal (.reveal-on-scroll/.is-visible CSS lives
  // in PublicLayout.astro, inert in the admin app -- same reasoning as
  // before) used to be a plain <script> in PublicLayout.astro that added
  // .is-visible directly to the DOM. That ran independently of, and often
  // BEFORE, this component's own hydration (BlockRenderer.jsx mounts as a
  // single client:visible island covering every block at once, so a block
  // further down the page can still be un-hydrated when it scrolls into
  // view) -- React then hydrated expecting the plain SSR className and
  // found the script's className already there instead, which is a real
  // hydration mismatch (visible as "Minified React error #418" in
  // production), not a cosmetic one. Owning the class toggle here, as
  // normal React state set only after mount, means the DOM the server sent
  // and what hydration expects are always identical -- this only ever
  // changes it afterward, which is just an ordinary update, not a mismatch.
  //
  // Unlike a typical one-shot scroll reveal, this never disconnects: a
  // block un-reveals (fades out) as it leaves the viewport in EITHER
  // direction and re-reveals the next time it re-enters, gliding in from
  // whichever side matches the scroll direction at that moment (down the
  // page -> rises up from below; back up the page -> drops in from above --
  // see scrollDirection.js) rather than always the same way regardless of
  // which way you're actually scrolling.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealDir(getScrollDirection());
          setRevealed(true);
        } else {
          setRevealed(false);
        }
      },
      { rootMargin: '0px 0px -80px 0px', threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      id={l.anchor || undefined}
      className={`reveal-on-scroll${revealed ? ' is-visible' : ''}`}
      data-reveal-dir={revealDir}
      style={{ padding: `${SPACING_VAR[l.spacing] || SPACING_VAR.md} 0`, background, color, scrollMarginTop: 'var(--space-16)' }}
    >
      {l.outboundWidth ? (
        // Breaks the WHOLE block out past whatever contains it, all the way
        // to the true browser viewport edge -- moved here from ImageBlock.jsx
        // (see registry.js's LAYOUT_FIELDS) so every block type gets it, not
        // just Image. A single div does both the full-bleed sizing AND the
        // clipping: it used to be tried as two nested divs (an outer
        // `width:100%` clip wrapper around an inner `100vw` one), but that
        // outer wrapper's "100%" resolves against ITS parent -- which, once
        // this sits inside a `contained` block or a parent column, is a
        // narrower centered box, not the real viewport -- so overflow:hidden
        // clipped the inner 100vw breakout right back down to that box,
        // silently undoing the whole point. One element doing both jobs
        // leaves nothing narrower in between to clip against. `contained`
        // above is ignored when this is on -- "break out to the edges" and
        // "stay in a narrow centered column" are mutually exclusive, and
        // outboundWidth is the more specific, deliberate choice of the two.
        //
        // Skipped in the admin's own edit canvas (`editable`): unlike the
        // Preview tab (a genuine iframe with its own viewport matching the
        // simulated device size, where 100vw is already correctly scoped)
        // and the public site, the edit canvas shares ONE real window with
        // the rest of the admin UI, so a true 100vw there would overlap the
        // Style panel sidebar instead of representing "the page."
        editable ? (
          <div>{children}</div>
        ) : (
          <div style={{ width: '100vw', maxWidth: '100vw', marginLeft: 'calc(50% - 50vw)', overflow: 'hidden' }}>
            {children}
          </div>
        )
      ) : (
        <div style={{ maxWidth: l.contained ? 640 : undefined, marginLeft: l.contained ? 'auto' : undefined, marginRight: l.contained ? 'auto' : undefined }}>
          {children}
        </div>
      )}
    </div>
  );
}
