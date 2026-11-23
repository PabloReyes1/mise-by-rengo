import { describe, expect, it } from 'vitest';
import {
  createTableSchema,
  openOccupancyRequestSchema,
  updateOccupancyRequestSchema,
  updateTableSchema,
} from './index.js';

const ID = '01JD4K7P0000000000000000A1';

describe('contrato v1 de floor', () => {
  it('abrir mesa: comensales de 1 a 99, enteros', () => {
    const base = { id: ID, tableId: ID, orderTypeCode: 'MESA' };
    expect(openOccupancyRequestSchema.safeParse({ ...base, guests: 1 }).success).toBe(true);
    expect(openOccupancyRequestSchema.safeParse({ ...base, guests: 99 }).success).toBe(true);
    for (const guests of [0, 100, 2.5]) {
      expect(openOccupancyRequestSchema.safeParse({ ...base, guests }).success).toBe(false);
    }
  });

  it('para llevar no exige mesa en el contrato (la regla la aplica el servidor)', () => {
    const parsed = openOccupancyRequestSchema.parse({
      id: ID,
      orderTypeCode: 'PARA_LLEVAR',
      guests: 1,
      customerName: '  Luis  ',
    });
    expect(parsed.customerName).toBe('Luis');
    expect(parsed.tableId).toBeUndefined();
  });

  it('mesa nueva: forma cuadrada por defecto y nombre obligatorio', () => {
    expect(createTableSchema.parse({ zoneId: ID, name: '5', capacity: 4 }).shape).toBe('SQUARE');
    expect(createTableSchema.safeParse({ zoneId: ID, name: ' ', capacity: 4 }).success).toBe(false);
  });

  it('editar mesa y ocupación exige la versión leída', () => {
    expect(updateTableSchema.safeParse({ blocked: true }).success).toBe(false);
    expect(updateOccupancyRequestSchema.safeParse({ guests: 3 }).success).toBe(false);
  });
});
