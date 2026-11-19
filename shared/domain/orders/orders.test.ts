import { describe, expect, it } from 'vitest';
import {
  ITEM_STATUSES,
  ORDER_STATUSES,
  PERSISTED_ITEM_STATUSES,
  canItemTransition,
  canOrderTransition,
  isFinalOrderStatus,
} from './index.js';

describe('estados del pedido (doc 05 §5.3, doc 07)', () => {
  it('son los de la tabla orders', () => {
    expect(ORDER_STATUSES).toEqual([
      'ENVIADO',
      'EN_PREPARACION',
      'LISTO',
      'ENTREGADO',
      'CANCELADO',
    ]);
  });

  it.each([
    ['ENVIADO', 'EN_PREPARACION'],
    ['EN_PREPARACION', 'LISTO'],
    ['LISTO', 'EN_PREPARACION'], // recall
    ['LISTO', 'ENTREGADO'],
    ['ENVIADO', 'CANCELADO'],
    ['EN_PREPARACION', 'CANCELADO'],
  ] as const)('permite %s → %s', (from, to) => {
    expect(canOrderTransition(from, to)).toBe(true);
  });

  it.each([
    ['ENVIADO', 'LISTO'], // la cocina debe aceptar primero
    ['ENVIADO', 'ENTREGADO'],
    ['EN_PREPARACION', 'ENTREGADO'],
    ['ENTREGADO', 'LISTO'],
    ['CANCELADO', 'ENVIADO'],
    ['ENTREGADO', 'CANCELADO'],
  ] as const)('no permite %s → %s', (from, to) => {
    expect(canOrderTransition(from, to)).toBe(false);
  });

  it('ENTREGADO y CANCELADO son finales', () => {
    expect(isFinalOrderStatus('ENTREGADO')).toBe(true);
    expect(isFinalOrderStatus('CANCELADO')).toBe(true);
    expect(isFinalOrderStatus('LISTO')).toBe(false);
  });
});

describe('estados del ítem (doc 05 §5.4, doc 07)', () => {
  it('BORRADOR existe solo en el dispositivo; la base guarda los demás', () => {
    expect(ITEM_STATUSES).toEqual(['BORRADOR', ...PERSISTED_ITEM_STATUSES]);
    expect(PERSISTED_ITEM_STATUSES).toEqual([
      'ENVIADO',
      'EN_PREPARACION',
      'LISTO',
      'ENTREGADO',
      'CANCELADO',
    ]);
  });

  it.each([
    ['BORRADOR', 'ENVIADO'],
    ['ENVIADO', 'EN_PREPARACION'],
    ['EN_PREPARACION', 'LISTO'],
    ['LISTO', 'ENTREGADO'],
    ['ENVIADO', 'CANCELADO'],
    ['EN_PREPARACION', 'CANCELADO'],
    ['LISTO', 'CANCELADO'], // merma
    ['ENTREGADO', 'CANCELADO'], // merma
  ] as const)('permite %s → %s', (from, to) => {
    expect(canItemTransition(from, to)).toBe(true);
  });

  it.each([
    ['BORRADOR', 'CANCELADO'], // un borrador se quita, no se cancela (RF-066)
    ['BORRADOR', 'LISTO'],
    ['ENVIADO', 'LISTO'],
    ['CANCELADO', 'ENVIADO'],
    ['ENTREGADO', 'LISTO'],
  ] as const)('no permite %s → %s', (from, to) => {
    expect(canItemTransition(from, to)).toBe(false);
  });
});
