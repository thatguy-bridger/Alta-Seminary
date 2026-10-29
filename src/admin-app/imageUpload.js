import { supabaseBrowser } from '../lib/supabase/browser-client';

const MAX_DIMENSION = 1600; // downscale before upload to protect free-tier storage/bandwidth

function downscaleImage(file) {
  return new Promise((resolve, reject) => {   // resolves { blob, width, height }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve({ blob, width, height }) : reject(new Error('Could not process image'))),
        'image/webp',
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

// A file sized and encoded the way every upload is: -> { blob, width, height }. Also used to replace a library image in place.
export function prepareImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return Promise.reject(new Error('Please choose an image file.'));
  return downscaleImage(file);
}

// What an upload is called and tagged before anyone has described it, from where in storage it goes ("pages/<id>" -> a page image).
export function defaultImageMeta(pathPrefix = 'misc') {
  const [top, second] = String(pathPrefix).split('/');
  switch (top) {
    case 'pages': return { title: 'Page image', tags: ['page'] };
    case 'posts': case 'blog_posts': return { title: 'Announcement image', tags: ['announcement'] };
    case 'events': return { title: 'Event image', tags: ['event'] };
    case 'directory': return { title: 'Directory photo', tags: ['directory', ...(second ? [second] : [])] };
    case 'gallery': return { title: 'Album photo', tags: ['gallery'] };
    case 'makeup': return { title: 'Lesson picture', tags: ['lesson'] };
    case 'site': return { title: 'Site image', tags: ['site'] };
    default: return { title: 'Uploaded image', tags: ['uploaded'] };
  }
}

// The picture's size, when the browser can tell us without drawing it. Missing is fine: it is only information.
export async function blobSize(blob) {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob);
      const size = { width: bitmap.width, height: bitmap.height };
      if (bitmap.close) bitmap.close();
      return size;
    }
  } catch { /* an unreadable picture just has no size on record */ }
  return null;
}

// pathPrefix e.g. "pages/<page-id>" -- see storage path convention in the migration comments.
// Shared by ImageUploadField (side-panel) and EditableImage (click-to-replace on canvas).
// `meta` may carry { title, alt_text, description, credit, license, tags } for the image library.
export async function uploadImageFile(file, pathPrefix = 'misc', meta = {}) {
  const { blob, width, height } = await prepareImageFile(file);
  return uploadImageBlob(blob, pathPrefix, { width, height, ...meta });
}

// For blobs that are already sized/encoded correctly -- e.g. CropEditor's
// canvas output, which shouldn't be run back through downscaleImage.
export async function uploadImageBlob(blob, pathPrefix = 'misc', meta = {}) {
  const path = `${pathPrefix}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await supabaseBrowser.storage.from('images').upload(path, blob, {
    contentType: 'image/webp',
  });
  if (uploadError) throw uploadError;
  const { data } = supabaseBrowser.storage.from('images').getPublicUrl(path);

  await registerInLibrary({ url: data.publicUrl, path, blob, pathPrefix, meta });
  return data.publicUrl;
}

// Puts an upload in the image library with what is known about it. The database has usually done the first part already (a trigger
// registers anything that lands in the images bucket), so this fills in the details, and registers it itself if the trigger is not
// there. A failure here must never fail the upload: the image is already live.
async function registerInLibrary({ url, path, blob, pathPrefix, meta }) {
  try {
    const size = meta.width && meta.height ? { width: meta.width, height: meta.height } : await blobSize(blob);
    const defaults = defaultImageMeta(pathPrefix);
    const { data: userData } = await supabaseBrowser.auth.getUser();
    const { error } = await supabaseBrowser.from('media_library').upsert({
      url, storage_path: path, origin: 'uploaded', uploaded_by: userData?.user?.id ?? null,
      mime_type: 'image/webp', size_bytes: blob.size ?? null, width: size?.width ?? null, height: size?.height ?? null,
      title: meta.title || defaults.title, alt_text: meta.alt_text || '', description: meta.description || '',
      credit: meta.credit || '', license: meta.license || '', tags: [...new Set([...defaults.tags, ...(meta.tags || [])].map((t) => String(t).trim().toLowerCase()).filter(Boolean))],
    }, { onConflict: 'url' });
    if (error) console.error('image library registration failed:', error.message);
  } catch (err) {
    console.error('image library registration failed:', err?.message || err);
  }
}

// Fetches an external image URL as a File -- NOT uploaded yet -- so a
// pasted URL can flow through the exact same crop step as a normal file
// pick (see ImageSourceMenu.jsx) before uploadImageFile eventually
// re-hosts it, rather than hotlinking an external host that could change
// or go away.
export async function fetchImageFromUrl(url) {
  let res;
  try {
    res = await fetch(url, { mode: 'cors' });
  } catch {
    throw new Error("Couldn't fetch that URL -- the site may block cross-origin requests.");
  }
  if (!res.ok) throw new Error(`Couldn't fetch that URL (${res.status}).`);
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) throw new Error("That URL doesn't look like an image.");
  return new File([blob], 'pasted-image', { type: blob.type });
}
