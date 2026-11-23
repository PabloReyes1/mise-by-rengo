import type { MenuResponse } from '@mise/shared/contracts/catalog';
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
let waiter: Headers;
let kds: Headers;
let waiterId: string;
let menu: MenuResponse;

async function loginAs(username: string, password: string, type = 'WAITER'): Promise<Headers> {
  const { code } = await createPairingCode(prisma, { branchId: toDbId(branchId) });
  const device = (
    await app.inject({
      method: 'POST',
      url: '/api/devices/pair',
      payload: { code, name: 'D', type },
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

const post = (url: string, headers: Headers, payload: object = {}) =>
  app.inject({ method: 'POST', url, headers, payload });

async function sendRound(tableName: string, products: string[]) {
  const zoneId =
    (await prisma.zone.findFirst())?.id ??
    toDbId((await post('/api/zones', admin, { name: 'Salón' })).json().id);
  const table = (
    await post('/api/tables', admin, { zoneId: toApiId(zoneId), name: tableName, capacity: 4 })
  ).json();
  const occ = (
    await post('/api/occupancies', waiter, {
      id: newId(),
      tableId: table.id,
      orderTypeCode: 'MESA',
      guests: 2,
    })
  ).json();
  const items = products.map((name) => {
    const p = menu.products.find((x) => x.name === name)!;
    return {
      id: newId(),
      billId: occ.bills[0].id,
      productId: p.id,
      quantity: 1,
      unitPrice: p.price,
    };
  });
  const res = await post('/api/orders', waiter, {
    id: newId(),
    occupancyId: occ.id,
    clientSentAt: new Date().toISOString(),
    items,
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string; items: { id: string }[] }>();
}

async function eventsNamed(event: string) {
  for (let i = 0; i < 50; i++) {
    const rows = await prisma.realtimeEvent.findMany({ where: { event } });
    if (rows.length) return rows;
    await new Promise((r) => setTimeout(r, 20));
  }
  return [];
}

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  admin = await loginAs('dev', 'desarrollo-local');
  waiterId = await createUser('ana', 'Mesero', { password: 'clave-mesero-1' });
  waiter = await loginAs('ana', 'clave-mesero-1');
  await createUser('cocina', 'Cocina', { password: 'clave-cocina-1' });
  kds = await loginAs('cocina', 'clave-cocina-1', 'KDS');
  menu = (await app.inject({ method: 'GET', url: '/api/menu', headers: admin })).json();
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('cola del KDS (Docs/05 paso 5)', () => {
  it('lista lo más antiguo primero, con mesa, zona y mesero', async () => {
    const first = await sendRound('5', ['Café de olla']);
    const second = await sendRound('6', ['Guacamol con totopos']);
    const res = await app.inject({ method: 'GET', url: '/api/kds/orders', headers: kds });
    expect(res.statusCode).toBe(200);
    const list = res.json<{ id: string; table: string; waiterName: string }[]>();
    expect(list.map((o) => o.id)).toEqual([first.id, second.id]);
    expect(list[0]).toMatchObject({ table: '5 · Salón', waiterName: 'ana' });
  });

  it('el mesero no puede operar el KDS', async () => {
    const order = await sendRound('5', ['Café de olla']);
    const res = await post(`/api/orders/${order.id}/accept`, waiter);
    expect(res.json().error.code).toBe('AUTHORIZATION_REQUIRED');
  });
});

describe('aceptar, listo y recall (Docs/05 pasos 5 a 7)', () => {
  it('aceptar es idempotente: dos pantallas a la vez conservan la primera marca', async () => {
    const order = await sendRound('5', ['Café de olla']);
    const a = await post(`/api/orders/${order.id}/accept`, kds);
    const b = await post(`/api/orders/${order.id}/accept`, kds);
    expect(a.json()).toMatchObject({ status: 'EN_PREPARACION' });
    expect(b.json().acceptedAt).toBe(a.json().acceptedAt);
    const accepted = await eventsNamed('order.accepted');
    expect(accepted).toHaveLength(1);
    expect(accepted[0]!.rooms).toEqual(['kds', 'branch', `user:${waiterId}`]);
  });

  it('marcar ítems uno a uno: el pedido queda LISTO con el último (y avisa al mesero y a caja)', async () => {
    const order = await sendRound('5', ['Café de olla', 'Guacamol con totopos']);
    const r1 = await post(`/api/order-items/${order.items[0]!.id}/ready`, kds);
    expect(r1.json()).toMatchObject({ status: 'EN_PREPARACION' });
    const r2 = await post(`/api/order-items/${order.items[1]!.id}/ready`, kds);
    expect(r2.json().status).toBe('LISTO');
    expect(r2.json().items.every((i: { status: string }) => i.status === 'LISTO')).toBe(true);
    const ready = await eventsNamed('order.ready');
    expect(ready[0]!.rooms).toEqual(['kds', 'branch', `user:${waiterId}`, 'cash']);
  });

  it('pedido completo listo y recall: vuelve a preparación y conserva el primer ready_at', async () => {
    const order = await sendRound('5', ['Café de olla', 'Guacamol con totopos']);
    const ready = (await post(`/api/orders/${order.id}/ready`, kds)).json();
    expect(ready.status).toBe('LISTO');
    const recalled = await post(`/api/orders/${order.id}/recall`, kds);
    expect(recalled.json()).toMatchObject({ status: 'EN_PREPARACION', readyAt: ready.readyAt });
    const again = (await post(`/api/orders/${order.id}/ready`, kds)).json();
    expect(again).toMatchObject({ status: 'LISTO', readyAt: ready.readyAt });
  });

  it('un pedido entregado o cancelado ya no se opera en cocina', async () => {
    const order = await sendRound('5', ['Café de olla']);
    await prisma.order.update({ where: { id: toDbId(order.id) }, data: { status: 'CANCELADO' } });
    const res = await post(`/api/orders/${order.id}/accept`, kds);
    expect(res.statusCode).toBe(400);
  });
});
