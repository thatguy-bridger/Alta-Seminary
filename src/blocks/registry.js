// Single source of truth for block types. Adding a new block type is one entry
// here (plus a renderer component in src/blocks/) -- the config/style panel and
// the "Add block" picker are both driven off this registry, not hand-built per type.
//
// field.kind values: text | richtext | select | image | file | toggle
// field.showIf(props) restricts a field to when another prop has a given value.
// field.inline (default true for text/richtext/image) -- false forces a field into
// the side style panel instead of being directly click-to-edit on the canvas
// (used for things like URLs, where inline editing on the rendered element
// wouldn't make sense, e.g. clicking a button shouldn't put you in its href).
//
// Every block also carries a `layout` object (spacing/contained/background/anchor) --
// see DEFAULT_LAYOUT / LAYOUT_FIELDS below -- applied by BlockWrapper.jsx
// universally, so every block type gets these controls for free.

export const BLOCK_REGISTRY = {
  hero: {
    label: 'Hero / Heading',
    icon: 'type',
    description: 'A big heading with an optional subheading and background — great for the top of a page.',
    defaultProps: {
      heading: '', subheading: '', eyebrow: '', align: 'center',
      background: 'none', backgroundImage: '',
      headingSize: 'normal', overlayOpacity: 'medium', textColor: 'auto',
    },
    fields: [
      { key: 'eyebrow', kind: 'text', label: 'Eyebrow (small label above heading)' },
      { key: 'heading', kind: 'text', label: 'Heading' },
      { key: 'subheading', kind: 'text', label: 'Subheading' },
      { key: 'align', kind: 'select', label: 'Alignment', options: [{value:'left',label:'Left'},{value:'center',label:'Center'}] },
      { key: 'headingSize', kind: 'select', label: 'Heading size', options: [{value:'normal',label:'Normal'},{value:'large',label:'Large'},{value:'xlarge',label:'Extra large'}] },
      { key: 'textColor', kind: 'select', label: 'Text color', options: [{value:'auto',label:'Auto'},{value:'light',label:'Force light'},{value:'dark',label:'Force dark'}] },
      { key: 'background', kind: 'select', label: 'Background', options: [{value:'none',label:'None'},{value:'tint',label:'Tint'},{value:'image',label:'Image'}] },
      { key: 'backgroundImage', kind: 'image', label: 'Background image', showIf: (p) => p.background === 'image' },
      { key: 'overlayOpacity', kind: 'select', label: 'Image overlay darkness', options: [{value:'light',label:'Light'},{value:'medium',label:'Medium'},{value:'dark',label:'Dark'}], showIf: (p) => p.background === 'image' },
    ],
  },
  'rich-text': {
    label: 'Rich Text',
    icon: 'align-left',
    description: 'A block of formatted text — headings, bold, links, and lists.',
    defaultProps: { content: '', width: 'normal', textAlign: 'left', textTone: 'default', fontSize: 'normal', firstLineHeading: false, twoColumn: false },
    fields: [
      { key: 'content', kind: 'richtext', label: 'Content' },
      { key: 'firstLineHeading', kind: 'toggle', label: 'Style first line as a heading' },
      { key: 'width', kind: 'select', label: 'Width', options: [{value:'normal',label:'Normal'},{value:'narrow',label:'Narrow'}] },
      { key: 'fontSize', kind: 'select', label: 'Font size', options: [{value:'small',label:'Small'},{value:'normal',label:'Normal'},{value:'large',label:'Large'}] },
      { key: 'textAlign', kind: 'select', label: 'Text alignment', options: [{value:'left',label:'Left'},{value:'center',label:'Center'}] },
      { key: 'textTone', kind: 'select', label: 'Text color', options: [{value:'default',label:'Default'},{value:'muted',label:'Muted'}] },
      { key: 'twoColumn', kind: 'toggle', label: 'Two-column layout (desktop only)' },
    ],
  },
  image: {
    label: 'Image',
    icon: 'image',
    description: 'A single photo, optionally with a caption and a link.',
    defaultProps: { imageUrl: '', alt: '', caption: '', width: 'full', aspectRatio: 'auto', corners: 'rounded', border: false, shadow: true, lightbox: false, link: '' },
    fields: [
      { key: 'imageUrl', kind: 'image', label: 'Image' },
      { key: 'alt', kind: 'text', label: 'Alt text (required for accessibility)' },
      { key: 'caption', kind: 'text', label: 'Caption' },
      { key: 'link', kind: 'text', label: 'Link (optional -- makes the image clickable)', inline: false },
      { key: 'width', kind: 'select', label: 'Width', options: [{value:'full',label:'Full width'},{value:'contained',label:'Contained'}] },
      { key: 'aspectRatio', kind: 'select', label: 'Aspect ratio', options: [{value:'auto',label:'Auto'},{value:'16:9',label:'16:9'},{value:'4:3',label:'4:3'},{value:'1:1',label:'1:1'}] },
      { key: 'corners', kind: 'select', label: 'Corners', options: [{value:'sharp',label:'Sharp'},{value:'rounded',label:'Rounded'}] },
      { key: 'border', kind: 'toggle', label: 'Border' },
      { key: 'shadow', kind: 'toggle', label: 'Shadow' },
      { key: 'lightbox', kind: 'toggle', label: 'Click to enlarge' },
    ],
  },
  'image-text': {
    label: 'Image + Text',
    icon: 'columns-2',
    description: 'A photo next to a block of text, side by side.',
    defaultProps: { imageUrl: '', alt: '', heading: '', body: '', imagePosition: 'left', verticalAlign: 'center', gap: 'lg', mobileImageFirst: true },
    fields: [
      { key: 'imageUrl', kind: 'image', label: 'Image' },
      { key: 'alt', kind: 'text', label: 'Alt text' },
      { key: 'heading', kind: 'text', label: 'Heading' },
      { key: 'body', kind: 'richtext', label: 'Body' },
      { key: 'imagePosition', kind: 'select', label: 'Image position', options: [{value:'left',label:'Left'},{value:'right',label:'Right'}] },
      { key: 'verticalAlign', kind: 'select', label: 'Vertical alignment', options: [{value:'top',label:'Top'},{value:'center',label:'Center'},{value:'bottom',label:'Bottom'}] },
      { key: 'gap', kind: 'select', label: 'Gap', options: [{value:'sm',label:'Small'},{value:'md',label:'Medium'},{value:'lg',label:'Large'}] },
      { key: 'mobileImageFirst', kind: 'toggle', label: 'Show image first on mobile' },
    ],
  },
  button: {
    label: 'Button / CTA',
    icon: 'mouse-pointer-click',
    description: 'A clickable button linking to another page or an external URL.',
    defaultProps: { label: '', href: '', variant: 'primary', size: 'md', align: 'left', icon: 'none', fullWidth: false, newTab: false },
    fields: [
      { key: 'label', kind: 'text', label: 'Label' },
      { key: 'href', kind: 'text', label: 'Link (page path or URL)', inline: false },
      { key: 'variant', kind: 'select', label: 'Style', options: [{value:'primary',label:'Primary'},{value:'secondary',label:'Secondary'},{value:'outline',label:'Outline'},{value:'ghost',label:'Ghost'}] },
      { key: 'size', kind: 'select', label: 'Size', options: [{value:'sm',label:'Small'},{value:'md',label:'Medium'},{value:'lg',label:'Large'}] },
      { key: 'align', kind: 'select', label: 'Alignment', options: [{value:'left',label:'Left'},{value:'center',label:'Center'},{value:'right',label:'Right'}] },
      { key: 'icon', kind: 'select', label: 'Icon', options: [{value:'none',label:'None'},{value:'arrow',label:'Arrow'},{value:'download',label:'Download'},{value:'external',label:'External link'}] },
      { key: 'fullWidth', kind: 'toggle', label: 'Full width' },
      { key: 'newTab', kind: 'toggle', label: 'Open in new tab' },
    ],
  },
  columns: {
    label: 'Columns',
    icon: 'columns-3',
    description: 'Two or three side-by-side columns, each its own image + text or any other block type.',
    // `columns` is an array of exactly 3 slots (only the first `columnCount`
    // render) rather than numbered col1Image/col2Image/... flat props -- see
    // ColumnsBlock.jsx, which mirrors the carousel's {id, type, props} shape
    // (CarouselBlock.jsx) so each column can independently be the original
    // "content" type (image + heading + body) or any other BLOCK_TYPES entry.
    defaultProps: {
      columnCount: '2', textAlign: 'left', widthRatio: 'equal', divider: false,
      columns: [
        { id: 'col-1', type: 'content', props: { image: '', heading: '', body: '' } },
        { id: 'col-2', type: 'content', props: { image: '', heading: '', body: '' } },
        { id: 'col-3', type: 'content', props: { image: '', heading: '', body: '' } },
      ],
    },
    fields: [
      { key: 'columnCount', kind: 'select', label: 'Number of columns', options: [{value:'2',label:'2'},{value:'3',label:'3'}] },
      { key: 'widthRatio', kind: 'select', label: 'Width ratio', options: [{value:'equal',label:'Equal'},{value:'wide-left',label:'Wide left (2:1)'},{value:'wide-right',label:'Wide right (1:2)'}], showIf: (p) => p.columnCount === '2' },
      { key: 'textAlign', kind: 'select', label: 'Text alignment', options: [{value:'left',label:'Left'},{value:'center',label:'Center'}] },
      { key: 'divider', kind: 'toggle', label: 'Vertical divider lines between columns' },
    ],
  },
  quote: {
    label: 'Quote / Scripture',
    icon: 'quote',
    description: 'A pulled quote or scripture verse, with an optional citation and photo.',
    defaultProps: { quoteText: '', citation: '', style: 'plain', align: 'center', avatarImage: '', size: 'normal', tintBackground: false },
    fields: [
      { key: 'quoteText', kind: 'richtext', label: 'Quote' },
      { key: 'citation', kind: 'text', label: 'Citation (e.g. 3 Nephi 11:3, or a person\'s name)' },
      { key: 'avatarImage', kind: 'image', label: 'Photo (optional -- for testimonials)' },
      { key: 'style', kind: 'select', label: 'Style', options: [{value:'plain',label:'Plain'},{value:'bordered',label:'Bordered'}] },
      { key: 'size', kind: 'select', label: 'Size', options: [{value:'normal',label:'Normal'},{value:'large',label:'Large'}] },
      { key: 'align', kind: 'select', label: 'Alignment', options: [{value:'left',label:'Left'},{value:'center',label:'Center'}] },
      { key: 'tintBackground', kind: 'toggle', label: 'Tinted background' },
    ],
  },
  divider: {
    label: 'Divider / Spacer',
    icon: 'minus',
    description: 'A simple line or blank space to separate sections.',
    defaultProps: { style: 'line', size: 'md' },
    fields: [
      { key: 'style', kind: 'select', label: 'Style', options: [{value:'line',label:'Line'},{value:'space',label:'Space only'}] },
      { key: 'size', kind: 'select', label: 'Size', options: [{value:'sm',label:'Small'},{value:'md',label:'Medium'},{value:'lg',label:'Large'}] },
    ],
  },
  embed: {
    label: 'Embed (Map / Video / Music)',
    icon: 'map',
    description: 'Embed a YouTube video, Google Map, Spotify track, or other external content.',
    defaultProps: { embedType: 'youtube', url: '', caption: '', aspectRatio: '16:9', clickToLoad: true },
    fields: [
      { key: 'embedType', kind: 'select', label: 'Provider', options: [{value:'youtube',label:'YouTube'},{value:'vimeo',label:'Vimeo'},{value:'google-maps',label:'Google Maps'},{value:'spotify',label:'Spotify'},{value:'custom',label:'Custom (paste any embed URL)'}] },
      { key: 'url', kind: 'text', label: 'Paste the video/page URL (any normal share link works for YouTube, Vimeo, Spotify -- Google Maps needs its "Embed a map" link)', inline: false },
      { key: 'caption', kind: 'text', label: 'Caption' },
      { key: 'aspectRatio', kind: 'select', label: 'Aspect ratio', options: [{value:'16:9',label:'16:9'},{value:'4:3',label:'4:3'},{value:'1:1',label:'1:1'}] },
      { key: 'clickToLoad', kind: 'toggle', label: 'Click to load (faster page, more private -- recommended)' },
    ],
  },
  carousel: {
    label: 'Carousel / Slider',
    icon: 'gallery-horizontal',
    description: 'A sliding set of images visitors can click or swipe through.',
    // `items` is a plain array (unlimited length, add/duplicate/delete managed
    // directly in CarouselBlock's own editable UI) rather than numbered
    // item1Image/item2Image/... flat props -- the old scheme capped out at 5
    // slides. Each item is {id, type, props}: `type` is either 'media' (an
    // image with an optional heading/caption overlay, props {image, heading,
    // caption}) or any other BLOCK_TYPES entry nested as a full slide (props
    // shaped like that type's own defaultProps) -- see CarouselBlock.jsx.
    defaultProps: {
      items: [
        { id: 'slide-1', type: 'media', props: { image: '', heading: '', caption: '' } },
        { id: 'slide-2', type: 'media', props: { image: '', heading: '', caption: '' } },
        { id: 'slide-3', type: 'media', props: { image: '', heading: '', caption: '' } },
      ],
      autoplay: true, autoplaySpeed: 'normal', loop: true, pauseOnHover: true,
      showArrows: true, showDots: true, transition: 'slide', aspectRatio: '16:9',
    },
    fields: [
      { key: 'aspectRatio', kind: 'select', label: 'Image aspect ratio', options: [{value:'21:9',label:'21:9 (ultra-wide)'},{value:'16:9',label:'16:9 (default)'},{value:'4:3',label:'4:3'},{value:'1:1',label:'Square'},{value:'9:16',label:'9:16 (vertical)'}] },
      { key: 'transition', kind: 'select', label: 'Transition', options: [{value:'slide',label:'Slide'},{value:'fade',label:'Fade'}] },
      { key: 'autoplay', kind: 'toggle', label: 'Auto-advance' },
      { key: 'autoplaySpeed', kind: 'select', label: 'Auto-advance speed', options: [{value:'slow',label:'Slow (5s)'},{value:'normal',label:'Normal (3s)'},{value:'fast',label:'Fast (1.5s)'}], showIf: (p) => p.autoplay },
      { key: 'pauseOnHover', kind: 'toggle', label: 'Pause on hover', showIf: (p) => p.autoplay },
      { key: 'loop', kind: 'toggle', label: 'Loop back to start' },
      { key: 'showArrows', kind: 'toggle', label: 'Show prev/next arrows' },
      { key: 'showDots', kind: 'toggle', label: 'Show dot indicators' },
    ],
  },
  'social-links': {
    label: 'Social Links',
    icon: 'share-2',
    description: 'A row of icon links to your social media profiles.',
    defaultProps: { facebookUrl: '', instagramUrl: '', youtubeUrl: '', xUrl: '', tiktokUrl: '', align: 'center' },
    fields: [
      { key: 'facebookUrl', kind: 'text', label: 'Facebook URL', inline: false },
      { key: 'instagramUrl', kind: 'text', label: 'Instagram URL', inline: false },
      { key: 'youtubeUrl', kind: 'text', label: 'YouTube URL', inline: false },
      { key: 'xUrl', kind: 'text', label: 'X (Twitter) URL', inline: false },
      { key: 'tiktokUrl', kind: 'text', label: 'TikTok URL', inline: false },
      { key: 'align', kind: 'select', label: 'Alignment', options: [{value:'left',label:'Left'},{value:'center',label:'Center'},{value:'right',label:'Right'}] },
    ],
  },
  download: {
    label: 'Download Button',
    icon: 'download',
    description: 'A button that lets visitors download a file you upload.',
    defaultProps: { label: '', fileUrl: '', fileName: '', align: 'left' },
    fields: [
      { key: 'label', kind: 'text', label: 'Button label (e.g. "Download Permission Slip")' },
      { key: 'fileUrl', kind: 'file', label: 'File' },
      { key: 'fileName', kind: 'text', label: 'Displayed file name (optional)', inline: false },
      { key: 'align', kind: 'select', label: 'Alignment', options: [{value:'left',label:'Left'},{value:'center',label:'Center'},{value:'right',label:'Right'}] },
    ],
  },
  'announcement-banner': {
    label: 'Announcement Banner',
    icon: 'megaphone',
    description: 'A dismissible banner for time-sensitive announcements.',
    defaultProps: { message: '', tone: 'info', link: '', linkLabel: '', dismissible: true },
    fields: [
      { key: 'message', kind: 'text', label: 'Message' },
      { key: 'tone', kind: 'select', label: 'Tone', options: [{value:'info',label:'Info'},{value:'success',label:'Success'},{value:'warning',label:'Warning'},{value:'error',label:'Urgent'}] },
      { key: 'link', kind: 'text', label: 'Link URL (optional)', inline: false },
      { key: 'linkLabel', kind: 'text', label: 'Link label (e.g. "Learn more")', inline: false },
      { key: 'dismissible', kind: 'toggle', label: 'Visitors can dismiss it' },
    ],
  },
  'directory-teaser': {
    label: 'Directory Teaser',
    icon: 'users',
    description: 'A grid of people pulled live from one of your directories.',
    defaultProps: { heading: 'Meet the Team', sourceType: 'staff', count: '3' },
    fields: [
      { key: 'heading', kind: 'text', label: 'Heading' },
      { key: 'sourceType', kind: 'directory-select', label: 'Pull from' },
      { key: 'count', kind: 'select', label: 'How many to show', options: [{value:'3',label:'3'},{value:'4',label:'4'},{value:'6',label:'6'},{value:'8',label:'8'},{value:'12',label:'12'},{value:'all',label:'All (full directory on this page)'}] },
    ],
  },
  'events-teaser': {
    label: 'Events Teaser',
    icon: 'calendar',
    description: 'A list of events pulled live from the calendar.',
    defaultProps: { heading: 'Upcoming Events', count: '3', timeframe: 'upcoming' },
    fields: [
      { key: 'heading', kind: 'text', label: 'Heading' },
      { key: 'timeframe', kind: 'select', label: 'Which events', options: [{value:'upcoming',label:'Upcoming only'},{value:'all',label:'All (including past)'}] },
      { key: 'count', kind: 'select', label: 'How many to show', options: [{value:'3',label:'3'},{value:'4',label:'4'},{value:'6',label:'6'},{value:'12',label:'12'},{value:'all',label:'All matching events'}] },
    ],
  },
  gallery: {
    label: 'Photo Gallery',
    icon: 'image',
    description: 'A grid of photos pulled live from your photo gallery.',
    defaultProps: { heading: '', albumFilter: 'all', columns: '3', count: '24' },
    fields: [
      { key: 'heading', kind: 'text', label: 'Heading' },
      { key: 'albumFilter', kind: 'album-select', label: 'Show photos from' },
      { key: 'columns', kind: 'select', label: 'Columns', options: [{value:'2',label:'2'},{value:'3',label:'3'},{value:'4',label:'4'}] },
      { key: 'count', kind: 'select', label: 'How many to show', options: [{value:'8',label:'8'},{value:'12',label:'12'},{value:'24',label:'24'},{value:'48',label:'48'},{value:'all',label:'All matching photos'}] },
    ],
  },
  'posts-teaser': {
    label: 'Announcements List',
    icon: 'newspaper',
    description: 'A list of your most recent announcements, linking to each one.',
    defaultProps: { heading: 'Announcements', count: '6' },
    fields: [
      { key: 'heading', kind: 'text', label: 'Heading' },
      { key: 'count', kind: 'select', label: 'How many to show', options: [{value:'3',label:'3'},{value:'6',label:'6'},{value:'9',label:'9'},{value:'12',label:'12'},{value:'all',label:'All published announcements'}] },
    ],
  },
  'contact-form': {
    label: 'Contact Form',
    icon: 'mail',
    description: "A working contact form visitors can submit — replies land in your inbox.",
    defaultProps: { heading: 'Get in Touch', successMessage: "Thanks — we'll be in touch soon." },
    fields: [
      { key: 'heading', kind: 'text', label: 'Heading' },
      { key: 'successMessage', kind: 'text', label: 'Message shown after a successful submission', inline: false },
    ],
  },
  faq: {
    label: 'FAQ',
    icon: 'help-circle',
    description: 'A list of expandable questions and answers.',
    defaultProps: {
      heading: 'Frequently Asked Questions',
      items: [{ id: 'faq-1', question: '', answer: '' }],
    },
    fields: [
      { key: 'heading', kind: 'text', label: 'Heading' },
    ],
  },
};

