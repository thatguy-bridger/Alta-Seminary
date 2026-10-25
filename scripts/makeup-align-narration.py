"""Find where each verse begins in the Church's narrated recording of a scripture chapter.

Why: the Church publishes a recording of every chapter (a woman's and a man's voice) but no verse timing. To show
the verses lighting up as they are read, this listens to the recording once (offline, on this computer, with the free
whisper.cpp speech tool) and matches the words it hears against the chapter's verse text. Only the start time of each
verse is kept, and it is saved in the database, so every browser just plays an MP3 and reads saved times.

A chapter is kept only if the match is convincing (nearly every word found, every verse anchored, verse lengths
believable). Anything less is skipped: no guessed timing.

Needs: ffmpeg, whisper-cli (brew install whisper-cpp) and a model (ggml-base.en.bin from huggingface.co/ggerganov/whisper.cpp).

  python3 -I scripts/makeup-align-narration.py counts.json out.json --work DIR --model ggml-base.en.bin [--only "Alma 5"]
  python3 -I scripts/makeup-align-narration.py --selftest

counts.json is { "Alma 5": 62, ... }: the lessons that are a whole chapter, and how many verses each has in our database.
out.json gets { "Alma 5": { audio_url, voice, duration, starts: [0.4, 12.9, ...], stats: {...} } or { skipped: "why" } }.
It can be stopped and run again; chapters already in out.json are not redone.
"""
import difflib, json, os, re, subprocess, sys, time, urllib.parse, urllib.request

API = 'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri='
UA = {'User-Agent': 'AltaSeminaryMakeupWork/1.0 (educational; one-time narration timing)'}

BOOKS = {  # the name in a lesson's reference -> the Church's address for it
    '1 Nephi': 'bofm/1-ne', '2 Nephi': 'bofm/2-ne', 'Mosiah': 'bofm/mosiah', 'Alma': 'bofm/alma', 'Helaman': 'bofm/hel', '3 Nephi': 'bofm/3-ne',
    'Ether': 'bofm/ether', 'Moroni': 'bofm/moro', 'D&C': 'dc-testament/dc',
    'Matthew': 'nt/matt', 'Luke': 'nt/luke', 'John': 'nt/john', 'Romans': 'nt/rom', '1 Corinthians': 'nt/1-cor', 'Hebrews': 'nt/heb', 'James': 'nt/james',
    'Psalm': 'ot/ps', 'Isaiah': 'ot/isa', 'Daniel': 'ot/dan', '1 Samuel': 'ot/1-sam', 'Genesis': 'ot/gen', 'Proverbs': 'ot/prov', 'Malachi': 'ot/mal',
    'Moses': 'pgp/moses', 'Abraham': 'pgp/abr', 'Joseph Smith—History': 'pgp/js-h',
}


def church_uri(reference):
    """'Alma 5' -> '/scriptures/bofm/alma/5'. None for a part of a chapter ('Luke 10:25-37'), which a whole recording cannot match."""
    if reference == 'Articles of Faith':
        return '/scriptures/pgp/a-of-f/1'
    m = re.match(r'^(.+?) (\d+)$', reference.strip())
    if not m or m.group(1) not in BOOKS:
        return None
    return f'/scriptures/{BOOKS[m.group(1)]}/{m.group(2)}'


