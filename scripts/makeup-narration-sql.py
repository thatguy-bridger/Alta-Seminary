"""Turn the narration timing from makeup-align-narration.py into SQL that adds a "Listen" lesson for each chapter.

Each new lesson is a copy of the chapter's reading lesson (same title, collection and picture) whose audio is the Church's
recording and whose transcript is the chapter's verses, each with the time it begins. The verse text comes from the reading
lesson's own text (one verse per line), so only the start times travel in the SQL. A chapter is only added if the number of
times equals the number of verse lines.

  python3 -I scripts/makeup-narration-sql.py out.json > add-narration.sql
"""
import json, sys

results = json.load(open(sys.argv[1]))
rows = []
for reference, r in results.items():
    if 'starts' not in r:
        continue
    tenths = ','.join(str(round(t * 10)) for t in r['starts'])        # a tenth of a second is plenty for where a verse begins
    rows.append("  ('%s', '%s', %d, '%s')" % (reference.replace("'", "''"), r['audio_url'], r['duration'], tenths))

print("""insert into public.makeup_sources (kind, title, reference, description, embed_url, minutes, duration_seconds, transcript, series, origin_url, sort_order, thumbnail_url, one_time, active)
select 'audio', s.title, s.reference, 'Listen to the chapter read aloud, with each verse lighting up as it is read.', e.url,
       greatest(1, ceil(e.dur / 60.0))::int, e.dur,
       (select jsonb_agg(jsonb_build_object('start', (e.tenths[l.i] / 10.0)::float8, 'end', (coalesce(e.tenths[l.i + 1], e.dur * 10) / 10.0)::float8, 'text', regexp_replace(l.line, '^(\\d+)\\s+', '\\1 ')) order by l.i)
          from unnest(string_to_array(s.body, E'\\n')) with ordinality as l(line, i)),
       s.series, e.url, s.sort_order + 20000, s.thumbnail_url, false, true
from (select reference, url, dur, string_to_array(st, ',')::int[] as tenths from (values""")
print(',\n'.join(rows))
print(""") as v(reference, url, dur, st)) e
join public.makeup_sources s on s.kind = 'scripture' and s.reference = e.reference
where array_length(e.tenths, 1) = array_length(string_to_array(s.body, E'\\n'), 1)
on conflict do nothing
returning reference, jsonb_array_length(transcript) as verses, duration_seconds;""")
print('-- %d chapters' % len(rows), file=sys.stderr)
