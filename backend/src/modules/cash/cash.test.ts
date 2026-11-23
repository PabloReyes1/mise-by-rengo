import { newId } from '@mise/shared/domain/ids';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../core/app.js';
import { toApiId, toDbId } from '../../core/ids.js';
import { resetDb } from '../../core/test-db.js';
import { createUser, prisma, setupFixture } from '../../core/test-app.js';
import { createPairingCode } from '../auth/index.js';

type Headers = Record<string, string>;
let app: App;
let branchId: string;
let admin: Headers;
let cashier: Headers;
let registerId: string;

async function loginAs(username: string, password: string): Promise<Headers> {
  const { code } = await createPairingCode(prisma, { branchId: toDbId(branchId) });
  const device = (
    await app.inject({
      method: 'POST',
      url: '/api/devices/pair',
      payload: { code, name: 'Caja', type: 'CASH' },
    })
  ).json();
  const session = (
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-device-id': device.deviceId, 'x-device-token': device.deviceToken },
      payload: { username, password },
    })
  ).json();
  return { authorization: `Bearer ${session.accessToken}`, 'x-device-id': device.deviceId };
}

const post = (url: string, headers: Headers, payload: object) =>
  app.inject({ method: 'POST', url, headers, payload });
const open = (headers: Headers, openingFloat = '500.00', id = newId()) =>
  post('/api/shifts', headers, { id, cashRegisterId: registerId, openingFloat });
const reason = async (type: string) =>
  toApiId((await prisma.reason.findFirstOrThrow({ where: { type } })).id);

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  admin = await loginAs('dev', 'desarrollo-local');
  await createUser('carlos', 'Cajero', { password: 'clave-caja-123' });
  cashier = await loginAs('carlos', 'clave-caja-123');
  const list = (
    await app.inject({ method: 'GET', url: '/api/cash-registers', headers: admin })
  ).json();
  registerId = list[0].id;
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('cajas (Docs/08 §2.8)', () => {
  it('la sucursal nace con "Caja 1", principal y de fondo variable (SC-56)', async () => {
    const list = (
      await app.inject({ method: 'GET', url: '/api/cash-registers', headers: cashier })
    ).json();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      name: 'Caja 1',
      isMain: true,
      openingFloatMode: 'VARIABLE',
      openShift: null,
    });
  });
});

describe('abrir turno (Docs/05 paso 1)', () => {
  it('el cajero abre con el fondo que escribe; repetir el mismo id devuelve el mismo turno', async () => {
    const id = newId();
    const a = await open(cashier, '350.00', id);
    expect(a.statusCode).toBe(201);
    expect(a.json()).toMatchObject({
      status: 'ABIERTO',
      openingFloat: '350.00',
      openedByName: 'carlos',
    });
    const b = await open(cashier, '350.00', id);
    expect(b.statusCode).toBe(200);
    expect(b.json().id).toBe(id);
  });

  it('un solo turno abierto por caja: el segundo da 409 SHIFT_ALREADY_OPEN', async () => {
    await open(cashier);
    const second = await open(admin);
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('SHIFT_ALREADY_OPEN');
  });

  it('en una caja de fondo FIJO se usa el monto configurado', async () => {
    await prisma.cashRegister.update({
      where: { id: toDbId(registerId) },
      data: { openingFloatMode: 'FIJO', openingFloatAmount: 400 },
    });
    expect((await open(cashier, '9999.00')).json().openingFloat).toBe('400.00');
  });

  it('el mesero no puede abrir turno', async () => {
    await createUser('ana', 'Mesero', { password: 'clave-mesero-1' });
    const waiter = await loginAs('ana', 'clave-mesero-1');
    expect((await open(waiter)).json().error.code).toBe('AUTHORIZATION_REQUIRED');
  });
});

