import {withTimeout} from './async.js';
const MAX_BYTES = 15 * 1024 * 1024;
export async function snapshotSource({snapshot,imageUrl}) {
  const url = snapshot || imageUrl;
  if (typeof url !== 'string' || !/^(https?:|data:image\/(png|jpeg|webp|gif);base64,)/i.test(url)) throw new Error('This image could not be captured. Try another image.');
  const response = await fetch(url,{signal:AbortSignal.timeout(20000),credentials:'omit',referrerPolicy:'no-referrer'});
  if (!response.ok) throw new Error('This site blocked the image download. Try another image.');
  const type = (response.headers.get('content-type') || '').split(';')[0];
  if (!['image/jpeg','image/png','image/webp','image/gif','image/avif','image/bmp'].includes(type)) throw new Error('Choose a photo or product image in a supported image format.');
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Choose an image smaller than 15 MB.');
  const reader = response.body.getReader();const chunks = [];let size = 0;
  while (true) {
    const {done,value} = await reader.read();if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel();throw new Error('Choose an image smaller than 15 MB.'); }
    chunks.push(value);
  }
  return new Blob(chunks,{type});
}

export function apiImage(blob,{
  decode = value => createImageBitmap(value,{imageOrientation:'from-image'}),
  canvas = (width,height) => new OffscreenCanvas(width,height),
  timeoutMs = 20000,
} = {}) {
  // No HTMLImageElement.decode() or HTML canvas callbacks in a hidden document.
  return withTimeout(async () => {
    const bitmap = await decode(blob);
    try {
      const scale = Math.min(1,1536 / Math.max(bitmap.width,bitmap.height));
      if (scale === 1 && ['image/jpeg','image/png','image/webp'].includes(blob.type)) return blob;
      const surface = canvas(Math.max(1,Math.round(bitmap.width * scale)),Math.max(1,Math.round(bitmap.height * scale)));
      const context = surface.getContext('2d');context.fillStyle = '#fff';context.fillRect(0,0,surface.width,surface.height);context.drawImage(bitmap,0,0,surface.width,surface.height);
      return await surface.convertToBlob({type:'image/jpeg',quality:.88});
    } finally { bitmap.close(); }
  },timeoutMs,'Photo preparation took too long. No API request was sent; try a smaller reference photo.');
}
