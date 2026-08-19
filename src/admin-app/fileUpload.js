import { supabaseBrowser } from '../lib/supabase/browser-client';

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // matches the `documents` bucket's file_size_limit

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
