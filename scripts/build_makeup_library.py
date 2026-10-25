#!/usr/bin/env python3
"""Builds the starting library of Makeup Work sources into a JSON file (default /tmp/makeup_library.json).

  scriptures  Christ-centered chapters and the seminary reading blocks, from the open-source JSON editions
              at github.com/bcbooks/scriptures-json (2013 text; no footnotes or summaries)
  talks       General Conference talks (text) from the Church's public content API, for the last conferences
  audio       a few talks as audio with REAL timestamped captions (the video's English caption track)

Nothing is hosted by us: audio plays from the Church's own file address; text is stored in our database.
Run:  python3 scripts/build_makeup_library.py [out.json]      (needs network; takes a few minutes)
Then load it with the importer snippet in docs/MAKEUP_WORK_LIBRARY.md. Check rights with the school first:
this copies Church-owned text, which is only OK with their permission.
"""
import json, re, sys, time, html, math, urllib.request, urllib.parse, os

UA = {'User-Agent': 'AltaSeminaryBeta/1.0 (school website; library builder)'}
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/makeup_library.json'
API = 'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri='
RAW = 'https://raw.githubusercontent.com/bcbooks/scriptures-json/master/'
CONFERENCES = [('2026', '04', 'April 2026'), ('2025', '10', 'October 2025'), ('2025', '04', 'April 2025')]
AUDIO_TALKS_PER_CONFERENCE = 6
DELAY = 0.3

def get(url, binary=False, retries=3):
    for i in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                data = r.read(); return data if binary else data.decode('utf-8', 'replace')
        except Exception as e:
            if i == retries - 1: raise
            time.sleep(1.5)

def words(t): return len(re.findall(r'\S+', t))
def minutes_for(t): return max(3, math.ceil(words(t) / 180))

# ---------------- scriptures ----------------
def load_volumes():
    vols = {}
    for key, fn in [('bom', 'book-of-mormon'), ('ot', 'old-testament'), ('nt', 'new-testament'), ('dc', 'doctrine-and-covenants'), ('pgp', 'pearl-of-great-price')]:
        p = f'/tmp/{fn}.json'
        if not os.path.exists(p): open(p, 'w').write(get(RAW + fn + '.json'))
        vols[key] = json.load(open(p))
    return vols

def chapter_verses(vols, vol, book, ch):
    v = vols[vol]
    if vol == 'dc':
        for s in v['sections']:
            if s['section'] == ch: return s['verses']
    for b in v['books']:
        if b['book'] == book:
            for c in b['chapters']:
                if c['chapter'] == ch: return c['verses']
    raise KeyError((vol, book, ch))

def passage_text(vols, vol, book, ch, v1=None, v2=None):
    vs = chapter_verses(vols, vol, book, ch)
    if v1: vs = [x for x in vs if v1 <= x['verse'] <= (v2 or v1)]
    return '\n'.join(f"{x['verse']}  {x['text'].strip()}" for x in vs)

