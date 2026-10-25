import { analyzeEffort, formatDuration } from './effort.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Builds the note a teacher receives. Pure, so it can be tested, and the same
// function backs the preview in the admin.
export function composeTeacherEmail(sub) {
  const effort = analyzeEffort({ mode: sub.mode, text: sub.response, voiceSeconds: sub.voice_seconds, stats: {
    pastes: sub.paste_attempts, jumps: sub.sudden_jumps, activeMs: (sub.active_seconds || 0) * 1000, typedChars: sub.typed_chars, leaves: sub.page_leaves,
  } });
  const dayLine = sub.days_total > 1 ? `Covers ${sub.days_total} days` : 'Covers 1 day';
  const learned = (sub.source_titles && sub.source_titles.length ? sub.source_titles.join(', ') : sub.source_title) || 'a lesson';
  const words = sub.mode === 'voice'
    ? `(Spoken response, ${formatDuration(sub.voice_seconds || 0)})`
    : sub.response;
  const subject = `Makeup work from ${sub.student_name} (${sub.class_name})`;
  const text = [
    `${sub.student_name} finished makeup work for ${sub.class_name}.`,
    `${dayLine} · learned by ${learned} · ${formatDuration(sub.active_seconds || 0)} active`,
    '',
    `A truth they found${sub.truth_ref ? ` (${sub.truth_ref})` : ''}:`,
    sub.truth,
    '',
    'How it could help someone their age:',
    sub.mode === 'voice' ? '(Included in the spoken response.)' : sub.understanding,
    '',
    'Why it matters to them:',
    words,
    '',
    `What they will do${sub.commit_kind ? ` (${sub.commit_kind})` : ''}:`,
    sub.commitment,
    ...(sub.blessing ? ['', 'How it will bless their life:', sub.blessing] : []),
    '',
    `Signal: ${effort.label}`,
    ...effort.reasons.map((r) => `- ${r}`),
  ].join('\n');
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;line-height:1.5;color:#1a1a1d">
<p><strong>${esc(sub.student_name)}</strong> finished makeup work for ${esc(sub.class_name)}.</p>
<p style="color:#5d5e66;font-size:14px">${esc(dayLine)} · learned by ${esc(learned)} · ${esc(formatDuration(sub.active_seconds || 0))} active</p>
<h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5d5e66;margin-bottom:4px">A truth they found${sub.truth_ref ? ` (${esc(sub.truth_ref)})` : ''}</h3>
<p style="margin-top:0">${esc(sub.truth)}</p>
<h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5d5e66;margin-bottom:4px">How it could help someone their age</h3>
<p style="white-space:pre-wrap;margin-top:0">${esc(sub.mode === 'voice' ? '(Included in the spoken response.)' : sub.understanding)}</p>
<h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5d5e66;margin-bottom:4px">Why it matters to them</h3>
<p style="white-space:pre-wrap;margin-top:0">${esc(words)}</p>
<h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5d5e66;margin-bottom:4px">What they will do${sub.commit_kind ? ` (${esc(sub.commit_kind)})` : ''}</h3>
<p style="margin-top:0">${esc(sub.commitment)}${sub.blessing ? `<br><em>It will bless their life: ${esc(sub.blessing)}</em>` : ''}</p>
<p style="padding:10px 14px;border-radius:10px;background:${effort.ok ? '#e6f4ec' : '#fbf1dc'}"><strong>${esc(effort.label)}</strong><br>${effort.reasons.map(esc).join('<br>')}</p></div>`;
  return { subject, text, html, effort };
}
