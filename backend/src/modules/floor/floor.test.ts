import { newId } from '@mise/shared/domain/ids';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../core/app.js';
import { toDbId } from '../../core/ids.js';
import { resetDb } from '../../core/test-db.js';
import { createUser, prisma, setupFixture } from '../../core/test-app.js';
import { createPairingCode } from '../auth/index.js';
import { businessDate } from './business-date.js';

type Headers = Record<string, string>;

let app: App;
let branchId: string;
let admin: Headers;
let waiter: Headers;
let waiterId: string;
let zoneId: string;
let tableId: string;

async function loginAs(username: string, password: string): Promise<Headers> {
  const { code } = await createPairingCode(prisma, { branchId: toDbId(branchId) });
  const device = (
    await app.inject({
      method: 'POST',
      url: '/api/devices/pair',
      payload: { code, name: 'D', type: 'WAITER' },
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

async function post(url: string, headers: Headers, payload: object) {
  return app.inject({ method: 'POST', url, headers, payload });
}

async function open(headers: Headers, body: Record<string, unknown> = {}) {
  return post('/api/occupancies', headers, {
    id: newId(),
    tableId,
    orderTypeCode: 'MESA',
    guests: 4,
    ...body,
  });
}

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  admin = await loginAs('dev', 'desarrollo-local');
  waiterId = await createUser('ana', 'Mesero', { password: 'clave-mesero-1' });
  waiter = await loginAs('ana', 'clave-mesero-1');
  zoneId = (await post('/api/zones', admin, { name: 'Salón' })).json().id;
  tableId = (await post('/api/tables', admin, { zoneId, name: '5', capacity: 4 })).json().id;
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('día de negocio (ADR-011)', () => {
  it('antes de la hora de corte cuenta para el día anterior', () => {
    // 01:30 en Guatemala (UTC-6) del sábado 14
    expect(businessDate(new Date('2026-11-14T07:30:00Z'), 'America/Guatemala', '04:00')).toBe(
      '2026-11-13',
    );
    // 04:00 en punto ya es sábado
    expect(businessDate(new Date('2026-11-14T10:00:00Z'), 'America/Guatemala', '04:00')).toBe(
      '2026-11-14',
    );
  });
});

describe('zonas y mesas (config.tables)', () => {
  it('el mapa muestra la zona con su mesa libre', async () => {
    const floor = (await app.inject({ method: 'GET', url: '/api/floor', headers: waiter })).json();
    expect(floor.zones).toHaveLength(1);
    expect(floor.zones[0]).toMatchObject({ name: 'Salón', active: true });
    expect(floor.zones[0].tables[0]).toMatchObject({
      name: '5',
      capacity: 4,
      shape: 'SQUARE',
      status: 'LIBRE',
      occupancy: null,
      version: 0,
    });
  });

  it('el mesero no puede crear zonas ni mesas', async () => {
    const res = await post('/api/zones', waiter, { name: 'Terraza' });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('AUTHORIZATION_REQUIRED');
  });

  it('no se repite el nombre de una mesa en la sucursal', async () => {
    const other = (await post('/api/zones', admin, { name: 'Terraza' })).json().id;
    const res = await post('/api/tables', admin, { zoneId: other, name: '5', capacity: 2 });
    expect(res.statusCode).toBe(400);
  });

  it('bloquear y desbloquear una mesa, con control de versión', async () => {
    const put = (body: object) =>
      app.inject({ method: 'PUT', url: `/api/tables/${tableId}`, headers: admin, payload: body });
    const blocked = await put({ blocked: true, version: 0 });
    expect(blocked.json()).toMatchObject({ status: 'BLOQUEADA', version: 1 });
    expect((await put({ blocked: false, version: 0 })).json().error.code).toBe('STALE_VERSION');
    expect((await open(waiter)).json().error.code).toBe('TABLE_OCCUPIED');
    expect((await put({ blocked: false, version: 1 })).json().status).toBe('LIBRE');
  });

  it('una mesa dada de baja desaparece del mapa', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/tables/${tableId}`,
      headers: admin,
      payload: { active: false, version: 0 },
    });
    const floor = (await app.inject({ method: 'GET', url: '/api/floor', headers: waiter })).json();
    expect(floor.zones[0].tables).toEqual([]);
  });

  it('cada cambio queda en la bitácora', async () => {
    expect(await prisma.auditLog.count({ where: { action: 'config.tables.update' } })).toBe(2);
  });
});

describe('abrir mesa (POST /api/occupancies, Docs/05 paso 2)', () => {
  it('crea la ocupación con la Cuenta 1 y la mesa queda ocupada', async () => {
    const res = await open(waiter);
    expect(res.statusCode).toBe(201);
    const occ = res.json();
    expect(occ).toMatchObject({
      tableId,
      orderTypeCode: 'MESA',
      waiterId,
      waiterName: 'ana',
      guests: 4,
      status: 'ABIERTA',
      version: 0,
    });
    expect(occ.bills).toEqual([expect.objectContaining({ name: 'Cuenta 1', status: 'ABIERTA' })]);
    expect(occ.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const floor = (await app.inject({ method: 'GET', url: '/api/floor', headers: waiter })).json();
    expect(floor.zones[0].tables[0]).toMatchObject({
      status: 'OCUPADA',
      currentOccupancyId: occ.id,
      occupancy: { id: occ.id, guests: 4, waiterName: 'ana' },
    });
  });

  it('la Cuenta 1 usa el id que manda el dispositivo (para trabajar sin conexión)', async () => {
    const billId = newId();
    const occ = (await open(waiter, { billId })).json();
    expect(occ.bills[0].id).toBe(billId);
  });

  it('una mesa ocupada no se puede volver a abrir: 409 TABLE_OCCUPIED', async () => {
    await open(waiter);
    const res = await open(admin);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('TABLE_OCCUPIED');
  });

  it('dos dispositivos abriendo la misma mesa a la vez: solo uno gana', async () => {
    const results = await Promise.all([open(waiter), open(admin)]);
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes).toEqual([201, 409]);
    expect(await prisma.occupancy.count({ where: { status: 'ABIERTA' } })).toBe(1);
  });

  it('reenviar el mismo id devuelve la misma ocupación (idempotente)', async () => {
    const id = newId();
    const first = await open(waiter, { id });
    const again = await open(waiter, { id });
    expect(first.statusCode).toBe(201);
    expect(again.statusCode).toBe(200);
    expect(again.json().id).toBe(id);
    expect(await prisma.bill.count()).toBe(1);
  });

  it('comensales fuera de rango (1 a 99)', async () => {
    expect((await open(waiter, { guests: 0 })).statusCode).toBe(400);
    expect((await open(waiter, { guests: 100 })).statusCode).toBe(400);
  });

  it('para llevar: sin mesa, con nombre y teléfono opcionales', async () => {
    const res = await post('/api/occupancies', waiter, {
      id: newId(),
      orderTypeCode: 'PARA_LLEVAR',
      guests: 1,
      customerName: 'Luis',
      customerPhone: '5555-1234',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ tableId: null, customerName: 'Luis' });
  });

  it('el tipo de orden decide si lleva mesa', async () => {
    expect((await open(waiter, { tableId: undefined })).statusCode).toBe(400);
    const takeaway = await open(waiter, { orderTypeCode: 'PARA_LLEVAR' });
    expect(takeaway.statusCode).toBe(400);
  });

  it('se puede abrir a nombre de otro mesero de la sucursal', async () => {
    const occ = (await open(admin, { waiterId })).json();
    expect(occ.waiterId).toBe(waiterId);
  });

  it('el rol Cocina no puede abrir mesas', async () => {
    await createUser('chef', 'Cocina', { password: 'clave-cocina-1' });
    const kitchen = await loginAs('chef', 'clave-cocina-1');
    expect((await open(kitchen)).json().error.code).toBe('AUTHORIZATION_REQUIRED');
  });
});

describe('consultar y editar la ocupación', () => {
  it('lista las ocupaciones abiertas de la sucursal', async () => {
    await open(waiter);
    const list = (
      await app.inject({ method: 'GET', url: '/api/occupancies?status=ABIERTA', headers: waiter })
    ).json();
    expect(list).toHaveLength(1);
  });

  it('cambiar comensales con la versión correcta', async () => {
    const occ = (await open(waiter)).json();
    const patch = (body: object) =>
      app.inject({
        method: 'PATCH',
        url: `/api/occupancies/${occ.id}`,
        headers: waiter,
        payload: body,
      });
    expect((await patch({ guests: 6, version: 0 })).json()).toMatchObject({
      guests: 6,
      version: 1,
    });
    expect((await patch({ guests: 2, version: 0 })).json().error.code).toBe('STALE_VERSION');
  });

  it('otro mesero sin table.view_all no ve ni edita la mesa ajena', async () => {
    const occ = (await open(waiter)).json();
    await createUser('beto', 'Mesero', { password: 'clave-mesero-2' });
    const other = await loginAs('beto', 'clave-mesero-2');
    const res = await app.inject({
      method: 'GET',
      url: `/api/occupancies/${occ.id}`,
      headers: other,
    });
    expect(res.statusCode).toBe(403);
    // El gerente/administrador sí (table.view_all)
    const ok = await app.inject({
      method: 'GET',
      url: `/api/occupancies/${occ.id}`,
      headers: admin,
    });
    expect(ok.statusCode).toBe(200);
  });

  it('no se bloquea ni se da de baja una mesa ocupada', async () => {
    await open(waiter);
    const res = await app.inject({
      method: 'PUT',
      url: `/api/tables/${tableId}`,
      headers: admin,
      payload: { blocked: true, version: 1 },
    });
    expect(res.json().error.code).toBe('TABLE_OCCUPIED');
  });
});
