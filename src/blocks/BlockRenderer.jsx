import React from 'react';
import { HeroBlock } from './HeroBlock.jsx';
import { RichTextBlock } from './RichTextBlock.jsx';
import { ImageBlock } from './ImageBlock.jsx';
import { ImageTextBlock } from './ImageTextBlock.jsx';
import { ButtonBlock } from './ButtonBlock.jsx';
import { ColumnsBlock } from './ColumnsBlock.jsx';
import { QuoteBlock } from './QuoteBlock.jsx';
import { DividerBlock } from './DividerBlock.jsx';
import { EmbedBlock } from './EmbedBlock.jsx';
import { CarouselBlock } from './CarouselBlock.jsx';
import { SocialLinksBlock } from './SocialLinksBlock.jsx';
import { DownloadBlock } from './DownloadBlock.jsx';
import { AnnouncementBannerBlock } from './AnnouncementBannerBlock.jsx';
import { DirectoryTeaserBlock } from './DirectoryTeaserBlock.jsx';
import { EventsTeaserBlock } from './EventsTeaserBlock.jsx';
import { PostsTeaserBlock } from './PostsTeaserBlock.jsx';
import { GalleryBlock } from './GalleryBlock.jsx';
import { ContactFormBlock } from './ContactFormBlock.jsx';
import { FaqBlock } from './FaqBlock.jsx';
import { BackgroundMusicBlock } from './BackgroundMusicBlock.jsx';
import { BackToTopBlock } from './BackToTopBlock.jsx';
import { TimedPopupBlock } from './TimedPopupBlock.jsx';
import { SiteEffectBlock } from './SiteEffectBlock.jsx';
import { BlockWrapper } from './BlockWrapper.jsx';
import { BLOCK_REGISTRY } from './registry.js';

// The one component-per-type map used both by Astro's build (server-rendered,
// no client JS shipped for it), the admin Preview tab, and the interactive
// edit canvas (src/admin-app/builder/EditableCanvas.jsx) -- never fork this
// per context; each component optionally accepts `editable`/`onFieldChange`
// (see build plan "Rendering" section + the on-canvas editing addendum).
export const BLOCK_COMPONENTS = {
  hero: HeroBlock,
  'rich-text': RichTextBlock,
  image: ImageBlock,
  'image-text': ImageTextBlock,
  button: ButtonBlock,
  columns: ColumnsBlock,
  quote: QuoteBlock,
  divider: DividerBlock,
  embed: EmbedBlock,
  carousel: CarouselBlock,
  'social-links': SocialLinksBlock,
  download: DownloadBlock,
  'announcement-banner': AnnouncementBannerBlock,
  'directory-teaser': DirectoryTeaserBlock,
  'events-teaser': EventsTeaserBlock,
  'posts-teaser': PostsTeaserBlock,
  gallery: GalleryBlock,
  'contact-form': ContactFormBlock,
  faq: FaqBlock,
  'background-music': BackgroundMusicBlock,
  'back-to-top': BackToTopBlock,
  'timed-popup': TimedPopupBlock,
  'site-effect': SiteEffectBlock,
};

// teaserData: optional {[blockId]: items[]} map -- pre-fetched server-side by
// Astro public pages for directory-teaser/events-teaser/posts-teaser blocks (see
// src/lib/pages.js resolveTeaserData). Admin canvas/preview omit it and let
// those two block types fetch their own data client-side instead.
export function BlockRenderer({ blocks, teaserData = {} }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  return (
    <div>
      {blocks.map((block) => {
        const Component = BLOCK_COMPONENTS[block.type];
        if (!Component) return null;
        const extra = teaserData && teaserData[block.id] !== undefined ? { items: teaserData[block.id] } : {};
        const content = <Component {...block.props} {...extra} blockId={block.id} />;
        // See EditableCanvas.jsx's identical check -- a chromeless block
        // (Background Music) renders no visible content at this position,
        // so BlockWrapper's spacing padding would just be an empty gap.
        if (BLOCK_REGISTRY[block.type]?.chromeless) return <React.Fragment key={block.id}>{content}</React.Fragment>;
        return (
          <BlockWrapper key={block.id} layout={block.layout}>
            {content}
          </BlockWrapper>
        );
      })}
    </div>
  );
}
