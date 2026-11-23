import { describe, expect, it } from 'vitest';
import { fromCents, lineTotal, sumMoney, toCents } from './index.js';

describe('montos en centavos', () => {
  it('convierte sin coma flotante', () => {
    expect(toCents('203.50')).toBe(20350);
    expect(toCents('0.1')).toBe(10);
    expect(toCents('12')).toBe(1200);
    expect(fromCents(20350)).toBe('203.50');
    expect(fromCents(5)).toBe('0.05');
    expect(() => toCents('-1.00')).toThrow();
    expect(() => toCents('1.234')).toThrow();
  });

  it('suma como el servidor (0.10 + 0.20 = 0.30, no 0.30000000000000004)', () => {
    expect(sumMoney(['0.10', '0.20'])).toBe('0.30');
    expect(sumMoney([])).toBe('0.00');
  });

  it('total de línea: (95.00 + 8.00) × 2 = 206.00', () => {
    expect(lineTotal('95.00', ['0.00', '8.00'], 2)).toBe('206.00');
    expect(lineTotal('17.50', [], 3)).toBe('52.50');
  });
});
