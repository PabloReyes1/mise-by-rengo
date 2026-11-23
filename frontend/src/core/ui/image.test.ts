import { describe, expect, it } from 'vitest';
import { compressImage, fitInside, imageFromTransfer, isImage } from './image.js';

describe('imágenes (Docs/18 §6b regla 3)', () => {
  it('reduce el lado mayor a 1200 px sin deformar ni agrandar', () => {
    expect(fitInside(4000, 3000)).toEqual({ width: 1200, height: 900 });
    expect(fitInside(1000, 3000)).toEqual({ width: 400, height: 1200 });
    expect(fitInside(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it('solo acepta imágenes', () => {
    expect(isImage(new Blob([], { type: 'image/png' }))).toBe(true);
    expect(isImage(new Blob([], { type: 'application/pdf' }))).toBe(false);
  });

  it('toma la imagen de lo que se pegó o se soltó', () => {
    const png = new File(['x'], 'foto.png', { type: 'image/png' });
    const pdf = new File(['x'], 'menu.pdf', { type: 'application/pdf' });
    const transfer = (files: File[]) =>
      ({
        items: files.map((f) => ({ kind: 'file', getAsFile: () => f })),
      }) as unknown as DataTransfer;
    expect(imageFromTransfer(transfer([pdf, png]))).toBe(png);
    expect(imageFromTransfer(transfer([pdf]))).toBeNull();
    expect(imageFromTransfer(null)).toBeNull();
  });

  it('si el navegador no puede comprimir, devuelve la original (el servidor la comprime)', async () => {
    const png = new File(['x'], 'foto.png', { type: 'image/png' });
    // jsdom no tiene createImageBitmap
    expect(await compressImage(png)).toBe(png);
  });
});
