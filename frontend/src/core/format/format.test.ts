import { describe, expect, it } from 'vitest';
import { formatDateTime, formatMoney, formatTime } from './index.js';

// Valores regionales de la plantilla (RNF-070); en producción vienen de config/public
const gt = { locale: 'es-GT', currency: 'GTQ', timeZone: 'America/Guatemala' };

// El espacio entre el símbolo y el monto lo decide el idioma (es-GT usa uno no separable)
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatMoney (montos como string decimal, Docs/08 §1)', () => {
  it('muestra quetzales con 2 decimales', () => {
    expect(plain(formatMoney('203.5', gt))).toBe('Q 203.50');
  });

  it('separa miles', () => {
    expect(plain(formatMoney('12345.678', gt))).toBe('Q 12,345.68');
  });

  it('no pierde precisión con montos que en coma flotante fallan', () => {
    expect(plain(formatMoney('0.1', gt))).toBe('Q 0.10');
    expect(plain(formatMoney('1000000.005', gt))).toBe('Q 1,000,000.01');
  });

  it('usa la moneda configurada, no una fija', () => {
    expect(
      formatMoney('10', { locale: 'es-MX', currency: 'MXN', timeZone: 'America/Mexico_City' }),
    ).toBe('$10.00');
  });
});

describe('fechas (se guardan en UTC y se muestran en la zona de la sucursal)', () => {
  // 18:04 UTC = 12:04 en Guatemala (UTC−6)
  const iso = '2026-11-11T18:04:00Z';

  it('formatTime muestra la hora local de la sucursal', () => {
    expect(formatTime(iso, gt)).toMatch(/^12:04/);
  });

  it('formatDateTime incluye fecha y hora local', () => {
    const text = formatDateTime(iso, gt);
    expect(text).toContain('11');
    expect(text).toMatch(/12:04/);
  });
});
