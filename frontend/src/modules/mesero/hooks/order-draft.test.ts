import { sendOrderRequestSchema } from '@mise/shared/contracts/orders';
import { describe, expect, it } from 'vitest';
import {
  addLine,
  draftCount,
  draftLineTotal,
  draftTotal,
  EMPTY_DRAFT,
  removeLine,
  setQuantity,
  toSendOrder,
  type DraftLine,
} from './order-draft.js';

const ID = (n: number) => `01JD4K7P00000000000000000${n}`;

const churrasco = (key: string, extra: Partial<DraftLine> = {}): DraftLine => ({
  key,
  productId: ID(1),
  name: 'Churrasco',
  unitPrice: '95.00',
  quantity: 1,
  modifiers: [
    { modifierId: ID(2), name: 'Término medio', priceDelta: '0.00' },
    { modifierId: ID(3), name: 'Aguacate', priceDelta: '8.00' },
  ],
  note: '',
  ...extra,
});

describe('borrador del pedido', () => {
  it('junta líneas iguales y separa las distintas', () => {
    let d = addLine(EMPTY_DRAFT, churrasco(ID(4)));
    // Mismos modificadores en otro orden: es la misma línea
    d = addLine(d, churrasco(ID(5), { modifiers: [...churrasco('x').modifiers].reverse() }));
    expect(d.lines).toHaveLength(1);
    expect(d.lines[0]!.quantity).toBe(2);
    // Con nota es otra línea
    d = addLine(d, churrasco(ID(6), { note: ' sin cebolla ' }));
    expect(d.lines).toHaveLength(2);
    expect(d.lines[1]!.note).toBe('sin cebolla');
    expect(draftCount(d)).toBe(3);
  });

  it('totales como el servidor: (95 + 8) × 2 = 206', () => {
    const d = addLine(EMPTY_DRAFT, churrasco(ID(4), { quantity: 2 }));
    expect(draftLineTotal(d.lines[0]!)).toBe('206.00');
    expect(draftTotal(addLine(d, { ...churrasco(ID(5)), productId: ID(9), modifiers: [] }))).toBe(
      '301.00',
    );
  });

  it('cantidad 0 quita la línea; no pasa de 99', () => {
    let d = addLine(EMPTY_DRAFT, churrasco(ID(4)));
    d = setQuantity(d, ID(4), 150);
    expect(d.lines[0]!.quantity).toBe(99);
    expect(setQuantity(d, ID(4), 0).lines).toHaveLength(0);
    expect(removeLine(d, ID(4)).lines).toHaveLength(0);
  });

  it('arma una ronda que cumple el contrato de POST /api/orders', () => {
    const d = addLine(EMPTY_DRAFT, churrasco(ID(4), { note: 'bien caliente' }));
    const body = toSendOrder(d, {
      id: ID(7),
      occupancyId: ID(8),
      billId: ID(9),
      now: new Date('2026-11-22T20:00:00Z'),
    });
    expect(sendOrderRequestSchema.parse(body)).toMatchObject({
      items: [{ id: ID(4), billId: ID(9), quantity: 1, unitPrice: '95.00', note: 'bien caliente' }],
    });
  });
});
