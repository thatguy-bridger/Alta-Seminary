// @ts-nocheck -- source of a one-time Supabase edge function (Deno). Not part of the site build.
// Fills in each Church talk's picture (the image the Church itself shows for the talk) from the Church's public
// content API, for talks and audio that do not have a thumbnail yet. Run once, then replace the deployed function
// with a stub. Token-protected. The addresses are stored in makeup_sources.thumbnail_url, so an admin can replace any.
import { createClient } from 'npm:@supabase/supabase-js@2';

const TOKEN = '<set at deploy time>';
const API = 'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri=';
const WIDTH = 480;

Deno.serve(async (req) => {
  if (req.headers.get('x-token') !== TOKEN) return new Response('No', { status: 401 });
  const db = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const { data: rows } = await db.from('makeup_sources').select('id, origin_url').is('thumbnail_url', null)
    .like('origin_url', 'https://www.churchofjesuschrist.org/study/%').in('kind', ['talk', 'audio']);
  const todo = rows || [];
  let done = 0; const failed = [];
  const one = async (row) => {
    try {
      const uri = new URL(row.origin_url).pathname.replace(/^\/study/, '');
      const res = await fetch(API + uri);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const og = (await res.json())?.meta?.ogTagImageUrl || '';
      const m = og.match(/^(https:\/\/www\.churchofjesuschrist\.org\/imgs\/[0-9a-f]+\/full\/)(?:%21|!)\d+(?:%2C|,)(\/0\/default)$/i);
      if (!m) throw new Error('no picture');
      const { error } = await db.from('makeup_sources').update({ thumbnail_url: `${m[1]}%21${WIDTH}%2C${m[2]}` }).eq('id', row.id);
      if (error) throw new Error(error.message);
      done += 1;
    } catch (e) { failed.push({ id: row.id, why: String(e.message || e) }); }
  };
  for (let i = 0; i < todo.length; i += 8) await Promise.all(todo.slice(i, i + 8).map(one));
  return new Response(JSON.stringify({ asked: todo.length, done, failed }), { headers: { 'Content-Type': 'application/json' } });
});
