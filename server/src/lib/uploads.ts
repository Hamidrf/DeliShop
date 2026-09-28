import sharp from 'sharp';
import { fileTooLarge, unsupportedFileType } from './errors';

export interface Sniffed {
  mime: string;
  ext: string;
}

/**
 * Identifies a file from its first bytes instead of trusting the extension
 * or the browser-supplied Content-Type. Covers exactly the formats this API
 * accepts; anything else (including SVG, which is never accepted anywhere)
 * comes back `null`.
 */
function sniff(buf: Buffer): Sniffed | null {
  if (buf.length < 12) return null;

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }

  const box = buf.subarray(4, 8).toString('ascii');
  if (box === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    if (/^(heic|heix|heim|heis|hevc|hevx|mif1|msf1)$/.test(brand)) return { mime: 'image/heic', ext: 'heic' };
    if (/^(M4A |isom|iso2|mp41|mp42|3gp4|M4V |qt  )$/.test(brand)) return { mime: 'audio/mp4', ext: 'm4a' };
  }

  if (buf.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { mime: 'audio/webm', ext: 'webm' };
  if (buf.subarray(0, 4).toString('ascii') === 'OggS') return { mime: 'audio/ogg', ext: 'ogg' };
  const b0 = buf[0] ?? 0;
  const b1 = buf[1] ?? 0;
  if (
    buf.subarray(0, 3).toString('ascii') === 'ID3'
    || (b0 === 0xff && (b1 & 0xe0) === 0xe0 && ((b1 >> 1) & 0x3) === 1)
  ) {
    return { mime: 'audio/mpeg', ext: 'mp3' };
  }

  return null;
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const OPAQUE_PHOTO_TYPES = new Set(['image/png', 'image/webp']);
const AUDIO_TYPES = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg']);

function assert(buf: Buffer, maxBytes: number, allowed: Set<string>, message: string): Sniffed {
  if (buf.byteLength > maxBytes) throw fileTooLarge(`File is too large (max ${Math.round(maxBytes / 1024 / 1024)}MB).`);
  const sig = sniff(buf);
  if (!sig || !allowed.has(sig.mime)) throw unsupportedFileType(message);
  return sig;
}

export const assertReceipt = (buf: Buffer) =>
  assert(buf, 5 * 1024 * 1024, IMAGE_TYPES, 'The receipt must be a JPEG, PNG, WebP or HEIC image.');

export const assertDrawing = (buf: Buffer) =>
  assert(buf, 8 * 1024 * 1024, IMAGE_TYPES, 'The drawing must be a JPEG, PNG, WebP or HEIC image.');

export const assertProductPhoto = (buf: Buffer) =>
  assert(buf, 8 * 1024 * 1024, OPAQUE_PHOTO_TYPES, 'The product photo must be a PNG or WebP image.');

export const assertVoice = (buf: Buffer) =>
  assert(buf, 3 * 1024 * 1024, AUDIO_TYPES, 'Voice recordings must be WebM, MP4/M4A, MP3 or Ogg.');

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
}

/** Kid's drawing → WebP flattened onto white, longest side capped at 1200px. Also strips EXIF (incl. GPS), since sharp drops metadata unless `withMetadata()` is called. */
export async function processDrawing(buf: Buffer): Promise<ProcessedImage> {
  const out = await sharp(buf)
    .rotate()
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .webp({ quality: 86 })
    .toBuffer();
  const meta = await sharp(out).metadata();
  return { buffer: out, width: meta.width ?? 0, height: meta.height ?? 0 };
}

/** Product photo → WebP, transparency preserved, longest side capped at 1000px. */
export async function processProductPhoto(buf: Buffer): Promise<ProcessedImage> {
  const out = await sharp(buf)
    .rotate()
    .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
  const meta = await sharp(out).metadata();
  return { buffer: out, width: meta.width ?? 0, height: meta.height ?? 0 };
}