def get(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    data = urllib.request.urlopen(req, timeout=120).read()
    return data if binary else data.decode('utf-8', 'replace')


def verses_of(page_html):
    """The verse texts of a chapter page, without numbers, footnote marks or tags."""
    out = []
    for p in re.findall(r'<p class="verse".*?</p>', page_html, re.S):
        p = re.sub(r'<span class="verse-number">.*?</span>', '', p, flags=re.S)
        p = re.sub(r'<sup\b.*?</sup>', '', p, flags=re.S)
        p = re.sub(r'<[^>]+>', '', p)
        out.append(re.sub(r'\s+', ' ', p.replace('&nbsp;', ' ').replace('&amp;', '&')).strip())
    return out


def tokens(text):
    return re.findall(r'[a-z0-9]+', text.lower().replace('’', '').replace("'", ''))


def heard_words(whisper_json):
    """[(word, start_seconds)] from whisper's word-by-word output."""
    out = []
    for seg in whisper_json.get('transcription', []):
        for w in tokens(seg.get('text', '')):
            out.append((w, seg['offsets']['from'] / 1000.0))
    return out


def align(heard, verses, total_seconds):
    """Where each verse begins, or a reason it cannot be trusted. Returns (starts | None, stats)."""
    ref, verse_of, first_of = [], [], []
    for v, text in enumerate(verses):
        first_of.append(len(ref))
        for t in tokens(text):
            ref.append(t); verse_of.append(v)
    first_of.append(len(ref))
    asr = [w for w, _ in heard]
    blocks = difflib.SequenceMatcher(None, asr, ref, autojunk=False).get_matching_blocks()
    ref_to_asr = {}
    for a, b, size in blocks:
        for k in range(size):
            ref_to_asr[b + k] = a + k
    matched = len(ref_to_asr)
    coverage = matched / max(1, len(ref))
    span = (heard[-1][1] - heard[0][1]) if heard else total_seconds
    per_word = span / max(1, len(heard))

    starts, unanchored = [], 0
    for v in range(len(verses)):
        t = None
        for k, ri in enumerate(range(first_of[v], min(first_of[v] + 12, first_of[v + 1]))):   # the first words of the verse
            if ri in ref_to_asr:
                t = heard[ref_to_asr[ri]][1] - k * per_word
                break
        if t is None:
            unanchored += 1
        starts.append(t)
    stats = {'verses': len(verses), 'words': len(ref), 'matched': matched, 'coverage': round(coverage, 3), 'unanchored': unanchored}
    if coverage < 0.85:
        return None, {**stats, 'why': f'only {coverage:.0%} of the words were found'}
    if unanchored > max(1, len(verses) * 0.02):
        return None, {**stats, 'why': f'{unanchored} verses could not be placed'}
    # fill the rare gap between neighbours, keep order, pre-roll a little so the highlight arrives as the voice does
    for v in range(len(starts)):
        if starts[v] is None:
            before = next((starts[u] for u in range(v - 1, -1, -1) if starts[u] is not None), 0.0)
            after = next((starts[u] for u in range(v + 1, len(starts)) if starts[u] is not None), total_seconds)
            starts[v] = (before + after) / 2
    fixed = []
    for t in starts:
        t = max(0.0, t - 0.15)
        fixed.append(round(max(t, fixed[-1] + 0.2) if fixed else t, 2))
    # believable verse lengths: from about 0.12 to 1.3 seconds a word
    bad = 0
    for v in range(len(verses)):
        end = fixed[v + 1] if v + 1 < len(fixed) else total_seconds
        words = max(1, first_of[v + 1] - first_of[v])
        if not (0.12 * words <= end - fixed[v] <= 1.3 * words + 6):
            bad += 1
    stats['implausible'] = bad
    if bad > max(1, len(verses) * 0.05):
        return None, {**stats, 'why': f'{bad} verses have an unbelievable length'}
    if fixed[-1] >= total_seconds:
        return None, {**stats, 'why': 'the last verse starts after the recording ends'}
    return fixed, stats


def duration_of(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def process(reference, expected, work, model):
    uri = church_uri(reference)
    if not uri:
        return {'skipped': 'not a whole chapter'}
    page = json.loads(get(API + uri))
    verses = verses_of(page['content']['body'])
    if len(verses) != expected:
        return {'skipped': f'the Church page has {len(verses)} verses; the lesson has {expected}'}
    audio = page['meta'].get('audio') or []
    chosen = next((a for a in audio if a.get('variant') == 'female'), audio[0] if audio else None)
    if not chosen:
        return {'skipped': 'the Church has no recording for this chapter'}
    slug = re.sub(r'[^a-z0-9]+', '-', reference.lower()).strip('-')
    mp3, wav, base = (os.path.join(work, f'{slug}.{x}') for x in ('mp3', 'wav', 'words'))
    if not os.path.exists(mp3):
        with open(mp3, 'wb') as f:
            f.write(get(chosen['mediaUrl'], binary=True))
    total = duration_of(mp3)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', mp3, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav], check=True)
    subprocess.run(['whisper-cli', '-m', model, '-f', wav, '-ojf', '-of', base, '-ml', '1', '-sow', '-t', '4', '--no-prints'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    heard = heard_words(json.load(open(base + '.json')))
    starts, stats = align(heard, verses, total)
    for p in (wav, base + '.json'):
        if os.path.exists(p):
            os.remove(p)                                                    # keep the folder small; the mp3 is kept so a rerun is quick
    if starts is None:
        return {'skipped': stats.get('why', 'the match was not convincing'), 'stats': stats}
    return {'audio_url': chosen['mediaUrl'], 'voice': chosen.get('variant', ''), 'duration': round(total), 'starts': starts, 'stats': stats}


def selftest():
    """Checks the matching on made-up chapters: a clean read, a noisy one, and one that must be refused."""
    import random
    random.seed(7)
    words = 'and it came to pass that the people of the land did gather together to hear the word of the lord'.split()
    verses = [' '.join(random.choice(words) + ('s' if random.random() < 0.1 else '') for _ in range(random.randint(12, 30))) for _ in range(40)]
    def read(noise):
        heard, t, truth = [], 3.0, []
        for text in verses:
            truth.append(t)
            for w in tokens(text):
                if random.random() < noise:
                    w = random.choice(words)                                  # misheard
                if random.random() < noise / 2:
                    continue                                                  # missed
                heard.append((w, t)); t += random.uniform(0.25, 0.5)
            t += random.uniform(0.6, 1.1)                                     # the pause between verses
        return heard, truth, t
    heard, truth, total = read(0.03)
    starts, stats = align(heard, verses, total)
    assert starts is not None, stats
    worst = max(abs(a - b) for a, b in zip(starts, truth))
    assert worst < 1.0, f'verse starts are off by {worst:.2f}s'
    assert all(b > a for a, b in zip(starts, starts[1:])), 'starts must increase'
    noisy, _, total2 = read(0.55)
    starts2, stats2 = align(noisy, verses, total2)
    assert starts2 is None and 'why' in stats2, 'a recording the match cannot follow must be refused'
    assert church_uri('Alma 5') == '/scriptures/bofm/alma/5' and church_uri('D&C 76') == '/scriptures/dc-testament/dc/76'
    assert church_uri('Luke 10:25–37') is None and church_uri('Articles of Faith') == '/scriptures/pgp/a-of-f/1' and church_uri('Nope 3') is None
    print(f'self-test passed (worst verse start off by {worst:.2f}s on a clean read; a noisy one was refused: {stats2["why"]})')


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        selftest(); sys.exit(0)
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = {sys.argv[i]: sys.argv[i + 1] for i in range(1, len(sys.argv) - 1) if sys.argv[i].startswith('--')}
    counts = json.load(open(args[0]))
    out_path, work, model = args[1], opts['--work'], opts['--model']
    os.makedirs(work, exist_ok=True)
    results = json.load(open(out_path)) if os.path.exists(out_path) else {}
    for reference, expected in counts.items():
        if opts.get('--only') and reference != opts['--only']:
            continue
        if reference in results:
            continue
        t0 = time.time()
        try:
            results[reference] = process(reference, expected, work, model)
        except Exception as e:  # one bad chapter must not stop the rest
            results[reference] = {'skipped': f'error: {e}'}
        r = results[reference]
        print(f"{reference:28s} {'ok  ' + str(r['stats']['coverage']) if 'starts' in r else 'SKIP ' + r['skipped']}  ({time.time() - t0:.0f}s)", flush=True)
        json.dump(results, open(out_path, 'w'), indent=1)
        time.sleep(0.3)
