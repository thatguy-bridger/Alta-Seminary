import React from 'react';
import { Button } from '../../../design-system/components/forms/Button.jsx';
import { parseTranscript, formatTimestamp, segmentsToVtt } from '../../../makeup/transcript.js';

// A transcript is also the captions for anyone who cannot hear, so it is required for video and audio.
// An existing one can be opened as text and edited line by line; a new one can be pasted or uploaded (.vtt or .srt).
export function TranscriptBox({ segments, lines, raw, setRaw, error }) {
  const editing = raw !== null || lines === 0;
  const value = raw ?? '';
  const parsed = React.useMemo(() => (editing && value.trim() ? parseTranscript(value) : null), [editing, value]);
  async function onFile(e) { const f = e.target.files?.[0]; if (f) setRaw(await f.text()); e.target.value = ''; }

  if (!editing) {
    const first = segments[0], last = segments[segments.length - 1];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <p className="ls-help" style={{ color: 'var(--color-success)' }}>
          ✓ A transcript with {lines} lines{first && last ? `, ${formatTimestamp(first.start)} to ${formatTimestamp(last.end)}` : ''}.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={() => setRaw(segmentsToVtt(segments))}>Edit the transcript as text</Button>
          <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>Replace from a caption file<input type="file" accept=".vtt,.srt,text/vtt" onChange={onFile} style={{ display: 'none' }} /></label>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {lines === 0 && raw === null && <p className="ls-help">No transcript yet. Paste or upload one so students can read along and the lesson can be shown.</p>}
      <label className="ls-lbl">Transcript (WebVTT or SRT: a time, then the words)
        <textarea className="input" rows={12} value={value} onChange={(e) => setRaw(e.target.value)} style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 400 }}
          placeholder={'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nFirst line of the talk…'} />
      </label>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>Upload a caption file<input type="file" accept=".vtt,.srt,text/vtt" onChange={onFile} style={{ display: 'none' }} /></label>
        {lines > 0 && <Button variant="ghost" size="sm" onClick={() => setRaw(null)}>Cancel, keep the current transcript</Button>}
      </div>
      {parsed && (
        <p role="status" className={error || parsed.errors.length ? 'ls-err' : 'ls-help'} style={!error && !parsed.errors.length ? { color: 'var(--color-success)' } : undefined}>
          {parsed.segments.length} line{parsed.segments.length === 1 ? '' : 's'} read{parsed.segments.length ? `, ${formatTimestamp(parsed.segments[0].start)} to ${formatTimestamp(parsed.segments[parsed.segments.length - 1].end)}` : ''}.{' '}
          {[...parsed.errors.slice(0, 1), ...(error && !parsed.errors.length ? [error] : [])].join(' ')}
        </p>
      )}
    </div>
  );
}
