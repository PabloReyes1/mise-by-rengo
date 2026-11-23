import type { MenuResponse } from '@mise/shared/contracts/catalog';
import { newId } from '@mise/shared/domain/ids';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../core/app.js';
import { toDbId } from '../../core/ids.js';
import { resetDb } from '../../core/test-db.js';
import { createUser, prisma, setupFixture } from '../../core/test-app.js';
import { createPairingCode } from '../auth/index.js';

type Headers = Record<string, string>;
interface BillDto {
  id: string;
  name: string;
  subtotal: string;
  total: string;
  status: string;
  version: number;
}

let app: App;
let branchId: string;
let admin: Headers;
let waiter: Headers;
let menu: MenuResponse;
let occupancyId: string;
let bill1: string;

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

const post = (url: string, headers: Headers, payload: object) =>
  app.inject({ method: 'POST', url, headers, payload });

async function openTable(name: string) {
  const zone = (await post('/api/zones', admin, { name: `Zona ${name}` })).json();
  const table = (await post('/api/tables', admin, { zoneId: zone.id, name, capacity: 4 })).json();
  return (
    await post('/api/occupancies', waiter, {
      id: newId(),
      tableId: table.id,
      orderTypeCode: 'MESA',
      guests: 3,
    })
  ).json();
}

/** Envía una ronda de cafés (12.00 c/u) a la cuenta indicada */
async function sendCoffee(billId: string, quantity = 1, occ = occupancyId) {
  const cafe = menu.products.find((p) => p.name === 'Café de olla')!;
  const order = (
    await post('/api/orders', waiter, {
      id: newId(),
      occupancyId: occ,
      clientSentAt: new Date().toISOString(),
      items: [{ id: newId(), billId, productId: cafe.id, quantity, unitPrice: cafe.price }],
    })
  ).json();
  return order.items[0] as { id: string; version: number; quantity: number };
}