describe('retiros, depósitos y efectivo esperado', () => {
  it('el esperado suma depósitos y resta retiros; el cajero no lo ve (corte a ciegas)', async () => {
    const shift = (await open(cashier, '500.00')).json();
    const dep = await post(`/api/shifts/${shift.id}/movements`, admin, {
      id: newId(),
      type: 'DEPOSITO',
      amount: '200.00',
      reasonId: await reason('CASH_DEPOSIT'),
    });
    expect(dep.statusCode).toBe(200);
    const out = await post(`/api/shifts/${shift.id}/movements`, admin, {
      id: newId(),
      type: 'RETIRO',
      amount: '150.00',
      reasonId: await reason('CASH_WITHDRAWAL'),
      note: 'Pago a proveedor',
    });
    expect(out.json()).toMatchObject({
      depositsTotal: '200.00',
      withdrawalsTotal: '150.00',
      expectedCash: '550.00',
    });
    expect(out.json().movements).toHaveLength(2);
    const blind = (
      await app.inject({ method: 'GET', url: `/api/shifts/${shift.id}`, headers: cashier })
    ).json();
    expect(blind.expectedCash).toBeNull();
  });

  it('el cajero necesita 🔑 para retirar; con el motivo equivocado no se acepta', async () => {
    const shift = (await open(cashier)).json();
    const noKey = await post(`/api/shifts/${shift.id}/movements`, cashier, {
      id: newId(),
      type: 'RETIRO',
      amount: '50.00',
      reasonId: await reason('CASH_WITHDRAWAL'),
    });
    expect(noKey.json().error.code).toBe('AUTHORIZATION_REQUIRED');
    // Con la 🔑 de una gerente pasa, y el movimiento dice quién autorizó (comprobante, Docs/11 §4.5)
    const ginaId = await createUser('gina', 'Gerente', { pin: '4821' });
    const withKey = await post(`/api/shifts/${shift.id}/movements`, cashier, {
      id: newId(),
      type: 'RETIRO',
      amount: '50.00',
      reasonId: await reason('CASH_WITHDRAWAL'),
      authorization: { userId: ginaId, pin: '4821' },
    });
    expect(withKey.json().movements[0]).toMatchObject({
      userName: 'carlos',
      authorizedByName: 'gina',
    });
    const wrong = await post(`/api/shifts/${shift.id}/movements`, admin, {
      id: newId(),
      type: 'RETIRO',
      amount: '50.00',
      reasonId: await reason('CASH_DEPOSIT'),
    });
    expect(wrong.statusCode).toBe(400);
  });
});

describe('corte de caja (Docs/05 paso 13)', () => {
  it('a ciegas: el cajero no ve el esperado al empezar; al cerrar sale la diferencia', async () => {
    const shift = (await open(cashier, '500.00')).json();
    await post(`/api/shifts/${shift.id}/movements`, admin, {
      id: newId(),
      type: 'RETIRO',
      amount: '100.00',
      reasonId: await reason('CASH_WITHDRAWAL'),
    });
    const start = (await post(`/api/shifts/${shift.id}/start-close`, cashier, {})).json();
    expect(start).toMatchObject({ status: 'EN_CORTE', expectedCash: null });
    const noComment = await post(`/api/shifts/${shift.id}/close`, cashier, {
      countedCash: '390.00',
    });
    expect(noComment.json().error.message).toMatch(/comentario/);
    const closed = (
      await post(`/api/shifts/${shift.id}/close`, cashier, {
        countedCash: '390.00',
        comment: 'Faltante por cambio',
      })
    ).json();
    expect(closed).toMatchObject({
      status: 'CERRADO',
      expectedCash: '400.00',
      countedCash: '390.00',
      difference: '-10.00',
      closedByName: 'carlos',
    });
  });

  it('el conteo por denominación tiene que sumar lo contado', async () => {
    const shift = (await open(cashier, '300.00')).json();
    const bad = await post(`/api/shifts/${shift.id}/close`, admin, {
      countedCash: '300.00',
      counts: [{ denomination: '100.00', quantity: 2 }],
    });
    expect(bad.json().error.message).toMatch(/suma 200\.00/);
    const ok = await post(`/api/shifts/${shift.id}/close`, admin, {
      countedCash: '300.00',
      counts: [
        { denomination: '100.00', quantity: 2 },
        { denomination: '50.00', quantity: 2 },
      ],
    });
    expect(ok.json()).toMatchObject({
      difference: '0.00',
      counts: [
        { denomination: '100.00', quantity: 2 },
        { denomination: '50.00', quantity: 2 },
      ],
    });
  });

  it('un turno cerrado es inmutable y se puede abrir otro en la caja', async () => {
    const shift = (await open(cashier, '200.00')).json();
    await post(`/api/shifts/${shift.id}/close`, admin, { countedCash: '200.00' });
    const move = await post(`/api/shifts/${shift.id}/movements`, admin, {
      id: newId(),
      type: 'DEPOSITO',
      amount: '10.00',
      reasonId: await reason('CASH_DEPOSIT'),
    });
    expect(move.statusCode).toBe(400);
    const report = (
      await app.inject({ method: 'GET', url: `/api/shifts/${shift.id}/report`, headers: cashier })
    ).json();
    expect(report).toMatchObject({ status: 'CERRADO', countedCash: '200.00' });
    expect((await open(cashier)).statusCode).toBe(201);
  });
});

