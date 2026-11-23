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
let cashier: Headers;
let menu: MenuResponse;
let billId: string;
let itemId: string;
let reasonId: string;
let devId: string;

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
const discount = (headers: Headers, body: object) =>
  post(`/api/bills/${billId}/discounts`, headers, { id: newId(), reasonId, ...body });

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  admin = await loginAs('dev', 'desarrollo-local');
  await createUser('carlos', 'Cajero', { password: 'clave-caja-123' });
  cashier = await loginAs('carlos', 'clave-caja-123');
  menu = (await app.inject({ method: 'GET', url: '/api/menu', headers: admin })).json();
  reasonId = toApiId((await prisma.reason.findFirstOrThrow({ where: { type: 'DISCOUNT' } })).id);
  devId = toApiId((await prisma.user.findUniqueOrThrow({ where: { username: 'dev' } })).id);
  await prisma.clientSettings.updateMany({ data: { discountsEnabled: true } });
  // Mesa con 2 cafés (Q24)
  const zone = (await post('/api/zones', admin, { name: 'Salón' })).json();
  const table = (
    await post('/api/tables', admin, { zoneId: zone.id, name: '5', capacity: 4 })
  ).json();
  const occ = (
    await post('/api/occupancies', admin, {
      id: newId(),
      tableId: table.id,
      orderTypeCode: 'MESA',
      guests: 2,
    })
  ).json();
  billId = occ.bills[0].id;
  const cafe = menu.products.find((p) => p.name === 'Café de olla')!;
  const order = (
    await post('/api/orders', admin, {
      id: newId(),
      occupancyId: occ.id,
      clientSentAt: new Date().toISOString(),
      items: [{ id: newId(), billId, productId: cafe.id, quantity: 2, unitPrice: cafe.price }],
    })
  ).json();
  itemId = order.items[0].id;
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('descuentos (Docs/03 §5 regla 2, Docs/05 §4)', () => {
  it('si están desactivados no se aplican', async () => {
    await prisma.clientSettings.updateMany({ data: { discountsEnabled: false } });
    const res = await discount(admin, { target: 'BILL', kind: 'PCT', value: '10.00' });
    expect(res.json().error.message).toMatch(/desactivados/);
  });

  it('10% sobre la cuenta y Q5 sobre el ítem: el servidor recalcula el total', async () => {
    const pct = (await discount(admin, { target: 'BILL', kind: 'PCT', value: '10.00' })).json();
    expect(pct.bill).toMatchObject({ subtotal: '24.00', discountTotal: '2.40', total: '21.60' });
    const item = (
      await discount(admin, { target: 'ITEM', itemId, kind: 'AMOUNT', value: '5.00' })
    ).json();
    // Ítem 24 − 5 = 19; 10% de 19 = 1.90; descuentos 6.90; total 17.10
    expect(item.bill).toMatchObject({ discountTotal: '6.90', total: '17.10' });
    expect(item.discounts).toHaveLength(2);
  });

  it('por encima del tope del rol pide 🔑 de alguien sin tope', async () => {
    await prisma.role.update({ where: { name: 'Cajero' }, data: { maxDiscountPct: 5 } });
    const over = await discount(cashier, { target: 'BILL', kind: 'PCT', value: '10.00' });
    expect(over.json().error).toMatchObject({
      code: 'AUTHORIZATION_REQUIRED',
      details: { permission: 'discount.apply_unlimited' },
    });
    const ok = await discount(cashier, {
      target: 'BILL',
      kind: 'PCT',
      value: '10.00',
      authorization: { userId: devId, pin: '0000' },
    });
    expect(ok.statusCode).toBe(200);
    const row = await prisma.appliedDiscount.findFirstOrThrow({
      where: { billId: toDbId(billId) },
    });
    expect(row.authorizedBy).toBe(toDbId(devId));
    const within = await discount(cashier, { target: 'BILL', kind: 'PCT', value: '5.00' });
    expect(within.statusCode).toBe(200);
  });

  it('un monto mayor que la base no se acepta; quitar el descuento devuelve el total', async () => {
    const big = await discount(admin, { target: 'BILL', kind: 'AMOUNT', value: '30.00' });
    expect(big.statusCode).toBe(400);
    const applied = (
      await discount(admin, { target: 'BILL', kind: 'AMOUNT', value: '4.00' })
    ).json();
    expect(applied.bill.total).toBe('20.00');
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/discounts/${applied.discounts[0].id}`,
      headers: admin,
    });
    expect(removed.json().bill).toMatchObject({ discountTotal: '0.00', total: '24.00' });
  });
});
