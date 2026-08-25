import { supabaseBrowser } from '../lib/supabase/browser-client';

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // matches the `documents` bucket's file_size_limit
const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024; // matches the `audio` bucket's file_size_limit (0024_audio_bucket_10mb.sql)

// Uploads an arbitrary document (PDF, Word, Excel) to the `documents` bucket --
// no image downscaling here, unlike imageUpload.js, since these are meant to
// be downloaded as-is.
export async function uploadDocumentFile(file, pathPrefix = 'misc') {
  if (!file) throw new Error('Choose a file first.');
  if (file.size > MAX_SIZE_BYTES) throw new Error('File is too large (20MB max).');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${pathPrefix}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabaseBrowser.storage.from('documents').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw error;
  const { data } = supabaseBrowser.storage.from('documents').getPublicUrl(path);
  return { url: data.publicUrl, name: file.name };
}

// Same shape as uploadDocumentFile above, targeting the dedicated `audio`
// bucket instead -- Background Music needs its own bucket since `documents`
// bucket's allowed_mime_types list doesn't include any audio type.
export async function uploadAudioFile(file, pathPrefix = 'misc') {
  if (!file) throw new Error('Choose a file first.');
  if (file.size > MAX_AUDIO_SIZE_BYTES) throw new Error('File is too large (10MB max).');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${pathPrefix}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabaseBrowser.storage.from('audio').upload(path, file, {
    contentType: file.type || 'audio/mpeg',
  });
  if (error) {
    // The two most common real causes here aren't obvious from Supabase's
    // own wording: the `audio` bucket migration (0022_audio_bucket.sql)
    // never having actually been run against this Supabase project (every
    // upload fails identically until it is), or a file type outside that
    // bucket's own allowed_mime_types list (mp3/mp4/aac/ogg/wav/webm/m4a --
    // anything else, e.g. a bare .caf or .flac, gets rejected).
    if (/bucket.*not.*found/i.test(error.message)) {
      throw new Error('The audio storage bucket hasn’t been set up on this Supabase project yet (migration 0022_audio_bucket.sql needs to be run) -- ask whoever manages the database to run it, then try again.');
    }
    if (/mime type|not allowed/i.test(error.message)) {
      throw new Error(`This file type (${file.type || 'unknown'}) isn't supported -- try mp3, m4a, wav, or ogg.`);
    }
    throw error;
  }
  const { data } = supabaseBrowser.storage.from('audio').getPublicUrl(path);
  return { url: data.publicUrl, name: file.name };
}
