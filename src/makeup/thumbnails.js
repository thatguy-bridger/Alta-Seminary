import { youtubeId } from './media.js';

// A picture for every lesson, so a lesson is easy to recognise in the admin and at the top of the student's lesson.
// In order of preference:
//   1. the picture an admin chose (thumbnail_url: an upload, or a link such as the Church's own talk image)
//   2. a YouTube video's own picture
//   3. a public-domain painting of the Savior, chosen from the set below (the same one every time for a lesson)
// All paintings are public domain (Wikimedia Commons), cropped to a wide frame.
export const PAINTINGS = [
  { id: 'bethesda-bloch', title: 'Christ Healing the Sick at Bethesda', artist: 'Carl Heinrich Bloch', year: '1883', alt: 'Painting of Jesus Christ gesturing to the sick gathered at the pool of Bethesda' },
  { id: 'blind-bloch', title: 'Christ Healing the Blind Man', artist: 'Carl Heinrich Bloch', year: '1871', alt: 'Painting of Jesus Christ reaching out to a blind man' },
  { id: 'christ-hofmann', title: 'Christ', artist: 'Heinrich Hofmann', year: '1889', alt: 'Portrait painting of the face of Jesus Christ' },
  { id: 'emmaus-bloch', title: 'Supper at Emmaus', artist: 'Carl Heinrich Bloch', year: '1870', alt: 'Painting of the risen Jesus Christ at supper with two disciples' },
  { id: 'gethsemane-bloch', title: 'Christ in Gethsemane', artist: 'Carl Heinrich Bloch', year: '1873', alt: 'Painting of Jesus Christ kneeling in prayer with an angel beside Him' },
  { id: 'gethsemane-hofmann', title: 'Christ in Gethsemane', artist: 'Heinrich Hofmann', year: '1886', alt: 'Painting of Jesus Christ looking up in prayer in the garden' },
  { id: 'resurrection-bloch', title: 'The Resurrection', artist: 'Carl Heinrich Bloch', year: '', alt: 'Painting of the risen Jesus Christ standing in the tomb with raised arms' },
  { id: 'ruler-hofmann', title: 'Christ and the Rich Young Ruler', artist: 'Heinrich Hofmann', year: '1889', alt: 'Painting of Jesus Christ speaking with a young man' },
  { id: 'sermon-bloch', title: 'Sermon on the Mount', artist: 'Carl Heinrich Bloch', year: '1877', alt: 'Painting of Jesus Christ teaching a crowd on a hillside' },
  { id: 'well-bloch', title: 'Christ and the Woman at the Well', artist: 'Carl Heinrich Bloch', year: '', alt: 'Painting of Jesus Christ speaking with a woman at a well' },
  { id: 'children-bloch', title: 'Suffer the Children to Come unto Me', artist: 'Carl Heinrich Bloch', year: '', alt: 'Painting of Jesus Christ seated with children beside Him' },
].map((p) => ({ ...p, src: `/makeup/thumbs/${p.id}.webp` }));

export const paintingById = (id) => PAINTINGS.find((p) => p.id === id) || null;
export const paintingCredit = (p) => `${p.title}, ${p.artist}${p.year ? `, ${p.year}` : ''}`;

// Small, stable number from text, so a lesson always gets the same painting.
export function hashString(s) {
  let h = 2166136261;
  for (const ch of String(s ?? '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const paintingFor = (key) => PAINTINGS[hashString(key) % PAINTINGS.length];

// Only addresses that are safe to put in an image tag: a web address, or one of our own files.
export const isSafeImageUrl = (u) => /^https:\/\/\S+$/i.test(String(u || '').trim()) || /^\/[^/\s]\S*$/.test(String(u || '').trim());

const CHURCH_IMAGE = /^https:\/\/(www\.)?churchofjesuschrist\.org\//i;

// -> { src, source: 'custom' | 'church' | 'youtube' | 'painting', painting? }
export function thumbnailFor(lesson) {
  const custom = String(lesson?.thumbnail_url || '').trim();
  if (custom && isSafeImageUrl(custom)) {
    if (CHURCH_IMAGE.test(custom)) return { src: custom, source: 'church' };
    const chosen = custom.startsWith('/makeup/thumbs/') ? paintingById(custom.split('/').pop().replace(/\.webp$/, '')) : null;
    return chosen ? { src: custom, source: 'painting', painting: chosen } : { src: custom, source: 'custom' };
  }
  const yt = lesson?.embed_url ? youtubeId(lesson.embed_url) : null;
  if (yt) return { src: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, source: 'youtube' };
  const painting = paintingFor(lesson?.id || lesson?.title || '');
  return { src: painting.src, source: 'painting', painting };
}

export const THUMBNAIL_SOURCE_LABEL = { custom: 'Your picture', church: 'The Church\'s own picture', youtube: 'YouTube picture (automatic)', painting: 'Painting' };
