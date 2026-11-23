import { describe, expect, it } from 'vitest';
import {
  cancelOrderItemRequestSchema,
  orderDeliveredEventSchema,
  orderSchema,
  sendOrderRequestSchema,
} from './index.js';

const ID = {
  order: '01JD4K7P0000000000000000A1',
  occupancy: '01JD4K7P0000000000000000B1',
  item: '01JD4K7P0000000000000000C1',
  bill: '01JD4K7P0000000000000000D1',
  product: '01JD4K7P0000000000000000E1',
  modifier: '01JD4K7P0000000000000000F1',
  user: '01JD4K7P0000000000000000G1',
  reason: '01JD4K7P0000000000000000H1',
};

const item = {
  id: ID.item,
  billId: ID.bill,
  productId: ID.product,
  quantity: 3,
  unitPrice: '25.00',
  modifiers: [{ modifierId: ID.modifier, priceDelta: '5.00' }],
  note: 'Sin cebolla',
};

const request = {
  id: ID.order,
  occupancyId: ID.occupancy,
  clientSentAt: '2026-11-11T18:04:12.331Z',
  items: [item],
};

describe('contrato v1 de orders: enviar ronda', () => {
  it('acepta una ronda válida y pone listas vacías por defecto', () => {
    const parsed = sendOrderRequestSchema.parse(request);
    expect(parsed.items[0]?.components).toEqual([]);
  });

  it('folio temporal: acepta "M3-0005" y rechaza "M3-5"', () => {
    expect(sendOrderRequestSchema.safeParse({ ...request, tempFolio: 'M3-0005' }).success).toBe(
      true,
    );
    expect(sendOrderRequestSchema.safeParse({ ...request, tempFolio: 'M3-5' }).success).toBe(false);
  });

  it('rechaza una ronda sin ítems', () => {
    expect(sendOrderRequestSchema.safeParse({ ...request, items: [] }).success).toBe(false);
  });

  it('montos como texto, nunca número (Docs/08 §1)', () => {
    const bad = { ...request, items: [{ ...item, unitPrice: 25 }] };
    expect(sendOrderRequestSchema.safeParse(bad).success).toBe(false);
  });

  it('cantidad entera y mayor que cero', () => {
    for (const quantity of [0, 1.5]) {
      const bad = { ...request, items: [{ ...item, quantity }] };
      expect(sendOrderRequestSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('nota de máximo 140 caracteres', () => {
    const bad = { ...request, items: [{ ...item, note: 'x'.repeat(141) }] };
    expect(sendOrderRequestSchema.safeParse(bad).success).toBe(false);
  });

  it('rechaza ids que no son ULID', () => {
    expect(sendOrderRequestSchema.safeParse({ ...request, id: '123' }).success).toBe(false);
  });
});

describe('contrato v1 de orders: pedido del servidor', () => {
  const order = {
    id: ID.order,
    occupancyId: ID.occupancy,
    roundNumber: 2,
    folio: 'C-000131',
    tempFolio: 'M3-0005',
    status: 'ENVIADO',
    sentBy: ID.user,
    sentAt: '2026-11-11T18:04:12Z',
    acceptedAt: null,
    readyAt: null,
    deliveredAt: null,
    deliveredAuto: false,
    syncedLate: true,
    printedAt: null,
    version: 0,
    items: [
      {
        id: ID.item,
        orderId: ID.order,
        billId: ID.bill,
        productId: ID.product,
        productName: 'Cerveza',
        quantity: 3,
        unitPrice: '25.00',
        modifiersTotal: '0.00',
        lineTotal: '75.00',
        note: null,
        status: 'ENVIADO',
        modifiers: [],
        components: [],
        splitFromId: null,
        readyAt: null,
        cancelledAt: null,
        version: 0,
      },
    ],
  };

  it('acepta un pedido completo', () => {
    expect(orderSchema.safeParse(order).success).toBe(true);
  });

  it('BORRADOR nunca sale del dispositivo', () => {
    expect(orderSchema.safeParse({ ...order, status: 'BORRADOR' }).success).toBe(false);
  });
});

describe('contrato v1 de orders: otras acciones y eventos', () => {
  it('cancelar ítem con autorización 🔑', () => {
    const result = cancelOrderItemRequestSchema.safeParse({
      reasonId: ID.reason,
      authorization: { userId: ID.user, pin: '4821' },
    });
    expect(result.success).toBe(true);
  });

  it('evento de entrega automática', () => {
    const result = orderDeliveredEventSchema.safeParse({
      id: ID.order,
      deliveredAt: '2026-11-11T18:30:00Z',
      deliveredAuto: true,
    });
    expect(result.success).toBe(true);
  });
});
