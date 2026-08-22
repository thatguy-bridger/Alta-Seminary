import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { EditableImage } from '../admin-app/builder/EditableImage.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';
import { AddBlockButton } from '../admin-app/builder/AddBlockButton.jsx';
import { BlockIcon } from '../admin-app/builder/blockIcons.jsx';
import { Select } from '../design-system/components/forms/Select.jsx';
import { BLOCK_REGISTRY, BLOCK_TYPES, isInlineField } from './registry.js';
// BlockRenderer.jsx imports CarouselBlock (it's one of the types in
// BLOCK_COMPONENTS), so this is a circular import -- safe here because
// BLOCK_COMPONENTS is only ever read lazily inside function bodies below
// (render time), never at module-evaluation time.
import { BLOCK_COMPONENTS } from './BlockRenderer.jsx';

const SPEED_MS = { slow: 5000, normal: 3000, fast: 1500 };

// Carousel slides all share one fixed shape (picked in the Style panel) so
// the slider has a consistent height regardless of which slide is showing.
function ratioToNumber(ratio) {
  const [w, h] = (ratio || '16:9').split(':').map(Number);
  return w / h;
}
function ratioToCss(ratio) {
  return (ratio || '16:9').replace(':', '/');
}

// A slide can either be the original "media" shape (an image with an
// optional heading/caption overlay -- the carousel's original and still
// most common use) or a full nested block of any other registered type
// (quote, rich text, button, embed, ...), so a slide is {id, type, props}.
// 'media' isn't a real BLOCK_REGISTRY entry -- it's carousel-only, rendered
// by MediaSlide/the inline image+heading+caption editor below. Nesting a
// carousel inside its own slide is excluded (see the "change slide type"
// picker below) since a slider-in-a-slider has no sensible UI.

// Pause/play glyphs -- hand-drawn to match the rest of the design system's icon style.
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z" /></svg>
);
const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><polyline points="15 18 9 12 15 6" /></svg>
);
const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><polyline points="9 18 15 12 9 6" /></svg>
);

function slidePropsForType(type) {
  if (type === 'media') return { image: '', heading: '', caption: '' };
  const def = BLOCK_REGISTRY[type];
  return def ? structuredClone(def.defaultProps) : {};
}

function newSlide() {
  return { id: crypto.randomUUID(), type: 'media', props: slidePropsForType('media') };
}

function truncateText(text, max = 140) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

function formatEventCaption(event) {
  const start = event.start_at ? new Date(event.start_at) : null;
  const dateStr = start ? start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  return [dateStr, event.location].filter(Boolean).join(' · ');
}

// Slides created before the {type, props} rewrite stored their image/heading/
// caption/headingStyle/captionStyle flat on the slide object itself. Wraps
// any such slide into the new shape; slides that already have {type, props}
// pass through untouched.
function normalizeSlide(item) {
  if (item && typeof item === 'object' && item.type && item.props) return item;
  const { id, image, heading, caption, headingStyle, captionStyle } = item || {};
  return {
    id: id || crypto.randomUUID(),
    type: 'media',
    props: {
      image: image || '', heading: heading || '', caption: caption || '',
      ...(headingStyle ? { headingStyle } : {}),
      ...(captionStyle ? { captionStyle } : {}),
    },
  };
}

// Blocks created before the `items`-array rewrite stored up to 5 slides as
// flat item1Image/item1Heading/item1Caption ... item5Caption props instead.
// Reads real content out of those legacy fields so existing carousels don't
// silently lose their images -- confirmed live: a real carousel had uploaded
// images sitting in item1Image/item2Image that the array-only version was
// ignoring entirely.
function legacySlidesFromProps(legacyProps) {
  const slides = [];
  for (let i = 1; i <= 5; i++) {
    const image = legacyProps[`item${i}Image`];
    const heading = legacyProps[`item${i}Heading`];
    const caption = legacyProps[`item${i}Caption`];
    if (image || heading || caption) {
      slides.push({ id: `legacy-${i}`, type: 'media', props: { image: image || '', heading: heading || '', caption: caption || '' } });
    }
  }
  return slides;
}