# (volume, book, chapter, v1, v2, reference label, title, series)
BOM, OT, NT, DC, PGP = 'Book of Mormon', 'Old Testament', 'New Testament', 'Doctrine and Covenants', 'Pearl of Great Price'
S = [
 ('bom','1 Nephi',1,None,None,'1 Nephi 1','Lehi’s call',BOM), ('bom','1 Nephi',3,None,None,'1 Nephi 3','“I will go and do”',BOM),
 ('bom','1 Nephi',8,None,None,'1 Nephi 8','Lehi’s dream',BOM), ('bom','1 Nephi',11,None,None,'1 Nephi 11','Nephi sees the life of the Savior',BOM),
 ('bom','2 Nephi',2,None,None,'2 Nephi 2','Redemption through the Holy Messiah',BOM), ('bom','2 Nephi',9,1,29,'2 Nephi 9:1–29','The Atonement of Christ',BOM),
 ('bom','2 Nephi',31,None,None,'2 Nephi 31','The doctrine of Christ',BOM), ('bom','2 Nephi',32,None,None,'2 Nephi 32','Feast upon the words of Christ',BOM),
 ('bom','Mosiah',2,None,None,'Mosiah 2','King Benjamin’s address',BOM), ('bom','Mosiah',3,None,None,'Mosiah 3','The coming of Christ and the Atonement',BOM),
 ('bom','Mosiah',4,None,None,'Mosiah 4','Retain a remission of your sins',BOM), ('bom','Mosiah',5,None,None,'Mosiah 5','Take upon you the name of Christ',BOM),
 ('bom','Alma',5,None,None,'Alma 5','A mighty change of heart',BOM), ('bom','Alma',7,None,None,'Alma 7','He shall be born of Mary',BOM),
 ('bom','Alma',32,None,None,'Alma 32','A seed of faith',BOM), ('bom','Alma',34,None,None,'Alma 34','Prayer and the Atonement',BOM),
 ('bom','Alma',36,None,None,'Alma 36','Alma’s conversion',BOM), ('bom','Helaman',5,None,None,'Helaman 5','Build on the rock of our Redeemer',BOM),
 ('bom','3 Nephi',11,None,None,'3 Nephi 11','The Savior appears to the Nephites',BOM), ('bom','3 Nephi',17,None,None,'3 Nephi 17','“Behold your little ones”',BOM),
 ('bom','3 Nephi',18,None,None,'3 Nephi 18','The sacrament and prayer',BOM), ('bom','Ether',12,None,None,'Ether 12','Faith, hope, and charity',BOM),
 ('bom','Moroni',7,None,None,'Moroni 7','Mormon’s sermon on faith, hope, and charity',BOM), ('bom','Moroni',10,None,None,'Moroni 10','Moroni’s promise',BOM),
 ('nt','Matthew',5,None,None,'Matthew 5','The Beatitudes',NT), ('nt','Matthew',6,None,None,'Matthew 6','Prayer, fasting, and treasures in heaven',NT),
 ('nt','Matthew',7,None,None,'Matthew 7','Ask, seek, knock, and build on the rock',NT), ('nt','Matthew',25,None,None,'Matthew 25','The ten virgins, the talents, and the least of these',NT),
 ('nt','Luke',2,None,None,'Luke 2','The birth of Jesus Christ',NT), ('nt','Luke',10,25,37,'Luke 10:25–37','The good Samaritan',NT),
 ('nt','Luke',15,None,None,'Luke 15','The lost sheep, coin, and son',NT), ('nt','Luke',22,1,20,'Luke 22:1–20','The Last Supper',NT),
 ('nt','Luke',24,None,None,'Luke 24','He is risen',NT), ('nt','John',1,None,None,'John 1','In the beginning was the Word',NT),
 ('nt','John',3,None,None,'John 3','Born again; God so loved the world',NT), ('nt','John',10,None,None,'John 10','The Good Shepherd',NT),
 ('nt','John',11,None,None,'John 11','The raising of Lazarus',NT), ('nt','John',14,None,None,'John 14','“Let not your heart be troubled”',NT),
 ('nt','John',15,None,None,'John 15','The vine and the branches',NT), ('nt','John',17,None,None,'John 17','The Savior’s intercessory prayer',NT),
 ('nt','Romans',8,None,None,'Romans 8','Heirs of God and joint-heirs with Christ',NT), ('nt','1 Corinthians',13,None,None,'1 Corinthians 13','Charity never faileth',NT),
 ('nt','Hebrews',11,None,None,'Hebrews 11','Faith',NT), ('nt','James',1,None,None,'James 1','If any of you lack wisdom',NT),
 ('ot','Psalms',23,None,None,'Psalm 23','The Lord is my shepherd',OT), ('ot','Psalms',24,None,None,'Psalm 24','Who shall ascend into the hill of the Lord?',OT),
 ('ot','Isaiah',53,None,None,'Isaiah 53','Surely he hath borne our griefs',OT), ('ot','Isaiah',9,None,None,'Isaiah 9','Unto us a child is born',OT),
 ('ot','Daniel',3,None,None,'Daniel 3','The fiery furnace',OT), ('ot','Daniel',6,None,None,'Daniel 6','Daniel in the lions’ den',OT),
 ('ot','1 Samuel',17,None,None,'1 Samuel 17','David and Goliath',OT), ('ot','Genesis',39,None,None,'Genesis 39','Joseph in Potiphar’s house',OT),
 ('ot','Proverbs',3,None,None,'Proverbs 3','Trust in the Lord with all thine heart',OT), ('ot','Malachi',3,None,None,'Malachi 3','The messenger and the law of tithing',OT),
 ('dc',None,1,None,None,'D&C 1','The Lord’s preface',DC), ('dc',None,4,None,None,'D&C 4','A marvelous work is about to come forth',DC),
 ('dc',None,6,None,None,'D&C 6','Seek to bring forth and establish Zion',DC), ('dc',None,18,None,None,'D&C 18','The worth of souls is great',DC),
 ('dc',None,19,None,None,'D&C 19','Christ’s suffering and call to repent',DC), ('dc',None,46,None,None,'D&C 46','The gifts of the Spirit',DC),
 ('dc',None,64,None,None,'D&C 64','Forgive one another',DC), ('dc',None,76,None,None,'D&C 76','The vision of the degrees of glory',DC),
 ('dc',None,84,None,None,'D&C 84','The oath and covenant of the priesthood',DC), ('dc',None,88,None,None,'D&C 88','Light and truth',DC),
 ('dc',None,89,None,None,'D&C 89','The Word of Wisdom',DC), ('dc',None,93,None,None,'D&C 93','Grace for grace',DC),
 ('dc',None,110,None,None,'D&C 110','The Savior appears in the Kirtland Temple',DC), ('dc',None,121,None,None,'D&C 121','From Liberty Jail',DC),
 ('dc',None,122,None,None,'D&C 122','All these things shall give thee experience',DC), ('dc',None,123,None,None,'D&C 123','Our duty to record and testify',DC),
 ('pgp','Moses',1,None,None,'Moses 1','Moses sees God',PGP), ('pgp','Moses',7,None,None,'Moses 7','Enoch and the city of Zion',PGP),
 ('pgp','Abraham',3,None,None,'Abraham 3','Abraham and the premortal life',PGP), ('pgp','Joseph Smith—History',1,None,None,'Joseph Smith—History 1','The First Vision',PGP),
 ('pgp','Articles of Faith',1,None,None,'Articles of Faith','The Articles of Faith',PGP),
]

