"""Find the official YouTube video for each conference talk in the Makeup Work library.

Why: the Watch lessons play from YouTube (the Church's own "General Conference of The
Church of Jesus Christ" channel). The captions in the library were taken from the Church's
own video, so a YouTube video only lines up with them if it is the SAME recording. This
script accepts a match only when all three are true:
  - the channel is the Church's,
  - the title contains the talk's title,
  - the length is within a few seconds of the length stored for the talk.

Input (JSON list):  [{"id": "<source id>", "title": "...", "author": "...",
                      "series": "April 2025 general conference", "duration_seconds": 696}, ...]
Output (JSON map):  { "<source id>": {"id": "<YouTube id>", "title": ..., "channel": ..., "length": "11:36", "diff": 0}
                      or {"error": ...} }

Usage:  python3 -I scripts/makeup-find-youtube.py talks.json matches.json

This reads YouTube's public search page (there is no key to manage), so it can break if YouTube
changes that page. Check the output, then confirm each video allows embedding:
  https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=<id>   (200 = embeddable)
Add the Watch lessons with SQL that copies the transcript from the matching audio row, so no caption
data has to be re-fetched.
"""
import json, re, sys, time, urllib.parse, urllib.request

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
CHANNEL = 'church of jesus christ'
LENGTH_TOLERANCE_SECONDS = 3


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9'})
    return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')


def norm(s):
    return re.sub(r'[^a-z0-9 ]', '', s.lower().replace('’', "'").replace('“', '').replace('”', ''))


def seconds(txt):
    parts = [int(x) for x in txt.split(':')]
    return sum(v * 60 ** i for i, v in enumerate(reversed(parts)))


def search(query):
    html = get('https://www.youtube.com/results?search_query=' + urllib.parse.quote(query))
    data = json.loads(re.search(r'var ytInitialData = (\{.*?\});</script>', html, re.S).group(1))
    found = []

    def walk(o):
        if isinstance(o, dict):
            if 'videoRenderer' in o:
                v = o['videoRenderer']
                try:
                    found.append(dict(id=v['videoId'], title=''.join(r['text'] for r in v['title']['runs']),
                                      channel=''.join(r['text'] for r in v['ownerText']['runs']),
                                      length=v.get('lengthText', {}).get('simpleText', '')))
                except KeyError:
                    pass
            for x in o.values():
                walk(x)
        elif isinstance(o, list):
            for x in o:
                walk(x)

    walk(data)
    return found


def best_match(talk, candidates):
    best = None
    for c in candidates:
        if CHANNEL not in c['channel'].lower() or norm(talk['title']) not in norm(c['title']) or not c['length']:
            continue
        diff = abs(seconds(c['length']) - talk['duration_seconds'])
        if diff <= LENGTH_TOLERANCE_SECONDS and (best is None or diff < best['diff']):
            best = dict(c, diff=diff)
    return best


if __name__ == '__main__':
    talks = json.load(open(sys.argv[1]))
    result = {}
    for t in talks:
        month_year = t['series'].replace(' general conference', '')
        query = f"{t['title']} {t['author']} {month_year} general conference"
        try:
            match = best_match(t, search(query))
        except Exception as e:  # YouTube sometimes returns a page without the data; run those again
            result[t['id']] = dict(error=str(e))
            print(t['title'][:40].ljust(40), '-> error', e)
            continue
        result[t['id']] = match or dict(error='no match')
        print(t['title'][:40].ljust(40), '->', (match['id'], match['length'], 'diff', match['diff']) if match else 'NO MATCH')
        time.sleep(1.2)
    json.dump(result, open(sys.argv[2], 'w'), indent=1)
