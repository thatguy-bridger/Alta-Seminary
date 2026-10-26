import { analyzeEffort, formatDuration } from './effort.js';
import { playbackLines, timelineParts, COLORS } from './playback.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Builds the note a teacher receives. Pure, so it can be tested, and the same
// function backs the preview in the admin.
export function composeTeacherEmail(sub) {
  const effort = analyzeEffort({ mode: sub.mode, text: sub.response, voiceSeconds: sub.voice_seconds, stats: {
    pastes: sub.paste_attempts, jumps: sub.sudden_jumps, activeMs: (sub.active_seconds || 0) * 1000, typedChars: sub.typed_chars, leaves: sub.page_leaves,
    watchedSeconds: sub.watched_seconds, sourceSeconds: sub.source_seconds, mutedSeconds: sub.muted_seconds,
  } });
  const dayLine = sub.days_total > 1 ? `Covers ${sub.days_total} days` : 'Covers 1 day';
  const played = sub.source_seconds > 0 ? ` · played ${formatDuration(sub.watched_seconds || 0)} of ${formatDuration(sub.source_seconds)}` : '';
  const learned = (sub.source_titles && sub.source_titles.length ? sub.source_titles.join(', ') : sub.source_title) || 'a lesson';
  const words = sub.response;
  // Spoken answers are the words the student's browser heard; say so, so a misheard word is not blamed on the student.
  const spoken = sub.mode === 'voice' ? `Answered out loud (${formatDuration(sub.voice_seconds || 0)}) and written down by the student's browser, so a small mistake in the words may be the browser's.` : '';
  // Questions that appeared while studying ("pause questions"), with the student's short answers.
  const where = (a) => (a.unit === 'paragraph' ? `after paragraph ${a.at}` : `at ${formatDuration(Number(a.at) || 0)}`);
  const pauses = Array.isArray(sub.pause_answers) ? sub.pause_answers.filter((a) => a && a.answer) : [];
  // What they played of each recording or video, and exactly which parts they skipped.
  const playback = playbackLines(sub.media_detail);
  const AHEAD = '#d9d9de';    // email has no see-through colors
  const bar = (m) => {
    const cell = (kind, from, to) => `<td width="${(((to - from) / m.duration) * 100).toFixed(2)}%" bgcolor="${kind === 'ahead' ? AHEAD : COLORS[kind]}" style="background:${kind === 'ahead' ? AHEAD : COLORS[kind]};height:10px;line-height:10px;font-size:0">&nbsp;</td>`;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 10px;table-layout:fixed"><tr>${timelineParts(m.seen, m.reached, m.duration).map((p) => cell(p.kind, p.from, p.to)).join('')}</tr></table>`;
  };
  const subject = `Makeup work from ${sub.student_name} (${sub.class_name})`;
  const text = [
    `${sub.student_name} finished makeup work for ${sub.class_name}.`,
    `${dayLine} · learned by ${learned}${played} · ${formatDuration(sub.active_seconds || 0)} active`,
    ...(spoken ? [spoken] : []),
    '',
    `A truth they found${sub.truth_ref ? ` (${sub.truth_ref})` : ''}:`,
    sub.truth,
    ...(pauses.length ? ['', 'Questions they answered while studying:', ...pauses.flatMap((a) => [`- ${a.question}${a.lesson ? ` (${a.lesson}, ${where(a)})` : ''}`, `  ${a.answer}`])] : []),
    ...(playback.length ? ['', 'What they played:', ...playback.map((m) => `- ${m.title}${m.kind ? ` (${m.kind})` : ''}: ${m.summary}`)] : []),
    '',
    'How it could help someone their age:',
    sub.understanding,
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
<p style="color:#5d5e66;font-size:14px">${esc(dayLine)} · learned by ${esc(learned)}${esc(played)} · ${esc(formatDuration(sub.active_seconds || 0))} active</p>${spoken ? `\n<p style="color:#5d5e66;font-size:14px;margin-top:-8px"><em>${esc(spoken)}</em></p>` : ''}
<h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5d5e66;margin-bottom:4px">A truth they found${sub.truth_ref ? ` (${esc(sub.truth_ref)})` : ''}</h3>
<p style="margin-top:0">${esc(sub.truth)}</p>
${pauses.length ? `<h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5d5e66;margin-bottom:4px">Questions they answered while studying</h3>${pauses.map((a) => `<p style="margin:0 0 8px"><span style="color:#5d5e66;font-size:14px">${esc(a.question)}${a.lesson ? ` (${esc(a.lesson)}, ${esc(where(a))})` : ''}</span><br>${esc(a.answer)}</p>`).join('')}` : ''}
${playback.length ? `<h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5d5e66;margin-bottom:4px">What they played</h3>${playback.map((m) => `<p style="margin:0 0 4px"><strong>${esc(m.title)}</strong> <span style="color:#5d5e66;font-size:13px">${m.kind ? `(${esc(m.kind)}) ` : ''}${esc(m.summary)}</span></p>${bar(m)}`).join('')}<p style="margin:-4px 0 10px;font-size:12px;color:#5d5e66"><span style="color:${COLORS.played}">&#9632;</span> played &nbsp;<span style="color:${COLORS.skipped}">&#9632;</span> skipped &nbsp;<span style="color:${AHEAD}">&#9632;</span> not reached</p>` : ''}
<h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5d5e66;margin-bottom:4px">How it could help someone their age</h3>
<p style="white-space:pre-wrap;margin-top:0">${esc(sub.understanding)}</p>
<h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5d5e66;margin-bottom:4px">Why it matters to them</h3>
<p style="white-space:pre-wrap;margin-top:0">${esc(words)}</p>
<h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5d5e66;margin-bottom:4px">What they will do${sub.commit_kind ? ` (${esc(sub.commit_kind)})` : ''}</h3>
<p style="margin-top:0">${esc(sub.commitment)}${sub.blessing ? `<br><em>It will bless their life: ${esc(sub.blessing)}</em>` : ''}</p>
<p style="padding:10px 14px;border-radius:10px;background:${effort.ok ? '#e6f4ec' : '#fbf1dc'}"><strong>${esc(effort.label)}</strong><br>${effort.reasons.map(esc).join('<br>')}</p></div>`;
  return { subject, text, html, effort };
}
