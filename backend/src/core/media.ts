// Imágenes (ADR-009): se redimensionan a WebP de máx. 800 px y ≤ 150 KB y se guardan en `media`.
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { AppError } from './errors.js';

const MAX_SIDE = 800;
const MAX_BYTES = 150 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

export interface ProcessedImage {
  mime: 'image/webp';
  bytes: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
  sha256: string;
}

export async function processImage(input: Buffer, mime: string): Promise<ProcessedImage> {
  if (!ACCEPTED.includes(mime)) {
    throw new AppError('VALIDATION_ERROR', 'Formato de imagen no admitido: usa JPG, PNG o WebP');
  }
  try {
    // Baja la calidad hasta que pese ≤ 150 KB
    for (const quality of [82, 72, 62, 50, 40]) {
      const { data, info } = await sharp(input)
        .rotate()
        .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality })
        .toBuffer({ resolveWithObject: true });
      if (data.length <= MAX_BYTES || quality === 40) {
        return {
          mime: 'image/webp',
          bytes: new Uint8Array(data),
          width: info.width,
          height: info.height,
          sha256: createHash('sha256').update(data).digest('hex'),
        };
      }
    }
  } catch {
    throw new AppError('VALIDATION_ERROR', 'No se pudo leer la imagen');
  }
  throw new AppError('VALIDATION_ERROR', 'No se pudo procesar la imagen');
}