describe('administrar cajas (H3 #21, SC-64)', () => {
  const fields = {
    name: 'Caja barra',
    openingFloatMode: 'FIJO',
    openingFloatAmount: '300.00',
    countByDenomination: 'OBLIGATORIO',
    isMain: false,
  };
  const put = (id: string, body: object) =>
    app.inject({ method: 'PUT', url: `/api/cash-registers/${id}`, headers: admin, payload: body });

  it('crear una caja (idempotente); el cajero no administra ni ve las inactivas', async () => {
    const id = newId();
    const res = await post('/api/cash-registers', admin, { ...fields, id });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ ...fields, active: true, openShift: null });
    expect((await post('/api/cash-registers', admin, { ...fields, id })).statusCode).toBe(200);
    const dup = await post('/api/cash-registers', admin, {
      ...fields,
      id: newId(),
      name: 'caja barra',
    });
    expect(dup.statusCode).toBe(400);
    expect(
      (await post('/api/cash-registers', cashier, { ...fields, id: newId(), name: 'X' })).json()
        .error.code,
    ).toBe('AUTHORIZATION_REQUIRED');
    const all = await app.inject({
      method: 'GET',
      url: '/api/cash-registers?all=true',
      headers: cashier,
    });
    expect(all.statusCode).toBe(403);
  });

  it('una sola principal: marcar otra le quita la marca; la principal no se desmarca ni se desactiva', async () => {
    const barra = (await post('/api/cash-registers', admin, { ...fields, id: newId() })).json();
    const main = await put(registerId, { ...fields, name: 'Caja 1', isMain: false, active: true });
    expect(main.json().error.message).toMatch(/Siempre hay una caja principal/);
    const moved = await put(barra.id, { ...fields, isMain: true, active: true });
    expect(moved.json().isMain).toBe(true);
    const list = (
      await app.inject({ method: 'GET', url: '/api/cash-registers', headers: admin })
    ).json();
    expect(list.filter((r: { isMain: boolean }) => r.isMain)).toHaveLength(1);
    const off = await put(barra.id, { ...fields, isMain: true, active: false });
    expect(off.json().error.message).toMatch(/principal no se desactiva/);
  });

  it('no se desactiva con un turno abierto; desactivada sale de Caja pero no de la administración', async () => {
    const barra = (await post('/api/cash-registers', admin, { ...fields, id: newId() })).json();
    const shift = (
      await post('/api/shifts', cashier, {
        id: newId(),
        cashRegisterId: barra.id,
        openingFloat: '1.00',
      })
    ).json();
    expect(shift.openingFloat).toBe('300.00');
    const busy = await put(barra.id, { ...fields, active: false });
    expect(busy.json().error.message).toMatch(/turno abierto/);
    await post(`/api/shifts/${shift.id}/close`, admin, {
      countedCash: '300.00',
      counts: [{ denomination: '100.00', quantity: 3 }],
    });
    expect((await put(barra.id, { ...fields, active: false })).json().active).toBe(false);
    const forCash = (
      await app.inject({ method: 'GET', url: '/api/cash-registers', headers: cashier })
    ).json();
    expect(forCash.some((r: { id: string }) => r.id === barra.id)).toBe(false);
    const all = (
      await app.inject({ method: 'GET', url: '/api/cash-registers?all=true', headers: admin })
    ).json();
    expect(all.some((r: { id: string }) => r.id === barra.id)).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: 'cash.register.update' } })).toBe(1);
  });
});
