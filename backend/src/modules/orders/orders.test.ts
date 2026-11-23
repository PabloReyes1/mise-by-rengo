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
let menu: MenuResponse;
let occupancyId: string;
let billId: string;

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

/** Empareja una pantalla de cocina: con KDS solo se entrega desde LISTO (PA-058, SC-60) */
async function pairKitchen() {
  const { code } = await createPairingCode(prisma, { branchId: toDbId(branchId) });
  await app.inject({
    method: 'POST',
    url: '/api/devices/pair',
    payload: { code, name: 'Cocina', type: 'KDS' },
  });
}
const post = (url: string, headers: Headers, payload: object) =>
  app.inject({ method: 'POST', url, headers, payload });

const product = (name: string) => menu.products.find((p) => p.name === name)!;
function modifier(name: string) {
  for (const g of menu.modifierGroups) {
    const m = g.modifiers.find((x) => x.name === name);
    if (m) return { modifierId: m.id, priceDelta: m.priceDelta };
  }
  throw new Error(`No existe ${name}`);
}

/** Ítem de la ronda con el precio del menú */
function item(name: string, extra: Record<string, unknown> = {}) {
  const p = product(name);
  return { id: newId(), billId, productId: p.id, quantity: 1, unitPrice: p.price, ...extra };
}

function send(items: object[], headers: Headers = waiter, extra: Record<string, unknown> = {}) {
  return post('/api/orders', headers, {
    id: newId(),
    occupancyId,
    clientSentAt: new Date().toISOString(),
    items,
    ...extra,
  });
}

async function billTotals(id = billId) {
  const b = await prisma.bill.findUniqueOrThrow({ where: { id: toDbId(id) } });
  return { subtotal: b.subtotal.toFixed(2), total: b.total.toFixed(2) };
}

async function openTable(headers: Headers, name: string) {
  const zoneId =
    (await prisma.zone.findFirst())?.id ??
    toDbId((await post('/api/zones', admin, { name: 'Salón' })).json().id);
  const table = (
    await post('/api/tables', admin, { zoneId: toApiId(zoneId), name, capacity: 4 })
  ).json();
  const occ = (
    await post('/api/occupancies', headers, {
      id: newId(),
      tableId: table.id,
      orderTypeCode: 'MESA',
      guests: 2,
    })
  ).json();
  return { tableId: table.id as string, occupancy: occ };
}

async function setStatus(orderId: string, status: string) {
  await prisma.order.update({ where: { id: toDbId(orderId) }, data: { status } });
  await prisma.orderItem.updateMany({ where: { orderId: toDbId(orderId) }, data: { status } });
}

