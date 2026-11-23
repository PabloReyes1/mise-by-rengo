import type { KdsOrder } from '@mise/shared/contracts/kitchen';
import { describe, expect, it } from 'vitest';
import { KDS_DEFAULTS } from './kds-timing.js';
import { mostCritical } from './useKdsSound.js';

const now = Date.parse('2026-11-23T12:30:00Z');
const order = (status: KdsOrder['status'], minutesAgo: number) =>
  ({ status, sentAt: new Date(now - minutesAgo * 60_000).toISOString() }) as KdsOrder;

describe('recordatorio del KDS: suena lo más crítico (doc 17 §5, arreglo 4)', () => {
  it('sin pendientes no suena', () => {
    expect(mostCritical([order('LISTO', 30)], now, KDS_DEFAULTS)).toBeNull();
  });

  it('un pedido nuevo a tiempo suena como "nuevo"', () => {
    expect(mostCritical([order('ENVIADO', 2)], now, KDS_DEFAULTS)).toBe('new');
  });

  it('en preparación y a tiempo no recuerda nada', () => {
    expect(mostCritical([order('EN_PREPARACION', 2)], now, KDS_DEFAULTS)).toBeNull();
  });

  it('si hay uno atrasado gana "atrasado", aunque haya nuevos y por vencer', () => {
    const list = [order('ENVIADO', 1), order('EN_PREPARACION', 12), order('EN_PREPARACION', 25)];
    expect(mostCritical(list, now, KDS_DEFAULTS)).toBe('late');
    expect(mostCritical(list.slice(0, 2), now, KDS_DEFAULTS)).toBe('warn');
  });

  it('respeta los umbrales configurados', () => {
    expect(
      mostCritical([order('EN_PREPARACION', 6)], now, { ...KDS_DEFAULTS, warnMin: 5, lateMin: 8 }),
    ).toBe('warn');
  });
});