async function bills(): Promise<BillDto[]> {
  return (
    await app.inject({
      method: 'GET',
      url: `/api/occupancies/${occupancyId}/bills`,
      headers: waiter,
    })
  ).json();
}

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  admin = await loginAs('dev', 'desarrollo-local');
  await createUser('ana', 'Mesero', { password: 'clave-mesero-1' });
  waiter = await loginAs('ana', 'clave-mesero-1');
  menu = (await app.inject({ method: 'GET', url: '/api/menu', headers: admin })).json();
  const occ = await openTable('5');
  occupancyId = occ.id;
  bill1 = occ.bills[0].id;
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('cuentas de la mesa', () => {
  it('crear una cuenta (idempotente) y listarlas con sus totales', async () => {
    const body = { id: newId(), name: 'Ana' };
    const first = await post(`/api/occupancies/${occupancyId}/bills`, waiter, body);
    const again = await post(`/api/occupancies/${occupancyId}/bills`, waiter, body);
    expect(first.statusCode).toBe(201);
    expect(again.statusCode).toBe(200);
    await sendCoffee(bill1, 2);
    expect((await bills()).map((b) => [b.name, b.total])).toEqual([
      ['Cuenta 1', '24.00'],
      ['Ana', '0.00'],
    ]);
  });

  it('renombrar y poner NIT, con control de versión', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/bills/${bill1}`,
      headers: waiter,
      payload: { name: 'Familia López', customerNit: '1234567-8', version: 0 },
    });
    expect(res.json()).toMatchObject({ name: 'Familia López', customerNit: '1234567-8' });
    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/bills/${bill1}`,
      headers: waiter,
      payload: { name: 'Otra', version: 0 },
    });
    expect(stale.json().error.code).toBe('STALE_VERSION');
  });

  it('una cuenta pagada no se cambia: 409 BILL_PAID', async () => {
    await prisma.bill.update({ where: { id: toDbId(bill1) }, data: { status: 'PAGADA' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/bills/${bill1}`,
      headers: waiter,
      payload: { name: 'X', version: 0 },
    });
    expect(res.json().error.code).toBe('BILL_PAID');
  });
});

describe('mover ítems entre cuentas (RF-102)', () => {
  it('mueve y recalcula las dos cuentas', async () => {
    const bill2 = (
      await post(`/api/occupancies/${occupancyId}/bills`, waiter, {
        id: newId(),
        name: 'Cuenta 2',
      })
    ).json().id;
    const a = await sendCoffee(bill1);
    await sendCoffee(bill1);
    const res = await post('/api/bills/move-items', waiter, {
      itemIds: [a.id],
      targetBillId: bill2,
      versions: { [a.id]: a.version },
    });
    expect(res.statusCode).toBe(200);
    const totals = Object.fromEntries(res.json().bills.map((b: BillDto) => [b.id, b.total]));
    expect(totals).toEqual({ [bill1]: '12.00', [bill2]: '12.00' });

    // Con la versión vieja ya no se puede volver a mover
    const stale = await post('/api/bills/move-items', waiter, {
      itemIds: [a.id],
      targetBillId: bill1,
      versions: { [a.id]: a.version },
    });
    expect(stale.json().error.code).toBe('STALE_VERSION');
  });

  it('no se mueve a la cuenta de otra mesa ni desde una pagada', async () => {
    const a = await sendCoffee(bill1);
    const other = await openTable('6');
    const res = await post('/api/bills/move-items', waiter, {
      itemIds: [a.id],
      targetBillId: other.bills[0].id,
      versions: { [a.id]: a.version },
    });
    expect(res.json().error.code).toBe('VALIDATION_ERROR');

    const bill2 = (
      await post(`/api/occupancies/${occupancyId}/bills`, waiter, {
        id: newId(),
        name: 'Cuenta 2',
      })
    ).json().id;
    await prisma.bill.update({ where: { id: toDbId(bill1) }, data: { status: 'PAGADA' } });
    const paid = await post('/api/bills/move-items', waiter, {
      itemIds: [a.id],
      targetBillId: bill2,
      versions: { [a.id]: a.version },
    });
    expect(paid.json().error.code).toBe('BILL_PAID');
  });
});

describe('separar unidades (RF-104)', () => {
  it('3 cafés → 2 en la Cuenta 1 y 1 en la Cuenta 2; el total de la mesa no cambia', async () => {
    const bill2 = (
      await post(`/api/occupancies/${occupancyId}/bills`, waiter, {
        id: newId(),
        name: 'Cuenta 2',
      })
    ).json().id;
    const cafe = await sendCoffee(bill1, 3);
    const body = { newItemId: newId(), quantity: 1, targetBillId: bill2, version: cafe.version };
    const res = await post(`/api/order-items/${cafe.id}/split`, waiter, body);
    expect(res.statusCode).toBe(200);
    expect(res.json().original).toMatchObject({ quantity: 2, lineTotal: '24.00', billId: bill1 });
    expect(res.json().created).toMatchObject({
      quantity: 1,
      lineTotal: '12.00',
      billId: bill2,
      splitFromId: cafe.id,
      productName: 'Café de olla',
    });
    expect((await bills()).map((b) => b.total)).toEqual(['24.00', '12.00']);

    // Reenviar la misma separación no separa otra vez
    const again = await post(`/api/order-items/${cafe.id}/split`, waiter, body);
    expect(again.json().original.quantity).toBe(2);
    expect(await prisma.orderItem.count()).toBe(2);
  });

  it('no se separan todas las unidades', async () => {
    const cafe = await sendCoffee(bill1, 2);
    const res = await post(`/api/order-items/${cafe.id}/split`, waiter, {
      newItemId: newId(),
      quantity: 2,
      version: cafe.version,
    });
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('pre-cuenta (Docs/05 paso 10)', () => {
  async function settingsTip(pct: string | null) {
    await prisma.clientSettings.updateMany({
      data: { tipsEnabled: pct !== null, tipSuggestedPct: pct },
    });
  }

  it('pasa la cuenta a PRECUENTA y trae ítems, propina sugerida y total con propina', async () => {
    await settingsTip('10');
    await sendCoffee(bill1, 2);
    const res = await post(`/api/bills/${bill1}/precheck`, waiter, {});
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.bill).toMatchObject({ status: 'PRECUENTA', total: '24.00' });
    expect(body).toMatchObject({
      tipPct: '10',
      tipAmount: '2.40',
      totalWithTip: '26.40',
      reprint: false,
    });
    expect(body.items[0]).toMatchObject({ productName: 'Café de olla', quantity: 2 });
  });

  it('sin propinas activas no sugiere propina', async () => {
    await settingsTip(null);
    await sendCoffee(bill1);
    const body = (await post(`/api/bills/${bill1}/precheck`, waiter, {})).json();
    expect(body).toMatchObject({ tipPct: null, tipAmount: '0.00', totalWithTip: '12.00' });
  });

  it('los pedidos listos de la cuenta quedan entregados automáticamente (S-09)', async () => {
    const item = (await sendCoffee(bill1)) as unknown as { orderId: string };
    const order = { id: item.orderId };
    await prisma.order.update({ where: { id: toDbId(order.id) }, data: { status: 'LISTO' } });
    await prisma.orderItem.updateMany({
      where: { orderId: toDbId(order.id) },
      data: { status: 'LISTO' },
    });
    await post(`/api/bills/${bill1}/precheck`, waiter, {});
    const after = await prisma.order.findUniqueOrThrow({ where: { id: toDbId(order.id) } });
    expect(after).toMatchObject({ status: 'ENTREGADO', deliveredAuto: true });
  });

  it('sin pantalla de cocina, la pre-cuenta también entrega lo que sigue en cola (PA-058, SC-60)', async () => {
    const item = (await sendCoffee(bill1)) as unknown as { orderId: string };
    await post(`/api/bills/${bill1}/precheck`, waiter, {});
    const after = await prisma.order.findUniqueOrThrow({
      where: { id: toDbId(item.orderId) },
      include: { items: true },
    });
    expect(after).toMatchObject({ status: 'ENTREGADO', deliveredAuto: true });
    expect(after.items.every((i) => i.status === 'ENTREGADO')).toBe(true);
  });

  it('reimprimir pide bill.reprint: el mesero necesita 🔑', async () => {
    await sendCoffee(bill1);
    await post(`/api/bills/${bill1}/precheck`, waiter, {});
    const again = await post(`/api/bills/${bill1}/precheck`, waiter, {});
    expect(again.json().error.code).toBe('AUTHORIZATION_REQUIRED');
    const byAdmin = await post(`/api/bills/${bill1}/precheck`, admin, {});
    expect(byAdmin.json()).toMatchObject({ reprint: true });
  });

  it('pedir más sobre una pre-cuenta la devuelve a ABIERTA', async () => {
    await sendCoffee(bill1);
    await post(`/api/bills/${bill1}/precheck`, waiter, {});
    await sendCoffee(bill1);
    expect((await bills())[0]!.status).toBe('ABIERTA');
  });
});
