import { analyzeEffort, formatDuration } from './effort.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Builds the note a teacher receives. Pure, so it can be tested, and the same
// function backs the preview in the admin.
export function composeTeacherEmail(sub) {
  const effort = analyzeEffort({ mode: sub.mode, text: sub.response, voiceSeconds: sub.voice_seconds, stats: {
    pastes: sub.paste_attempts, jumps: sub.sudden_jumps, activeMs: (sub.active_seconds || 0) * 1000, typedChars: sub.typed_chars, leaves: sub.page_leaves,
  } });
  const dayLine = sub.days_total > 1 ? `Day ${sub.day_number} of ${sub.days_total}` : 'Single day';
  const words = sub.mode === 'voice'
    ? `(Spoken response, ${formatDuration(sub.voice_seconds || 0)})`
    : sub.response;
  const subject = `Makeup work from ${sub.student_name} (${sub.class_name})`;
  const text = [
    `${sub.student_name} finished makeup work for ${sub.class_name}.`,
    `${dayLine} · learned by ${sub.source_title || 'a lesson'} · ${formatDuration(sub.active_seconds || 0)} active`,
    '',
    'What stood out to them:',
    words,
    '',
    'What they will do:',
    sub.commitment,
    '',
    `Signal: ${effort.label}`,
    ...effort.reasons.map((r) => `- ${r}`),
  ].join('\n');
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;line-height:1.5;color:#1a1a1d">
<p><strong>${esc(sub.student_name)}</strong> finished makeup work for ${esc(sub.class_name)}.</p>
<p style="color:#5d5e66;font-size:14px">${esc(dayLine)} · learned by ${esc(sub.source_title || 'a lesson')} · ${esc(formatDuration(sub.active_seconds || 0))} active</p>
<h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5d5e66;margin-bottom:4px">What stood out to them</h3>
<p style="white-space:pre-wrap;margin-top:0">${esc(words)}</p>
<h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5d5e66;margin-bottom:4px">What they will do</h3>
<p style="margin-top:0">${esc(sub.commitment)}</p>
<p style="padding:10px 14px;border-radius:10px;background:${effort.ok ? '#e6f4ec' : '#fbf1dc'}"><strong>${esc(effort.label)}</strong><br>${effort.reasons.map(esc).join('<br>')}</p></div>`;
  return { subject, text, html, effort };
}
