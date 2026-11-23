import type { MenuResponse } from '@mise/shared/contracts/catalog';
import { newId } from '@mise/shared/domain/ids';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../core/app.js';
import { toApiId, toDbId } from '../../core/ids.js';
import { resetDb } from '../../core/test-db.js';
import { prisma, setupFixture } from '../../core/test-app.js';
import { createPairingCode } from '../auth/index.js';

type Headers = Record<string, string>;
let app: App;
let branchId: string;
let admin: Headers;
let menu: MenuResponse;
let methods: { id: string; kind: string }[];
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
const post = (url: string, payload: object) =>
  app.inject({ method: 'POST', url, headers: admin, payload });
const method = (kind: string) => methods.find((m) => m.kind === kind)!.id;
const cafe = () => menu.products.find((p) => p.name === 'Café de olla')!;

interface BillDto {
  id: string;
  version: number;
  total: string;
}

/** Mesa con una ronda de cafés (Q12 c/u) en la Cuenta 1. */
async function tableWithCoffee(name: string, quantity = 2) {
  const zone = (await post('/api/zones', { name: `Zona ${name}` })).json();
  const table = (await post('/api/tables', { zoneId: zone.id, name, capacity: 4 })).json();
  const occ = (
    await post('/api/occupancies', {
      id: newId(),
      tableId: table.id,
      orderTypeCode: 'MESA',
      guests: 2,
    })
  ).json();
  await post('/api/orders', {
    id: newId(),
    occupancyId: occ.id,
    clientSentAt: new Date().toISOString(),
    items: [
      {
        id: newId(),
        billId: occ.bills[0].id,
        productId: cafe().id,
        quantity,
        unitPrice: cafe().price,
      },
    ],
  });
  const bills = (
    await app.inject({ method: 'GET', url: `/api/occupancies/${occ.id}/bills`, headers: admin })
  ).json<BillDto[]>();
  return { tableId: table.id as string, occupancyId: occ.id as string, bill: bills[0]! };
}
const openShift = () =>
  post('/api/shifts', { id: newId(), cashRegisterId: registerId, openingFloat: '100.00' });
const card = (amount: string) => ({
  id: newId(),
  methodId: method('CARD'),
  amount,
  reference: '004512',
});

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  admin = await loginAs('dev', 'desarrollo-local');
  menu = (await app.inject({ method: 'GET', url: '/api/menu', headers: admin })).json();
  methods = (
    await app.inject({ method: 'GET', url: '/api/payment-methods', headers: admin })
  ).json();
  registerId = (
    await app.inject({ method: 'GET', url: '/api/cash-registers', headers: admin })
  ).json()[0].id;
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('cobrar (Docs/05 pasos 11 y 12)', () => {
  it('pago mixto con cambio: cuenta pagada con folio, mesa libre y el efectivo va al turno', async () => {
    const shift = (await openShift()).json();
    const { tableId, bill } = await tableWithCoffee('5');
    expect(bill.total).toBe('24.00');
    const res = await post(`/api/bills/${bill.id}/pay`, {
      tipAmount: '0.00',
      version: bill.version,
      cashRegisterId: registerId,
      payments: [
        card('10.00'),
        { id: newId(), methodId: method('CASH'), amount: '14.00', tendered: '20.00' },
      ],
    });
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.bill).toMatchObject({ status: 'PAGADA', customerNit: 'CF' });
    expect(r.bill.folio).toMatch(/^\d{6}$/);
    expect(r).toMatchObject({ totalPaid: '24.00', change: '6.00', occupancyClosed: true });
    const table = await prisma.diningTable.findUniqueOrThrow({ where: { id: toDbId(tableId) } });
    expect(table).toMatchObject({ status: 'LIBRE', currentOccupancyId: null });
    const summary = (
      await app.inject({ method: 'GET', url: `/api/shifts/${shift.id}`, headers: admin })
    ).json();
    expect(summary).toMatchObject({ cashSalesTotal: '14.00', expectedCash: '114.00' });
  });

  it('si falta dinero lo dice; la tarjeta pide referencia', async () => {
    const { bill } = await tableWithCoffee('5');
    const short = await post(`/api/bills/${bill.id}/pay`, {
      tipAmount: '0.00',
      version: bill.version,
      payments: [card('20.00')],
    });
    expect(short.json().error.message).toMatch(/Faltan 4\.00/);
    const noRef = await post(`/api/bills/${bill.id}/pay`, {
      tipAmount: '0.00',
      version: bill.version,
      payments: [{ id: newId(), methodId: method('CARD'), amount: '24.00' }],
    });
    expect(noRef.json().error.message).toMatch(/referencia/);
  });

  it('sin turno abierto no se cobra en efectivo, pero sí con tarjeta', async () => {
    const { bill } = await tableWithCoffee('5');
    const cash = await post(`/api/bills/${bill.id}/pay`, {
      tipAmount: '0.00',
      version: bill.version,
      payments: [{ id: newId(), methodId: method('CASH'), amount: '24.00', tendered: '24.00' }],
    });
    expect(cash.json().error.message).toMatch(/turno abierto/);
    const byCard = await post(`/api/bills/${bill.id}/pay`, {
      tipAmount: '0.00',
      version: bill.version,
      payments: [card('24.00')],
    });
    expect(byCard.statusCode).toBe(200);
  });

  it('repetir el mismo cobro devuelve el mismo recibo sin duplicar pagos', async () => {
    const { bill } = await tableWithCoffee('5');
    const body = { tipAmount: '0.00', version: bill.version, payments: [card('24.00')] };
    const a = (await post(`/api/bills/${bill.id}/pay`, body)).json();
    const b = (await post(`/api/bills/${bill.id}/pay`, body)).json();
    expect(b.bill.folio).toBe(a.bill.folio);
    expect(await prisma.payment.count()).toBe(1);
  });

  it('con dos cuentas, pagar una no cierra la mesa', async () => {
    const { occupancyId, bill } = await tableWithCoffee('5');
    const second = (
      await post(`/api/occupancies/${occupancyId}/bills`, { id: newId(), name: 'Cuenta 2' })
    ).json();
    await post('/api/orders', {
      id: newId(),
      occupancyId,
      clientSentAt: new Date().toISOString(),
      items: [
        {
          id: newId(),
          billId: second.id,
          productId: cafe().id,
          quantity: 1,
          unitPrice: cafe().price,
        },
      ],
    });
    const r = (
      await post(`/api/bills/${bill.id}/pay`, {
        tipAmount: '0.00',
        version: bill.version,
        payments: [card('24.00')],
      })
    ).json();
    expect(r.occupancyClosed).toBe(false);
    const occ = await prisma.occupancy.findUniqueOrThrow({ where: { id: toDbId(occupancyId) } });
    expect(occ.status).toBe('ABIERTA');
  });

  it('propina: solo si el restaurante registra propinas', async () => {
    const { bill } = await tableWithCoffee('5');
    const body = (tip: string) => ({
      tipAmount: tip,
      version: bill.version,
      payments: [card((24 + Number(tip)).toFixed(2))],
    });
    const denied = (await post(`/api/bills/${bill.id}/pay`, body('2.40'))).json();
    expect(denied.error.message).toMatch(/propinas/);
    await prisma.clientSettings.updateMany({ data: { tipsEnabled: true, tipSuggestedPct: 10 } });
    const ok = (await post(`/api/bills/${bill.id}/pay`, body('2.40'))).json();
    expect(ok.bill).toMatchObject({ tipAmount: '2.40', status: 'PAGADA' });
  });
});

