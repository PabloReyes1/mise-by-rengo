import { describe, expect, it } from 'vitest';
import {
  authorizationSchema,
  pairDeviceRequestSchema,
  pinLoginRequestSchema,
} from '../auth/index.js';
import { moneySchema } from '../common/index.js';
import { branchSchema } from '../config/index.js';
import { comboGroupSchema, saveModifierGroupSchema, saveProductSchema } from './index.js';

const ID = '01JD4K7Q0000000000000000A1';

describe('contratos v1', () => {
  it('montos: string con 2 decimales, nunca número', () => {
    expect(moneySchema.safeParse('64.00').success).toBe(true);
    expect(moneySchema.safeParse('64.5').success).toBe(false);
    expect(moneySchema.safeParse(64).success).toBe(false);
    expect(moneySchema.safeParse('-1.00').success).toBe(false);
  });

  it('PIN de 4 a 6 dígitos (RF-030)', () => {
    expect(pinLoginRequestSchema.safeParse({ userId: ID, pin: '0000' }).success).toBe(true);
    expect(pinLoginRequestSchema.safeParse({ userId: ID, pin: '123' }).success).toBe(false);
    expect(authorizationSchema.safeParse({ userId: ID, pin: '1234567' }).success).toBe(false);
  });

  it('emparejar: código de 6 dígitos y tipo de dispositivo conocido', () => {
    expect(
      pairDeviceRequestSchema.safeParse({ code: '482113', name: 'Caja 1', type: 'CASH' }).success,
    ).toBe(true);
    expect(
      pairDeviceRequestSchema.safeParse({ code: '4821', name: 'Caja 1', type: 'CASH' }).success,
    ).toBe(false);
    expect(
      pairDeviceRequestSchema.safeParse({ code: '482113', name: 'Caja', type: 'TV' }).success,
    ).toBe(false);
  });

  it('grupo de modificadores: el mínimo no puede pasar al máximo (RF-013)', () => {
    const base = { name: 'Extras', required: false, modifiers: [] };
    expect(saveModifierGroupSchema.safeParse({ ...base, minSelect: 0, maxSelect: 3 }).success).toBe(
      true,
    );
    expect(saveModifierGroupSchema.safeParse({ ...base, minSelect: 4, maxSelect: 3 }).success).toBe(
      false,
    );
  });

  it('combo: cada grupo necesita al menos una opción (RF-015)', () => {
    expect(
      comboGroupSchema.safeParse({ name: 'Bebida', minSelect: 1, maxSelect: 1, options: [] })
        .success,
    ).toBe(false);
  });

  it('producto: valores por defecto activo, sin combo y sin modificadores', () => {
    const p = saveProductSchema.parse({
      categoryId: ID,
      name: 'Jocón',
      sku: 'PF-002',
      price: '58.00',
    });
    expect(p).toMatchObject({ status: 'ACTIVE', isCombo: false, modifierGroupIds: [] });
  });

  it('sucursal: prefijo de folio de hasta 3 caracteres en mayúscula', () => {
    const b = { id: ID, name: 'Centro', address: '', phone: '', timezone: null, active: true };
    expect(branchSchema.safeParse({ ...b, folioPrefix: 'C' }).success).toBe(true);
    expect(branchSchema.safeParse({ ...b, folioPrefix: 'cen1' }).success).toBe(false);
  });
});
