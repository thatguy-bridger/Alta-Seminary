// @ts-nocheck -- runs on Supabase (Deno), not in the site build
// ONE-TIME backfill for the image library, already run and since replaced by a stub that answers 410. Kept as the record of how it was done.
//
// What it did, server-side (no image data ever passed through anyone's chat or terminal):
//   step "site": copied every image that ships with the site (the paintings, the Makeup Work art, the default share image, the
//                built-in logo) from the live site into the `images` storage bucket under site/, and registered each in the
//                library as origin "site" with its credit, tags, alt text and size. The original path is kept in source_url, so a
//                lesson that still points at "/makeup/thumbs/x.webp" is recognised as using the copy.
//   step "dims": read the width, height and kind of every hosted image that had none, from the file itself.
// Protected by a token that was put in at deploy time (the placeholder below is never the real one).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { imageSize, mimeOfType } from './imageDims.js';
import { MANIFEST } from './manifest.js';

const TOKEN = '__TOKEN__';
const SITE = 'https://alta-seminary-omega.vercel.app';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (TOKEN === '__TOKEN__' || req.headers.get('x-backfill-token') !== TOKEN) return json({ error: 'forbidden' }, 403);
  const body = await req.json().catch(() => ({}));
  const db = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const { data: cfg } = await db.from('media_config').select('public_base_url').limit(1).maybeSingle();
  const base = cfg?.public_base_url;
  if (!base) return json({ error: 'media_config is empty' }, 500);

  if (body.step === 'site') {
    const items = [...MANIFEST];
    // The built-in logo's file name carries a hash that changes with every build, so find it on the live homepage.
    const html = await (await fetch(`${SITE}/`)).text();
    const logo = html.match(/(?:\/|%2F)_astro(?:\/|%2F)alta-seminary-logo\.[A-Za-z0-9_-]+\.png/i);   // the page may write the slashes as %2F
    if (logo) items.push({ path: decodeURIComponent(logo[0]), bucketPath: '/logo/alta-seminary-logo.png', title: 'Alta Seminary logo', alt: 'Alta Seminary', description: 'The built-in logo shown in the site header, the admin and Makeup Work.', tags: ['site', 'logo'], credit: 'Alta Seminary', license: 'Alta Seminary artwork' });
    const results = [];
    for (const it of items) {
      try {
        const res = await fetch(`${SITE}${it.path}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        const size = imageSize(buf);
        const type = size ? mimeOfType(size.type) : null;
        if (!type) throw new Error('not an image we can read');
        const storagePath = `site${it.bucketPath || it.path}`;
        const up = await db.storage.from('images').upload(storagePath, buf, { contentType: type, upsert: true });
        if (up.error) throw up.error;
        const row = { url: `${base}${storagePath}`, storage_path: storagePath, origin: 'site', source_url: it.path, title: it.title, description: it.description, alt_text: it.alt,
          tags: it.tags, credit: it.credit, license: it.license, mime_type: type, width: size.width, height: size.height, size_bytes: buf.length };
        const { error } = await db.from('media_library').upsert(row, { onConflict: 'url' });
        if (error) throw error;
        results.push({ path: it.path, ok: true, width: size.width, height: size.height, bytes: buf.length });
      } catch (e) { results.push({ path: it.path, ok: false, error: String(e.message || e) }); }
    }
    return json({ step: 'site', done: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok) });
  }

  if (body.step === 'dims') {
    const limit = Math.min(Number(body.limit) || 60, 120);
    const { data: rows } = await db.from('media_library').select('id, storage_path, mime_type').not('storage_path', 'is', null).is('width', null).order('created_at').limit(limit);
    let updated = 0; const failed = [];
    for (const r of rows || []) {
      try {
        const dl = await db.storage.from('images').download(r.storage_path);
        if (dl.error) throw dl.error;
        const size = imageSize(new Uint8Array(await dl.data.arrayBuffer()));
        if (!size) throw new Error('unreadable');
        const { error } = await db.from('media_library').update({ width: size.width, height: size.height, mime_type: r.mime_type || mimeOfType(size.type) }).eq('id', r.id);
        if (error) throw error;
        updated += 1;
      } catch (e) { failed.push({ path: r.storage_path, error: String(e.message || e) }); }
    }
    const { count } = await db.from('media_library').select('id', { count: 'exact', head: true }).not('storage_path', 'is', null).is('width', null);
    return json({ step: 'dims', updated, failed, remaining: count });
  }

  return json({ error: 'unknown step' }, 400);
});