def scripture_sources(vols):
    out = []
    for i, (vol, book, ch, v1, v2, ref, title, series) in enumerate(S):
        try: body = passage_text(vols, vol, book, ch, v1, v2)
        except KeyError as e: print('  MISSING', ref, e); continue
        out.append(dict(kind='scripture', title=title, reference=ref, description=f'{series}', body=body, minutes=minutes_for(body),
                        author=None, series=series, origin_url=f'scriptures-json:{vol}:{ref}', sort_order=i))
    return out

# ---------------- conference talks ----------------
def clean_text(frag):
    frag = re.sub(r'<sup[^>]*class="[^"]*marker[^"]*"[^>]*>.*?</sup>', '', frag, flags=re.S)
    frag = re.sub(r'<a[^>]*class="[^"]*note-ref[^"]*"[^>]*>.*?</a>', '', frag, flags=re.S)
    frag = re.sub(r'<br\s*/?>', ' ', frag)
    frag = re.sub(r'<[^>]+>', '', frag)
    return re.sub(r'\s+', ' ', html.unescape(frag)).strip()

def talk_body(page_html):
    m = re.search(r'<div class="body-block">(.*?)</div>\s*(?:<footer|</div>\s*$|$)', page_html, re.S)
    block = m.group(1) if m else page_html
    parts = []
    for tag, inner in re.findall(r'<(p|h2|h3)\b[^>]*>(.*?)</\1>', block, re.S):
        t = clean_text(inner)
        if t: parts.append(t)
    return '\n\n'.join(parts)

def list_talks(y, m):
    d = json.loads(get(API + f'/general-conference/{y}/{m}'))
    body = d['content']['body']
    talks = []
    for href, inner in re.findall(r'<a[^>]*href="(/study/general-conference/%s/%s/[^"?]+)[^"]*"[^>]*>(.*?)</a>' % (y, m), body, re.S):
        slug = href.rsplit('/', 1)[1]
        if 'session' in slug or not re.match(r'^\d', slug): continue
        parts = [clean_text(x) for x in re.split(r'</(?:p|div|span|h\d)>', inner)]
        parts = [p for p in parts if p]
        if len(parts) >= 2: talks.append(dict(slug=slug, speaker=parts[0], title=parts[1], summary=parts[2] if len(parts) > 2 else ''))
    seen, uniq = set(), []
    for t in talks:
        if t['slug'] not in seen: seen.add(t['slug']); uniq.append(t)
    return uniq

