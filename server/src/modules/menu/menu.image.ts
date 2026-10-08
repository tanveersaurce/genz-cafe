import sharp from 'sharp';
import { AppError } from '../../utils/AppError';

/**
 * Validates binary magic bytes to guarantee file is truly an image (PNG, JPEG, WebP)
 * regardless of file extension or client-reported MIME type.
 */
export function validateImageMagicBytes(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (buffer.length < 12) {
    throw new AppError('Invalid file: payload too small to be a valid image', 400);
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  // WebP: RIFF (bytes 0-3: 52 49 46 46) ... WEBP (bytes 8-11: 57 45 42 50)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  throw new AppError('Invalid image format. Allowed formats: JPEG, PNG, WebP.', 400);
}

/**
 * Processes an uploaded image buffer with Sharp:
 * - Auto-orients via EXIF metadata
 * - Generates full resolution WebP (max 1200px)
 * - Generates thumbnail WebP (max 400px)
 */
export async function processMenuImage(
  buffer: Buffer
): Promise<{ fullBuffer: Buffer; thumbBuffer: Buffer }> {
  validateImageMagicBytes(buffer);

  try {
    const pipeline = sharp(buffer).rotate(); // auto-rotate based on EXIF

    const [fullBuffer, thumbBuffer] = await Promise.all([
      pipeline
        .clone()
        .resize({
          width: 1200,
          height: 1200,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80, effort: 4 })
        .toBuffer(),
      pipeline
        .clone()
        .resize({
          width: 400,
          height: 400,
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 75, effort: 4 })
        .toBuffer(),
    ]);

    return { fullBuffer, thumbBuffer };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to process image file. Ensure it is a valid, uncorrupted image.', 400);
  }
}
