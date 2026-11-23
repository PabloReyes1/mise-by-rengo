// Compresión de imágenes en el navegador (Docs/18 §6b regla 3, ADR-009).
// Toda imagen se comprime ANTES de subirla: lado mayor ≤ 1200 px y WebP. Así una foto de 5 MB del
// celular sube en pocos KB por 4G. El servidor la vuelve a procesar (WebP, 800 px, ≤ 150 KB).

export const IMAGE_MAX_SIDE = 1200;
export const IMAGE_QUALITY = 0.85;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

export function isImage(file: Blob): boolean {
  return ACCEPTED.includes(file.type);
}

/** Medidas finales manteniendo la proporción, sin agrandar. */
export function fitInside(width: number, height: number, max = IMAGE_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Reduce y convierte a WebP. Si el navegador no puede (o el resultado pesa más), devuelve el
 * archivo original: el servidor igual lo comprime.
 */
export async function compressImage(file: Blob, name = 'imagen'): Promise<File> {
  const original =
    file instanceof File ? file : new File([file], `${name}.png`, { type: file.type });
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') return original;
  try {
    const bitmap = await createImageBitmap(file);
    const size = fitInside(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', IMAGE_QUALITY),
    );
    if (!blob || blob.type !== 'image/webp' || blob.size >= original.size) return original;
    return new File([blob], `${name}.webp`, { type: 'image/webp' });
  } catch {
    return original;
  }
}

/** Primera imagen de un evento de pegar (Ctrl+V) o de soltar un archivo. */
export function imageFromTransfer(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items)) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file && isImage(file)) return file;
    }
  }
  return null;
}