async function cancelReason(type = 'CANCEL_ITEM') {
  return toApiId((await prisma.reason.findFirstOrThrow({ where: { type } })).id);
}

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  admin = await loginAs('dev', 'desarrollo-local');
  await createUser('ana', 'Mesero', { password: 'clave-mesero-1' });
  waiter = await loginAs('ana', 'clave-mesero-1');
  menu = (await app.inject({ method: 'GET', url: '/api/menu', headers: admin })).json();
  const opened = await openTable(waiter, '5');
  occupancyId = opened.occupancy.id;
  billId = opened.occupancy.bills[0].id;
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('enviar ronda (POST /api/orders, Docs/05 paso 4)', () => {
  it('crea el pedido con folio, ronda 1 y los totales de la cuenta', async () => {
    const res = await send([
      item('Churrasco', {
        quantity: 2,
        modifiers: [modifier('Término medio'), modifier('Aguacate')],
        note: 'sin cebolla',
      }),
      item('Café de olla'),
    ]);
    expect(res.statusCode).toBe(201);
    const order = res.json();
    expect(order).toMatchObject({ roundNumber: 1, folio: '000001', status: 'ENVIADO' });
    // (95 + 0 + 8) × 2 = 206; + 12 = 218
    expect(order.items[0]).toMatchObject({
      productName: 'Churrasco',
      modifiersTotal: '8.00',
      lineTotal: '206.00',
      note: 'sin cebolla',
      status: 'ENVIADO',
    });
    expect(order.items[0].modifiers.map((m: { name: string }) => m.name).sort()).toEqual([
      'Aguacate',
      'Término medio',
    ]);
    expect(await billTotals()).toEqual({ subtotal: '218.00', total: '218.00' });
    expect(order.tempFolio).toBeNull();
  });

  it('la segunda ronda es la 2 (ADICIONAL) y toma el siguiente folio', async () => {
    await send([item('Café de olla')]);
    const second = (await send([item('Limonada', { modifiers: [modifier('Normal')] })])).json();
    expect(second).toMatchObject({ roundNumber: 2, folio: '000002' });
  });

  it('respeta el precio que vio el mesero aunque el menú haya cambiado (Docs/09 §6.3)', async () => {
    const res = await send([item('Café de olla', { unitPrice: '10.00' })]);
    expect(res.json().items[0].lineTotal).toBe('10.00');
  });

  it('reenviar la misma ronda devuelve la misma, sin duplicar (idempotente)', async () => {
    const body = {
      id: newId(),
      occupancyId,
      clientSentAt: new Date().toISOString(),
      items: [item('Café de olla')],
    };
    const first = await post('/api/orders', waiter, body);
    const again = await post('/api/orders', waiter, body);
    expect(first.statusCode).toBe(201);
    expect(again.statusCode).toBe(200);
    expect(again.json().folio).toBe(first.json().folio);
    expect(await prisma.order.count()).toBe(1);
    expect(await billTotals()).toMatchObject({ subtotal: '12.00' });
  });

  it('con folio temporal (enviada sin conexión) queda marcada como tardía', async () => {
    const res = await send([item('Café de olla')], waiter, { tempFolio: 'M3-0005' });
    expect(res.json()).toMatchObject({ tempFolio: 'M3-0005', syncedLate: true, folio: '000001' });
  });
});

describe('reglas del menú', () => {
  it('un grupo obligatorio sin elegir → 400 MODIFIER_RULES', async () => {
    const res = await send([item('Churrasco')]);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('MODIFIER_RULES');
  });

  it('un modificador de otro producto → MODIFIER_RULES', async () => {
    const res = await send([item('Café de olla', { modifiers: [modifier('Aguacate')] })]);
    expect(res.json().error.code).toBe('MODIFIER_RULES');
  });

  it('más de una opción en un grupo de máximo 1 → MODIFIER_RULES', async () => {
    const res = await send([
      item('Horchata', { modifiers: [modifier('Normal'), modifier('Grande')] }),
    ]);
    expect(res.json().error.code).toBe('MODIFIER_RULES');
  });

  it('un producto agotado → 409 PRODUCT_SOLD_OUT', async () => {
    await prisma.product.update({
      where: { id: toDbId(product('Jocón').id) },
      data: { status: 'SOLD_OUT' },
    });
    const res = await send([item('Jocón')]);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatchObject({
      code: 'PRODUCT_SOLD_OUT',
      details: { productId: product('Jocón').id },
    });
    expect(await prisma.order.count()).toBe(0);
  });

  it('combo: elige una opción por grupo, con los modificadores de la opción', async () => {
    // GET /api/menu todavía no trae el id de los grupos del combo (catalog, Deniscito): de la base
    const groups = await prisma.comboGroup.findMany({
      where: { comboProductId: toDbId(product('Menú del día').id) },
      orderBy: { sort: 'asc' },
    });
    const [plato, bebida] = groups.map((g) => ({ id: toApiId(g.id) }));
    const component = (groupId: string, name: string, modifiers: object[] = []) => ({
      comboGroupId: groupId,
      productId: product(name).id,
      priceDelta: '0.00',
      modifiers,
    });
    const ok = await send([
      item('Menú del día', {
        components: [
          component(plato!.id, 'Pepián de pollo'),
          component(bebida!.id, 'Horchata', [modifier('Grande')]),
        ],
      }),
    ]);
    expect(ok.statusCode).toBe(201);
    // 75 + Grande 5 = 80
    expect(ok.json().items[0]).toMatchObject({ modifiersTotal: '5.00', lineTotal: '80.00' });
    expect(ok.json().items[0].components).toHaveLength(2);

    const missing = await send([
      item('Menú del día', { components: [component(plato!.id, 'Pepián de pollo')] }),
    ]);
    expect(missing.json().error.code).toBe('MODIFIER_RULES');

    const wrongOption = await send([
      item('Menú del día', {
        components: [
          component(plato!.id, 'Churrasco'),
          component(bebida!.id, 'Horchata', [modifier('Normal')]),
        ],
      }),
    ]);
    expect(wrongOption.json().error.code).toBe('MODIFIER_RULES');
  });
});

