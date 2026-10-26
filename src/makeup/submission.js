import { INVITES } from './content.js';
import { daysCovered } from './journey.js';

// Turns the journey's state into (a) the arguments for the database's submit_makeup()
// and (b) the same thing in the shape the teacher email uses. One place, so what is
// saved and what the preview shows can never disagree.
export function buildSubmission({ S, classes, sources, stats, mediaTotals = { watched: 0, source: 0, readSeconds: 0, muted: 0 }, mediaDetail = [], code = '', pauseAnswers = [] }) {
  const cls = classes.find((c) => c.id === S.cls);
  const titles = S.sourceIds.map((id) => sources.find((s) => s.id === id)?.title).filter(Boolean);
  const invite = INVITES.find((i) => i.k === S.inv);
  const response = (S.word ? `${S.word}. ` : '') + S.text;
  const commitment = `${invite ? invite.start + ' ' : ''}${S.commit}`.trim();
  const activeSeconds = Math.round((stats.activeMs || 0) / 1000 + mediaTotals.watched + mediaTotals.readSeconds + (S.mode === 'voice' ? S.voiceSeconds || 0 : 0));
  const days = Math.max(1, daysCovered(S.days));
  const rpc = {
    p_class_id: S.cls, p_code: code || null, p_student_name: S.name.trim(), p_days_total: days,
    p_source_ids: S.sourceIds, p_mode: S.mode, p_truth: S.truth.trim(), p_truth_ref: S.where.trim(), p_truth_seconds: S.whereSeconds ?? null,
    p_understanding: S.understanding.trim(), p_response: response.trim(), p_voice_seconds: S.mode === 'voice' ? Math.round(S.voiceSeconds || 0) : 0,
    p_commit_kind: S.inv, p_commitment: commitment, p_blessing: S.bless.trim(),
    p_active_seconds: activeSeconds, p_watched_seconds: Math.round(mediaTotals.watched), p_source_seconds: Math.round(mediaTotals.source), p_muted_seconds: Math.round(mediaTotals.muted || 0),
    p_paste_attempts: stats.pastes || 0, p_sudden_jumps: stats.jumps || 0, p_typed_chars: stats.typedChars || 0, p_page_leaves: stats.leaves || 0,
    p_pause_answers: pauseAnswers, p_media_detail: mediaDetail,
  };
  const row = {
    student_name: rpc.p_student_name, class_name: cls?.name || '', days_total: days, source_title: titles[0], source_titles: titles, mode: S.mode,
    truth: rpc.p_truth, truth_ref: rpc.p_truth_ref, understanding: rpc.p_understanding, response: rpc.p_response, voice_seconds: rpc.p_voice_seconds,
    commit_kind: S.inv, commitment, blessing: rpc.p_blessing, active_seconds: activeSeconds,
    watched_seconds: rpc.p_watched_seconds, source_seconds: rpc.p_source_seconds, muted_seconds: rpc.p_muted_seconds,
    paste_attempts: rpc.p_paste_attempts, sudden_jumps: rpc.p_sudden_jumps, typed_chars: rpc.p_typed_chars, page_leaves: rpc.p_page_leaves,
    pause_answers: pauseAnswers, media_detail: mediaDetail,
  };
  return { rpc, row };
}