function mergeLegacySlides(items, legacyProps) {
  const legacy = legacySlidesFromProps(legacyProps);
  if (legacy.length === 0) return items;
  const merged = items.map((item, i) => {
    const fallback = legacy[i];
    if (!fallback || item.type !== 'media') return item;
    return {
      ...item,
      props: {
        ...item.props,
        image: item.props.image || fallback.props.image,
        heading: item.props.heading || fallback.props.heading,
        caption: item.props.caption || fallback.props.caption,
      },
    };
  });
  if (legacy.length > merged.length) merged.push(...legacy.slice(merged.length));
  return merged;
}

export function CarouselBlock({
  items, autoplay = true, autoplaySpeed = 'normal', loop = true, shuffleOnLoop = false, pauseOnHover = true,
  showArrows = true, showDots = true, transition = 'slide', aspectRatio = '16:9',
  editable, onFieldChange, onOpenSettings, activeSettingsTarget, pathPrefix,
  ...legacyProps
}) {
  const originalItems = Array.isArray(items) ? items : [];
  const normalizedSlides = originalItems.map(normalizeSlide);
  const mergedSlides = mergeLegacySlides(normalizedSlides, legacyProps);
  const slides = mergedSlides.length > 0 ? mergedSlides : [newSlide()];

  // One-time self-heal: if normalizing the shape or merging in legacy fields
  // actually changed something the stored `items` didn't already have,
  // persist the result so it's not silently re-derived on every render and
  // the old flat/legacy fields can eventually go stale.
  const mergedJSON = JSON.stringify(mergedSlides);
  React.useEffect(() => {
    if (editable && onFieldChange && mergedSlides.length > 0 && mergedJSON !== JSON.stringify(originalItems)) {
      onFieldChange('items', mergedSlides);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per real change in the merged result, not on every render
  }, [mergedJSON]);

  if (editable) {
    return (
      <EditableCarousel slides={slides} pathPrefix={pathPrefix} onFieldChange={onFieldChange} onOpenSettings={onOpenSettings} activeSettingsTarget={activeSettingsTarget} aspectRatio={aspectRatio} />
    );
  }

  return (
    <LiveCarousel
      items={slides}
      autoplay={autoplay}
      autoplaySpeed={autoplaySpeed}
      loop={loop}
      shuffleOnLoop={shuffleOnLoop}
      pauseOnHover={pauseOnHover}
      showArrows={showArrows}
      showDots={showDots}
      transition={transition}
      aspectRatio={aspectRatio}
    />
  );
}

// Editor preview: rather than a horizontal-scroll strip of every slide at
// equal width (which grows wider as slides are added, forcing the whole
// canvas to scroll sideways), this mirrors what the LIVE carousel actually
// looks like -- one large "current" slide plus 2-3 narrow upcoming peeks --
// in a row whose total width never exceeds its container, however many
// slides exist. Add/duplicate/delete act on whichever slide is currently focused.
function EditableCarousel({ slides, pathPrefix, onFieldChange, onOpenSettings, activeSettingsTarget, aspectRatio }) {
  const [focusIndex, setFocusIndex] = React.useState(0);
  const index = Math.min(focusIndex, slides.length - 1);
  const current = slides[index];
  // Split the not-shown peeks evenly across both sides of the current slide
  // (previous slides peek in on the left, upcoming ones on the right). An odd
  // total can't split evenly, so it rounds down to the nearest even number.
  let peekCount = Math.min(3, slides.length - 1);
  if (peekCount % 2 !== 0) peekCount -= 1;
  const sidePeeks = peekCount / 2;
  const leftIndexes = Array.from({ length: sidePeeks }, (_, i) => {
    const offset = sidePeeks - i;
    return ((index - offset) % slides.length + slides.length) % slides.length;
  });
  const rightIndexes = Array.from({ length: sidePeeks }, (_, i) => (index + i + 1) % slides.length);

  function commit(nextSlides, nextFocus) {
    onFieldChange('items', nextSlides);
    if (nextFocus !== undefined) setFocusIndex(nextFocus);
  }

  function updateSlide(i, patch) {
    commit(slides.map((s, si) => (si === i ? { ...s, ...patch } : s)));
  }
  function updateSlideProps(i, propsPatch) {
    updateSlide(i, { props: { ...slides[i].props, ...propsPatch } });
  }
  function setSlideType(i, type) {
    updateSlide(i, { type, props: slidePropsForType(type) });
  }
  function addSlide() {
    const next = [...slides.slice(0, index + 1), newSlide(), ...slides.slice(index + 1)];
    commit(next, index + 1);
  }
  // Selecting several photos at once for a media slide's image (see
  // EditableImage's `multiple` mode): the first fills the current slide as
  // usual, and one new slide per remaining photo is inserted right after it.
  function addSlidesWithImages(urls) {
    if (!urls.length) return;
    const newSlides = urls.map((url) => ({ id: crypto.randomUUID(), type: 'media', props: { image: url, heading: '', caption: '' } }));
    const next = [...slides.slice(0, index + 1), ...newSlides, ...slides.slice(index + 1)];
    commit(next, index + 1);
  }
  function duplicateSlide() {
    const copy = { ...slides[index], id: crypto.randomUUID() };
    const next = [...slides.slice(0, index + 1), copy, ...slides.slice(index + 1)];
    commit(next, index + 1);
  }
  function deleteSlide() {
    if (slides.length <= 1) return; // always keep at least one slide
    const next = slides.filter((_, si) => si !== index);
    commit(next, Math.min(index, next.length - 1));
  }
  function go(delta) {
    setFocusIndex((index + delta + slides.length) % slides.length);
  }

  // Replaces every slide with a fresh batch pulled live from one of the
  // site's own data sources -- an admin building a "Meet the Staff" or
  // "Recent Photos" carousel shouldn't have to hand-copy each image/name one
  // slide at a time when that same data already lives in Directory/Gallery/
  // Events/Announcements.
  function generateSlides(newSlides) {
    if (newSlides.length === 0) return;
    commit(newSlides, 0);
  }

  const mainParts = 3; // main slide gets 3 flex-grow parts, each peek gets 1

  return (
    <div>
      <AutofillControls onGenerate={generateSlides} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
          Slide {index + 1} of {slides.length} &middot; {current.type === 'media' ? 'Image + caption' : BLOCK_REGISTRY[current.type]?.label || current.type}
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <AddBlockButton
            label="Change slide type"
            dialogTitle="Choose this slide's content"
            excludeTypes={['carousel']}
            onAdd={(type) => setSlideType(index, type)}
          />
          <button type="button" onClick={duplicateSlide} className="btn btn-outline btn-sm">Duplicate slide</button>
          <button type="button" onClick={deleteSlide} disabled={slides.length <= 1} className="btn btn-outline btn-sm">Delete slide</button>
          <button type="button" onClick={addSlide} className="btn btn-outline btn-sm">+ Add slide</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 'var(--space-3)', width: '100%', overflow: 'hidden' }}>
        {slides.length > 1 && (
          <button type="button" onClick={() => go(-1)} aria-label="Previous slide" style={peekNavStyle}><ChevronLeft /></button>
        )}

        {leftIndexes.map((peekIdx) => (
          <PeekSlide key={slides[peekIdx].id} slide={slides[peekIdx]} onClick={() => setFocusIndex(peekIdx)} slideNumber={peekIdx + 1} aspectRatio={aspectRatio} />
        ))}

        <div style={{ flex: `${mainParts} 1 0%`, minWidth: 0 }}>
          {current.type === 'media' ? (
            <>
              <EditableImage
                value={current.props.image}
                alt=""
                onChange={(url) => updateSlideProps(index, { image: url })}
                pathPrefix={pathPrefix}
                emptyLabel={`Slide ${index + 1} image`}
                style={{ aspectRatio: ratioToCss(aspectRatio) }}
                aspect={ratioToNumber(aspectRatio)}
                multiple
                onExtraImages={addSlidesWithImages}
              />
              <div style={{ marginTop: 'var(--space-2)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', ...textStyleToCss(current.props.headingStyle) }}>
                <EditableText
                  value={current.props.heading}
                  onCommit={(v) => updateSlideProps(index, { heading: v })}
                  placeholder={`Slide ${index + 1} heading (optional)`}
                  styleValue={current.props.headingStyle}
                  onStyleChange={(s) => updateSlideProps(index, { headingStyle: s })}
                />
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', ...textStyleToCss(current.props.captionStyle) }}>
                <EditableText
                  value={current.props.caption}
                  onCommit={(v) => updateSlideProps(index, { caption: v })}
                  placeholder="Caption (optional)"
                  styleValue={current.props.captionStyle}
                  onStyleChange={(s) => updateSlideProps(index, { captionStyle: s })}
                />
              </div>
            </>
          ) : (
            <SlideBlockEditor
              type={current.type}
              blockId={current.id}
              props={current.props}
              pathPrefix={pathPrefix}
              onFieldChange={(key, value) => updateSlideProps(index, { [key]: value })}
              onOpenSettings={onOpenSettings ? () => onOpenSettings('items', index) : undefined}
              isSettingsActive={activeSettingsTarget?.nestedKey === 'items' && activeSettingsTarget?.nestedIndex === index}
            />
          )}
        </div>

        {rightIndexes.map((peekIdx) => (
          <PeekSlide key={slides[peekIdx].id} slide={slides[peekIdx]} onClick={() => setFocusIndex(peekIdx)} slideNumber={peekIdx + 1} aspectRatio={aspectRatio} />
        ))}

        {slides.length > 1 && (
          <button type="button" onClick={() => go(1)} aria-label="Next slide" style={peekNavStyle}><ChevronRight /></button>
        )}
      </div>
    </div>
  );
}

