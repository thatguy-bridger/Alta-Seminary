import { supabaseBrowser } from '../lib/supabase/browser-client';

const MAX_DIMENSION = 1600; // downscale before upload to protect free-tier storage/bandwidth

function downscaleImage(file) {
  return new Promise((resolve, reject) => {
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
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not process image'))),
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

// pathPrefix e.g. "pages/<page-id>" -- see storage path convention in the migration comments.
// Shared by ImageUploadField (side-panel) and EditableImage (click-to-replace on canvas).
export async function uploadImageFile(file, pathPrefix = 'misc') {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  const blob = await downscaleImage(file);
  return uploadImageBlob(blob, pathPrefix);
}

// For blobs that are already sized/encoded correctly -- e.g. CropEditor's
// canvas output, which shouldn't be run back through downscaleImage.
export async function uploadImageBlob(blob, pathPrefix = 'misc') {
  const path = `${pathPrefix}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await supabaseBrowser.storage.from('images').upload(path, blob, {
    contentType: 'image/webp',
  });
  if (uploadError) throw uploadError;
  const { data } = supabaseBrowser.storage.from('images').getPublicUrl(path);
  return data.publicUrl;
}