SKIP_TITLE = re.compile(r'^(sustaining|opening remarks|closing remarks|church auditing|statistical|report of|introduction|solemn assembly)', re.I)

def parse_vtt(text):
    segs = []
    for block in re.split(r'\n\n+', text.replace('\r', '')):
        lines = [l for l in block.split('\n') if l.strip()]
        ti = next((i for i, l in enumerate(lines) if '-->' in l), None)
        if ti is None: continue
        a, b = [x.strip().split()[0] for x in lines[ti].split('-->')]
        def sec(s):
            p = s.replace(',', '.').split(':'); p = [float(x) for x in p]
            return p[0]*3600+p[1]*60+p[2] if len(p) == 3 else p[0]*60+p[1]
        t = clean_text(' '.join(lines[ti+1:]))
        if t: segs.append({'start': round(sec(a), 2), 'end': round(sec(b), 2), 'text': t})
    return segs

def captions_for(video_m3u8):
    master = get(video_m3u8)  # follows the redirect to the signed manifest
    sub = re.search(r'TYPE=SUBTITLES[^\n]*LANGUAGE="en"[^\n]*URI="([^"]+)"', master) or re.search(r'TYPE=SUBTITLES[^\n]*NAME="English"[^\n]*URI="([^"]+)"', master)
    if not sub: return []
    playlist = get(sub.group(1))
    segs_urls = [l.strip() for l in playlist.split('\n') if l.strip().startswith('http')]
    segs = []
    for u in segs_urls:
        segs += parse_vtt(get(u)); time.sleep(0.05)
    seen, out = set(), []
    for s in sorted(segs, key=lambda x: x['start']):
        k = (s['start'], s['text'])
        if k not in seen: seen.add(k); out.append(s)
    return out

def talk_sources(audio_budget):
    text_items, av_items = [], []
    order = 1000
    for (y, m, label) in CONFERENCES:
        talks = [t for t in list_talks(y, m) if not SKIP_TITLE.match(t['title'])]
        print(f'{label}: {len(talks)} talks'); av_done = 0
        for t in talks:
            time.sleep(DELAY)
            try: d = json.loads(get(API + f"/general-conference/{y}/{m}/{t['slug']}"))
            except Exception as e: print('  skip', t['slug'], e); continue
            page = d['content']['body']; body = talk_body(page)
            if words(body) < 400: continue
            url = f"https://www.churchofjesuschrist.org/study/general-conference/{y}/{m}/{t['slug']}?lang=eng"
            series = f'{label} general conference'
            ref = f"{t['speaker']}, {label} general conference"
            order += 1
            text_items.append(dict(kind='talk', title=t['title'], reference=ref, description=t['summary'] or None, body=body, minutes=minutes_for(body),
                                   author=t['speaker'], series=series, origin_url=url, sort_order=order))
            audio = (d['meta'].get('audio') or [{}])[0].get('mediaUrl')
            vid = re.search(r'<source src="(https://mediasrv[^"]+\.m3u8)"', page)
            dur = re.search(r'data-duration="(\d+)"', page)
            if audio and vid and dur and av_done < audio_budget and int(dur.group(1)) < 15*60*1000:
                try:
                    caps = captions_for(vid.group(1))
                    if len(caps) > 20:
                        seconds = round(int(dur.group(1)) / 1000)
                        av_items.append(dict(kind='audio', title=t['title'], reference=ref, description=(t['summary'] or '') + ' (audio, with captions)', body=None,
                                             embed_url=audio, minutes=max(3, math.ceil(seconds / 60)), duration_seconds=seconds, transcript=caps,
                                             author=t['speaker'], series=series, origin_url=url + '#audio', sort_order=order + 5000))
                        av_done += 1; print(f"  + audio {t['title'][:50]} ({len(caps)} caption lines)")
                except Exception as e: print('  captions failed', t['slug'], e)
    return text_items, av_items

if __name__ == '__main__':
    vols = load_volumes()
    sc = scripture_sources(vols); print(len(sc), 'scripture sources')
    texts, avs = talk_sources(AUDIO_TALKS_PER_CONFERENCE)
    lib = sc + texts + avs
    json.dump(lib, open(OUT, 'w'), ensure_ascii=False)
    print(f'wrote {len(lib)} sources ({len(sc)} scriptures, {len(texts)} talks, {len(avs)} audio) to {OUT}, {os.path.getsize(OUT)//1024} kB')