const AUTOFILL_COUNT_OPTIONS = [
  { value: '3', label: '3' }, { value: '6', label: '6' }, { value: '9', label: '9' },
  { value: '12', label: '12' }, { value: 'all', label: 'All' },
];

// Lets an admin fill every slide at once from a live category of site
// content -- Directory, Gallery, Events, Announcements -- instead of
// hand-building each slide's image/heading/caption one at a time. Generating
// replaces the whole slide list; that's a deliberate "pull from this
// category" action, not an incremental append, and it's fully recoverable
// through the page's own change-history/undo like any other edit.
function AutofillControls({ onGenerate }) {
  const [category, setCategory] = React.useState('directory');
  const [directorySlug, setDirectorySlug] = React.useState('');
  const [albumId, setAlbumId] = React.useState('all');
  const [timeframe, setTimeframe] = React.useState('upcoming');
  const [count, setCount] = React.useState('6');
  const [directories, setDirectories] = React.useState(null);
  const [albums, setAlbums] = React.useState(null);
  const [generating, setGenerating] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    import('../lib/supabase/browser-client').then(({ supabaseBrowser }) => {
      supabaseBrowser.from('directories').select('slug, name').order('sort_order').then(({ data }) => {
        if (!active) return;
        setDirectories(data || []);
        setDirectorySlug((current) => current || data?.[0]?.slug || '');
      });
      supabaseBrowser.from('gallery_albums').select('id, name').order('sort_order').then(({ data }) => {
        if (active) setAlbums(data || []);
      });
    });
    return () => { active = false; };
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { supabaseBrowser } = await import('../lib/supabase/browser-client');
      const {
        fetchDirectoryTeaserItems, fetchGalleryTeaserItems, fetchEventsTeaserItems, fetchPostsTeaserItems,
      } = await import('./teaserData.js');

      let newSlides = [];
      if (category === 'directory' && directorySlug) {
        const people = await fetchDirectoryTeaserItems(supabaseBrowser, directorySlug, count);
        newSlides = people.map((p) => ({
          id: crypto.randomUUID(), type: 'media',
          props: { image: p.photo_url || '', heading: p.name, caption: truncateText(p.bio) },
        }));
      } else if (category === 'gallery') {
        const photos = await fetchGalleryTeaserItems(supabaseBrowser, albumId, count);
        newSlides = photos.map((ph) => ({
          id: crypto.randomUUID(), type: 'media',
          props: { image: ph.image_url, heading: '', caption: ph.caption || '' },
        }));
      } else if (category === 'events') {
        const events = await fetchEventsTeaserItems(supabaseBrowser, count, timeframe);
        newSlides = events.map((ev) => ({
          id: crypto.randomUUID(), type: 'media',
          props: { image: '', heading: ev.title, caption: formatEventCaption(ev) },
        }));
      } else if (category === 'posts') {
        const posts = await fetchPostsTeaserItems(supabaseBrowser, count);
        newSlides = posts.map((p) => ({
          id: crypto.randomUUID(), type: 'media',
          props: { image: p.cover_image_url || '', heading: p.title, caption: truncateText(p.excerpt) },
        }));
      }
      onGenerate(newSlides);
    } finally {
      setGenerating(false);
    }
  }

  const directoryOptions = directories === null
    ? [{ value: '', label: 'Loading…' }]
    : directories.map((d) => ({ value: d.slug, label: d.name }));
  const albumOptions = albums === null
    ? [{ value: 'all', label: 'Loading…' }]
    : [{ value: 'all', label: 'All albums' }, ...albums.map((a) => ({ value: a.id, label: a.name }))];

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-3)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
      <Select
        label="Fill slides from"
        value={category}
        options={[
          { value: 'directory', label: 'Directory' },
          { value: 'gallery', label: 'Photo Gallery' },
          { value: 'events', label: 'Events' },
          { value: 'posts', label: 'Announcements' },
        ]}
        onChange={(e) => setCategory(e.target.value)}
      />
      {category === 'directory' && (
        <Select label="Which directory" value={directorySlug} options={directoryOptions} onChange={(e) => setDirectorySlug(e.target.value)} />
      )}
      {category === 'gallery' && (
        <Select label="Which album" value={albumId} options={albumOptions} onChange={(e) => setAlbumId(e.target.value)} />
      )}
      {category === 'events' && (
        <Select
          label="Which events"
          value={timeframe}
          options={[{ value: 'upcoming', label: 'Upcoming only' }, { value: 'all', label: 'All (including past)' }]}
          onChange={(e) => setTimeframe(e.target.value)}
        />
      )}
      <Select label="How many" value={count} options={AUTOFILL_COUNT_OPTIONS} onChange={(e) => setCount(e.target.value)} />
      <button type="button" onClick={handleGenerate} disabled={generating || (category === 'directory' && !directorySlug)} className="btn btn-primary btn-sm">
        {generating ? 'Filling…' : 'Fill slides'}
      </button>
    </div>
  );
}