export const BLOCK_TYPES = Object.keys(BLOCK_REGISTRY);

// Universal per-block layout -- every block gets these regardless of type,
// applied by BlockWrapper.jsx. Kept separate from type-specific `props` so
// adding a layout control never touches individual block defaultProps.
export const DEFAULT_LAYOUT = { spacing: 'md', contained: false, background: 'none', anchor: '' };

export const LAYOUT_FIELDS = [
  { key: 'spacing', kind: 'select', label: 'Spacing above/below', options: [{value:'none',label:'None'},{value:'sm',label:'Small'},{value:'md',label:'Medium'},{value:'lg',label:'Large'},{value:'xl',label:'Extra large'}] },
  { key: 'contained', kind: 'toggle', label: 'Contained width (narrower, centered)' },
  { key: 'background', kind: 'select', label: 'Section background', options: [{value:'none',label:'None'},{value:'sunken',label:'Sunken'},{value:'inverse',label:'Inverse (dark)'}] },
  { key: 'anchor', kind: 'text', label: 'Anchor ID (for linking to this section, e.g. "contact")' },
];

export function createBlock(type) {
  const def = BLOCK_REGISTRY[type];
  if (!def) throw new Error(`Unknown block type: ${type}`);
  // Deep-clone, not a shallow spread -- defaultProps.items (carousel) is an
  // array, and a shallow copy would let every new block instance share the
  // exact same array reference from BLOCK_REGISTRY, so editing one carousel's
  // slides could mutate every other carousel's defaults too.
  return { id: crypto.randomUUID(), type, props: structuredClone(def.defaultProps), layout: { ...DEFAULT_LAYOUT } };
}

