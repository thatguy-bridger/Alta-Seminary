import { thumbnailFor } from '../../makeup/thumbnails.js';
import { ensureInLibrary } from './imageLibrary.js';

const CREDIT = { church: 'The Church of Jesus Christ of Latter-day Saints', youtube: 'YouTube', custom: '' };
const TAGS = { church: ['lesson', 'church', 'linked'], youtube: ['lesson', 'video', 'youtube', 'linked'], custom: ['lesson', 'linked'] };

// When a lesson is saved, make sure the picture it shows is in the image library if it only lives on another website (the Church's own
// picture for a talk, YouTube's picture for a video, or an address pasted in). Paintings and uploads are already there. Never blocks the save.
export function registerLessonPicture(db, lesson) {
  const pic = thumbnailFor(lesson);
  if (pic.source === 'painting') return Promise.resolve({ added: false });
  return ensureInLibrary(db, pic.src, {
    title: lesson.title || '', description: `The picture shown for the lesson “${lesson.title || 'untitled'}”.`,
    credit: CREDIT[pic.source] || '', tags: TAGS[pic.source] || ['lesson', 'linked'],
    license: pic.source === 'custom' ? 'Linked from another website, not copied.' : `Linked from ${pic.source === 'church' ? 'churchofjesuschrist.org' : 'YouTube'}, not copied.`,
    source_url: lesson.origin_url || lesson.embed_url || null,
  });
}
