// A painting of the Savior at each step of the journey, so the whole experience stays centered on Him.
// All are public-domain paintings (Wikimedia Commons), cropped to a banner. Credits are shown with each.
export const ART = {
  begin:      { src: '/makeup/art/begin.webp',      title: 'Christ in Gethsemane', artist: 'Carl Heinrich Bloch', year: '1873', alt: 'Painting of Jesus Christ kneeling in prayer in the Garden of Gethsemane, comforted by an angel.' },
  choose:     { src: '/makeup/art/choose.webp',     title: 'Sermon on the Mount', artist: 'Carl Heinrich Bloch', year: '1877', alt: 'Painting of Jesus Christ teaching a gathered crowd on a hillside.' },
  learn:      { src: '/makeup/art/learn.webp',      title: 'Christ Healing the Sick at Bethesda', artist: 'Carl Heinrich Bloch', year: '1883', alt: 'Painting of Jesus Christ at the pool of Bethesda, reaching out to a man who is sick.' },
  truth:      { src: '/makeup/art/truth.webp',      title: 'Christ and the Rich Young Ruler', artist: 'Heinrich Hofmann', year: '1889', alt: 'Painting of Jesus Christ speaking with a young man, with an open hand extended toward him.' },
  understand: { src: '/makeup/art/understand.webp', title: 'Suffer the Children to Come unto Me', artist: 'Carl Heinrich Bloch', year: '', alt: 'Painting of Jesus Christ seated with children gathered close around him.' },
  commit:     { src: '/makeup/art/commit.webp',     title: 'Christ', artist: 'Heinrich Hofmann', year: '1889', alt: 'Portrait painting of Jesus Christ looking gently out of the frame.' },
  done:       { src: '/makeup/art/done.webp',       title: 'The Resurrection', artist: 'Carl Heinrich Bloch', year: '', alt: 'Painting of the risen Jesus Christ standing in the tomb with his arms raised, with angels beside him.' },
};
export const artFor = (step) => ART[step] || null;
export const artCredit = (a) => `${a.title}, ${a.artist}${a.year ? `, ${a.year}` : ''}`;