// Content fields (text/richtext/image/file) render as click-to-edit directly on
// the canvas by default; `inline: false` opts a field out (e.g. URLs) into the style panel.
export function isInlineField(field) {
  return field.inline !== false && (field.kind === 'text' || field.kind === 'richtext' || field.kind === 'image' || field.kind === 'file');
}

// Domains allowed for the Embed block -- a light but real guard against
// arbitrary iframe injection from admin input (see build plan risks).
export const ALLOWED_EMBED_HOSTS = [
  'www.youtube.com', 'youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com',
  'player.vimeo.com',
  'www.google.com', 'maps.google.com',
  'open.spotify.com',
];

export function isAllowedEmbedUrl(url) {
  try {
    const { hostname, protocol } = new URL(url);
    return protocol === 'https:' && ALLOWED_EMBED_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

// Admins paste whatever URL they actually have -- a youtu.be share link, a
// youtube.com/watch?v= link, a vimeo.com/123 link, an open.spotify.com share
// link -- not the exact "/embed/..." form the iframe needs. This converts
// whatever was pasted into the real embeddable URL before validation, so the
// block doesn't silently disappear just because the pasted link wasn't
// already in embed form (confirmed live: a pasted youtu.be link was being
// rejected outright since youtu.be isn't an iframe-embeddable host itself).
// Google Maps/custom are left as-is -- Maps has no ID-based embed URL
// without an API key, so that one still needs the "Share > Embed a map" link.
export function normalizeEmbedUrl(embedType, rawUrl) {
  if (!rawUrl) return '';
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (embedType === 'youtube') {
    let id = '';
    if (parsed.hostname === 'youtu.be') {
      id = parsed.pathname.slice(1);
    } else if (/(^|\.)youtube(-nocookie)?\.com$/.test(parsed.hostname)) {
      if (parsed.pathname === '/watch') id = parsed.searchParams.get('v') || '';
      else if (parsed.pathname.startsWith('/embed/')) id = parsed.pathname.slice('/embed/'.length);
      else if (parsed.pathname.startsWith('/shorts/')) id = parsed.pathname.slice('/shorts/'.length);
    }
    id = id.split('/')[0];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : rawUrl;
  }

  if (embedType === 'vimeo') {
    const match = parsed.pathname.match(/(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : rawUrl;
  }

  if (embedType === 'spotify') {
    if (parsed.hostname === 'open.spotify.com' && !parsed.pathname.startsWith('/embed/')) {
      return `https://open.spotify.com/embed${parsed.pathname}`;
    }
    return rawUrl;
  }

  return rawUrl;
}