// Renders a nested block's own inline canvas editing UI (EditableText/
// EditableImage/etc, exactly as it behaves at the page level) plus whatever
// non-inline "settings" fields that block type has (e.g. a Button's href, an
// Embed's URL) using the same field renderer as the page-level style panel --
// those fields have no other home since a slide isn't a real page block with
// its own row in BlockConfigPanel.
function SlideBlockEditor({ type, blockId, props, pathPrefix, onFieldChange, onOpenSettings, isSettingsActive }) {
  const def = BLOCK_REGISTRY[type];
  const Component = BLOCK_COMPONENTS[type];
  if (!def || !Component) return null;
  const settingsFields = def.fields.filter((f) => !isInlineField(f)).filter((f) => !f.showIf || f.showIf(props));

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', background: 'var(--surface-card)' }}>
      <Component {...props} editable onFieldChange={onFieldChange} pathPrefix={pathPrefix} blockId={blockId} />
      {settingsFields.length > 0 && onOpenSettings && (
        // This slide's settings (a Button's href, an Embed's URL, ...) live
        // in the same right-hand panel as everything else -- see
        // PageBuilderScreen.jsx's settingsTarget. stopPropagation:
        // this sits inside the Carousel block, which itself sits inside the
        // canvas's draggable wrapper -- without it, clicking bubbles a
        // pointerdown up and starts a reorder drag right after the click.
        <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onOpenSettings(); }}
            className={`btn btn-sm ${isSettingsActive ? 'btn-secondary' : 'btn-outline'}`}
          >
            ⚙ Settings
          </button>
        </div>
      )}
    </div>
  );
}