describe('mesa y cuentas', () => {
  it('una cuenta de otra mesa → 400', async () => {
    const other = await openTable(waiter, '6');
    const res = await send([item('Café de olla', { billId: other.occupancy.bills[0].id })]);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('otro mesero no envía a la mesa ajena sin 🔑; con la 🔑 de un gerente sí', async () => {
    await createUser('beto', 'Mesero', { password: 'clave-mesero-2' });
    const other = await loginAs('beto', 'clave-mesero-2');
    const denied = await send([item('Café de olla')], other);
    expect(denied.json().error.code).toBe('AUTHORIZATION_REQUIRED');

    const ginaId = await createUser('gina', 'Gerente', { pin: '4821' });
    const ok = await send([item('Café de olla')], other, {
      authorization: { userId: ginaId, pin: '4821' },
    });
    expect(ok.statusCode).toBe(201);
  });

  it('lista las rondas de la mesa', async () => {
    await send([item('Café de olla')]);
    await send([item('Limonada', { modifiers: [modifier('Normal')] })]);
    const list = (
      await app.inject({
        method: 'GET',
        url: `/api/occupancies/${occupancyId}/orders`,
        headers: waiter,
      })
    ).json();
    expect(list.map((o: { roundNumber: number }) => o.roundNumber)).toEqual([1, 2]);
  });

  it('al unir mesas, los pedidos de la unida pasan a la principal', async () => {
    const six = await openTable(waiter, '6');
    await post('/api/orders', waiter, {
      id: newId(),
      occupancyId: six.occupancy.id,
      clientSentAt: new Date().toISOString(),
      items: [{ ...item('Café de olla'), billId: six.occupancy.bills[0].id }],
    });
    await post(`/api/occupancies/${occupancyId}/merge`, admin, {
      sourceOccupancyId: six.occupancy.id,
    });
    // La 5 ya tiene la ronda de la 6: la siguiente es la 2
    expect((await send([item('Café de olla')])).json().roundNumber).toBe(2);
  });
});

describe('entregar (POST /api/orders/:id/deliver, Docs/05 paso 9)', () => {
  it('con pantalla de cocina solo un pedido listo se entrega; repetirlo no cambia nada', async () => {
    await pairKitchen();
    const order = (await send([item('Café de olla')])).json();
    const early = await post(`/api/orders/${order.id}/deliver`, waiter, {});
    expect(early.json().error.code).toBe('VALIDATION_ERROR');

    await setStatus(order.id, 'LISTO');
    const res = await post(`/api/orders/${order.id}/deliver`, waiter, {});
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ENTREGADO', deliveredAuto: false });
    expect(res.json().items[0].status).toBe('ENTREGADO');
    expect(res.json().deliveredAt).not.toBeNull();

    const again = await post(`/api/orders/${order.id}/deliver`, waiter, {});
    expect(again.json().deliveredAt).toBe(res.json().deliveredAt);
  });

  it('sin pantalla de cocina el mesero entrega desde la cola (PA-058, SC-60)', async () => {
    const floor = (await app.inject({ method: 'GET', url: '/api/floor', headers: waiter })).json();
    expect(floor.kitchenDisplay).toBe(false);
    const order = (await send([item('Café de olla')])).json();
    const res = await post(`/api/orders/${order.id}/deliver`, waiter, {});
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ENTREGADO', deliveredAuto: false });
    expect(res.json().items[0].status).toBe('ENTREGADO');

    await pairKitchen();
    const withKds = (
      await app.inject({ method: 'GET', url: '/api/floor', headers: waiter })
    ).json();
    expect(withKds.kitchenDisplay).toBe(true);
  });
});

describe('cancelar ítem (POST /api/order-items/:id/cancel, Docs/05 §7)', () => {
  it('el mesero necesita 🔑; con ella se cancela, baja la cuenta y queda en la bitácora', async () => {
    const order = (await send([item('Café de olla'), item('Rellenitos de plátano')])).json();
    const [cafe] = order.items;
    const reasonId = await cancelReason();
    const denied = await post(`/api/order-items/${cafe.id}/cancel`, waiter, { reasonId });
    expect(denied.json().error).toMatchObject({
      code: 'AUTHORIZATION_REQUIRED',
      details: { permission: 'order.cancel_sent' },
    });

    const ginaId = await createUser('gina', 'Gerente', { pin: '4821' });
    const res = await post(`/api/order-items/${cafe.id}/cancel`, waiter, {
      reasonId,
      note: 'se equivocó',
      authorization: { userId: ginaId, pin: '4821' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ENVIADO'); // queda otro ítem
    expect(res.json().items.find((i: { id: string }) => i.id === cafe.id)).toMatchObject({
      status: 'CANCELADO',
    });
    expect(await billTotals()).toMatchObject({ subtotal: '22.00' });

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'order.item_cancel' } });
    expect(log).toMatchObject({ authorizedBy: toDbId(ginaId), note: 'se equivocó' });
    expect(log.after).toMatchObject({ afterReady: false, product: 'Café de olla' });

    const twice = await post(`/api/order-items/${cafe.id}/cancel`, admin, { reasonId });
    expect(twice.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('un motivo que no es de cancelación → 400', async () => {
    const order = (await send([item('Café de olla')])).json();
    const res = await post(`/api/order-items/${order.items[0].id}/cancel`, admin, {
      reasonId: await cancelReason('DISCOUNT'),
    });
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('cancelar todo lo de un pedido listo: merma y el pedido pasa a CANCELADO (PA-055)', async () => {
    const order = (await send([item('Café de olla')])).json();
    await setStatus(order.id, 'LISTO');
    const res = await post(`/api/order-items/${order.items[0].id}/cancel`, admin, {
      reasonId: await cancelReason(),
    });
    expect(res.json().status).toBe('CANCELADO');
    const row = await prisma.orderItem.findUniqueOrThrow({
      where: { id: toDbId(order.items[0].id) },
    });
    expect(row.cancelAfterReady).toBe(true);
    expect(await billTotals()).toMatchObject({ subtotal: '0.00' });
  });

  it('un pedido ENTREGADO sigue entregado aunque se cancele todo (merma)', async () => {
    const order = (await send([item('Café de olla')])).json();
    await setStatus(order.id, 'ENTREGADO');
    const res = await post(`/api/order-items/${order.items[0].id}/cancel`, admin, {
      reasonId: await cancelReason(),
    });
    expect(res.json().status).toBe('ENTREGADO');
  });
});

describe('tiempo real (Docs/08 §3.1)', () => {
  it('enviar una ronda publica order.sent para cocina y sala', async () => {
    const res = await send([item('Café de olla')]);
    expect(res.statusCode).toBe(201);
    let event = null;
    for (let i = 0; i < 50 && !event; i++) {
      event = await prisma.realtimeEvent.findFirst({ where: { event: 'order.sent' } });
      if (!event) await new Promise((r) => setTimeout(r, 20));
    }
    expect(event?.rooms).toEqual(['kds', 'branch']);
    expect((event?.payload as { id: string }).id).toBe(res.json().id);
  });
});