describe('reabrir cuentas pagadas en efectivo (Docs/05 paso 14, RF-069)', () => {
  const reopenReason = async () =>
    (await prisma.reason.findFirstOrThrow({ where: { type: 'REOPEN_BILL' } })).id;

  async function payCash() {
    const shift = (await openShift()).json();
    const { bill } = await tableWithCoffee('5');
    const paid = (
      await post(`/api/bills/${bill.id}/pay`, {
        tipAmount: '0.00',
        version: bill.version,
        payments: [{ id: newId(), methodId: method('CASH'), amount: '24.00', tendered: '50.00' }],
      })
    ).json();
    return { shift, paid };
  }

  it('revierte los pagos, registra el reverso en el turno abierto y la cuenta vuelve a cobrarse con folio nuevo', async () => {
    const { shift, paid } = await payCash();
    const res = await post(`/api/bills/${paid.bill.id}/reopen`, {
      reasonId: toApiId(await reopenReason()),
      version: paid.bill.version,
    });
    expect(res.statusCode).toBe(200);
    const bill = await prisma.bill.findUniqueOrThrow({ where: { id: toDbId(paid.bill.id) } });
    expect(bill).toMatchObject({ status: 'ABIERTA', folio: null, reopenCount: 1 });
    expect(await prisma.payment.count({ where: { status: 'REVERTIDO' } })).toBe(1);
    const summary = (
      await app.inject({ method: 'GET', url: `/api/shifts/${shift.id}`, headers: admin })
    ).json();
    // 100 de fondo + 24 cobrado − 24 de reverso = 100
    expect(summary).toMatchObject({ cashSalesTotal: '24.00', expectedCash: '100.00' });
    const today = (
      await app.inject({ method: 'GET', url: '/api/bills/today', headers: admin })
    ).json();
    expect(today.reopened.map((b: { id: string }) => b.id)).toEqual([paid.bill.id]);
    const again = (
      await post(`/api/bills/${paid.bill.id}/pay`, {
        tipAmount: '0.00',
        version: bill.version,
        payments: [{ id: newId(), methodId: method('CASH'), amount: '24.00' }],
      })
    ).json();
    expect(again.bill.status).toBe('PAGADA');
    expect(again.bill.folio).not.toBe(paid.bill.folio);
  });

  it('con tarjeta no se reabre (PA-051)', async () => {
    const { bill } = await tableWithCoffee('5');
    const paid = (
      await post(`/api/bills/${bill.id}/pay`, {
        tipAmount: '0.00',
        version: bill.version,
        payments: [card('24.00')],
      })
    ).json();
    await openShift();
    const res = await post(`/api/bills/${paid.bill.id}/reopen`, {
      reasonId: toApiId(await reopenReason()),
      version: paid.bill.version,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('REOPEN_NOT_ALLOWED');
  });

  it('sin turno abierto no se puede reabrir', async () => {
    const { shift, paid } = await payCash();
    await post(`/api/shifts/${shift.id}/close`, { countedCash: '124.00' });
    const res = await post(`/api/bills/${paid.bill.id}/reopen`, {
      reasonId: toApiId(await reopenReason()),
      version: paid.bill.version,
    });
    expect(res.json().error.message).toMatch(/turno abierto/);
  });
});