const peekNavStyle = {
  flex: '0 0 auto', border: 'none', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32,
};

// Best-effort representative image for a slide's peek thumbnail -- most
// nestable block types have no single obvious image, so those fall back to
// an icon instead (see PeekSlide).
function slideThumbnailImage(slide) {
  const { type, props } = slide;
  if (type === 'media') return props.image;
  if (type === 'image' || type === 'image-text') return props.imageUrl;
  if (type === 'quote') return props.avatarImage;
  if (type === 'hero' && props.background === 'image') return props.backgroundImage;
  return '';
}

function PeekSlide({ slide, onClick, slideNumber, aspectRatio }) {
  const thumb = slideThumbnailImage(slide);
  const def = BLOCK_REGISTRY[slide.type];
  const ratio = ratioToCss(aspectRatio);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Jump to slide ${slideNumber}`}
      style={{ flex: '1 1 0%', minWidth: 0, border: 'none', background: 'none', cursor: 'pointer', padding: 0, opacity: 0.5, transition: 'opacity var(--duration-fast)' }}
    >
      {thumb ? (
        <img src={thumb} alt="" style={{ width: '100%', aspectRatio: ratio, objectFit: 'cover', borderRadius: 'var(--radius-md)', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', aspectRatio: ratio, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px dashed var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          {def && <BlockIcon name={def.icon} />}
        </div>
      )}
    </button>
  );
}

// A visitor pausing any carousel on the site sticks -- WCAG 2.2.2 wants a
// way to stop auto-updating content, and a per-visit-only pause (reset on
// every page load) means someone who's sensitive to motion has to re-pause
// it constantly. One shared preference, not per-carousel, since a visitor
// who doesn't want autoplay generally doesn't want it anywhere.
const AUTOPLAY_OFF_KEY = 'alta-carousel-autoplay-off';

// Fisher-Yates -- used by the carousel's "shuffle on loop" option, see
// LiveCarousel's `order` state below.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function LiveCarousel({ items, autoplay, autoplaySpeed, loop, shuffleOnLoop, pauseOnHover, showArrows, showDots, transition, aspectRatio }) {
  const [index, setIndex] = React.useState(0);
  // The actually-displayed order -- identical to `items` unless
  // shuffleOnLoop has reshuffled it after a full pass (see `go` below).
  // Keyed off the slide content (not the `items` reference, which a parent
  // re-render could recreate) so an in-progress shuffle isn't reset by
  // something unrelated re-rendering this component.
  const [order, setOrder] = React.useState(items);
  const itemsKey = JSON.stringify(items);
  React.useEffect(() => { setOrder(items); }, [itemsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- `items` itself, not itemsKey, is what gets stored
  const [paused, setPaused] = React.useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(AUTOPLAY_OFF_KEY) === 'true';
  });
  const touchStartX = React.useRef(null);

  function togglePaused() {
    setPaused((p) => {
      const next = !p;
      localStorage.setItem(AUTOPLAY_OFF_KEY, String(next));
      return next;
    });
  }

  // Wrapping back around ("recycling" the deck) is exactly when
  // shuffleOnLoop reshuffles -- setOrder and setIndex(0) land in the same
  // render, so the slide shown at the new index 0 is already the freshly
  // shuffled one, never a stale flash of the old order.
  const go = React.useCallback((next) => {
    setIndex((current) => {
      if (next < 0) {
        if (!loop) return 0;
        if (shuffleOnLoop) setOrder((o) => shuffle(o));
        return order.length - 1;
      }
      if (next >= order.length) {
        if (!loop) return order.length - 1;
        if (shuffleOnLoop) setOrder((o) => shuffle(o));
        return 0;
      }
      return next;
    });
  }, [order.length, loop, shuffleOnLoop]);

  React.useEffect(() => {
    if (!autoplay || paused) return;
    const id = setInterval(() => go(index + 1), SPEED_MS[autoplaySpeed] || SPEED_MS.normal);
    return () => clearInterval(id);
  }, [autoplay, paused, index, autoplaySpeed, go]);

  function handleKeyDown(e) {
    if (e.key === 'ArrowLeft') go(index - 1);
    if (e.key === 'ArrowRight') go(index + 1);
  }
  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) go(delta > 0 ? index - 1 : index + 1);
    touchStartX.current = null;
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => pauseOnHover && setPaused(true)}
      onMouseLeave={() => pauseOnHover && setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative', outline: 'none' }}
    >
      <div style={{ position: 'relative', aspectRatio: ratioToCss(aspectRatio), borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {transition === 'fade' ? (
          order.map((item, i) => (
            <div key={item.id ?? i} style={{ position: 'absolute', inset: 0, opacity: i === index ? 1 : 0, transition: 'opacity var(--duration-standard)', pointerEvents: i === index ? 'auto' : 'none' }}>
              <Slide item={item} eager={i === 0} />
            </div>
          ))
        ) : (
          <div style={{ display: 'flex', width: '100%', height: '100%', transform: `translateX(-${index * 100}%)`, transition: 'transform var(--duration-standard) var(--ease-standard)' }}>
            {order.map((item, i) => (
              <div key={item.id ?? i} style={{ flex: '0 0 100%', height: '100%' }}>
                <Slide item={item} eager={i === 0} />
              </div>
            ))}
          </div>
        )}

        {showArrows && order.length > 1 && (
          <>
            <button aria-label="Previous slide" onClick={() => go(index - 1)} style={arrowStyle('left')}><ChevronLeft /></button>
            <button aria-label="Next slide" onClick={() => go(index + 1)} style={arrowStyle('right')}><ChevronRight /></button>
          </>
        )}

        {autoplay && (
          <button
            aria-label={paused ? 'Play carousel' : 'Pause carousel'}
            onClick={togglePaused}
            style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)', width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(20,20,22,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
        )}
      </div>

      {showDots && order.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
          {order.map((item, i) => (
            <button
              key={item.id ?? i}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: i === index ? 'var(--brand-secondary)' : 'var(--border-default)' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Dispatches a live (read-only) slide to its renderer: the original
// image+heading/caption overlay for 'media' slides, or the nested block's
// own component for everything else (see AddBlockButton's excludeTypes above).
function Slide({ item, eager }) {
  if (item.type === 'media') return <MediaSlide {...item.props} eager={eager} />;
  const Component = BLOCK_COMPONENTS[item.type];
  if (!Component) return null;
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', background: 'var(--surface-card)', boxSizing: 'border-box' }}>
      <div style={{ width: '100%' }}>
        <Component {...item.props} blockId={item.id} />
      </div>
    </div>
  );
}

// `eager` is only ever true for slide 0 -- the rest sit outside the visible
// frame (translated via CSS, not conditionally mounted), so the browser
// correctly treats them as offscreen and defers them regardless of the
// active index. See ImageBlock.jsx/DirectoryTeaserBlock.jsx etc. for the
// same loading="lazy" treatment on other public-facing content images.
function MediaSlide({ image, heading, caption, headingStyle, captionStyle, eager }) {
  // Auto-filled from a source with no photo of its own (e.g. a calendar
  // event) -- shown as centered text on a plain surface instead of the
  // usual image-with-bottom-overlay treatment.
  if (!image) {
    if (!heading && !caption) return null;
    return (
      <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-6)', background: 'var(--surface-sunken)' }}>
        {heading && <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-subheading)', color: 'var(--text-primary)', ...textStyleToCss(headingStyle) }}>{heading}</div>}
        {caption && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)', ...textStyleToCss(captionStyle) }}>{caption}</div>}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <img src={image} alt={heading || ''} loading={eager ? 'eager' : 'lazy'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {(heading || caption) && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 'var(--space-4)', background: 'linear-gradient(transparent, rgba(0,0,0,0.65))', color: '#fff' }}>
          {heading && <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-subheading)', ...textStyleToCss(headingStyle) }}>{heading}</div>}
          {caption && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', opacity: 0.9, ...textStyleToCss(captionStyle) }}>{caption}</div>}
        </div>
      )}
    </div>
  );
}

function arrowStyle(side) {
  return {
    position: 'absolute',
    top: '50%',
    [side]: 'var(--space-3)',
    transform: 'translateY(-50%)',
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(20,20,22,0.6)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  };
}
