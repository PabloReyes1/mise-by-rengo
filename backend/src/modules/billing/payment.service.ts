// Cobro y cierre de mesa (Docs/05 pasos 11 y 12, Docs/05 §4, Docs/08 §2.7). H3 #19.
// Dueño: Pablito; reasignado a Deniscito (doc 17 §3.1).
// - Pagos mixtos: la suma de lo aplicado tiene que ser exactamente total + propina.
// - Solo el efectivo da cambio (tendered − amount) y va al turno abierto de la caja: la que cobra o,
//   si cobra el mesero, la principal de la sucursal (PA-052).
// - Repetir el cobro con los mismos ids de pago devuelve el mismo recibo (idempotente).
// - Si todas las cuentas de la mesa quedan pagadas, la mesa se cierra y se libera.
import type { PayBillRequest, PaymentMethod, Receipt } from '@mise/shared/contracts/billing';
import { AppError } from '../../core/errors.js';
import { nextFolio } from '../../core/folio.js';
import { toApiId, toDbId } from '../../core/ids.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { recordAudit } from '../audit/index.js';
import type { Actor } from '../floor/index.js';
import { itemInclude, operableOccupancy, toBill, toItem } from './billing.service.js';
import { recomputeBills } from './totals.js';

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal;
const money = (d: Prisma.Decimal) => d.toFixed(2);

export async function listPaymentMethods(prisma: PrismaClient): Promise<PaymentMethod[]> {
  const rows = await prisma.paymentMethod.findMany({
    where: { active: true },
    orderBy: [{ sort: 'asc' }, { name: 'asc' }],
  });
  return rows.map((m) => ({
    id: toApiId(m.id),
    name: m.name,
    kind: m.kind as PaymentMethod['kind'],
    givesChange: m.givesChange,
    requiresReference: m.requiresReference,
  }));
}

/** Recibo de una cuenta ya pagada (para la respuesta y para reimprimir). */
async function receiptOf(tx: Tx, billId: string, occupancyClosed: boolean): Promise<Receipt> {
  const bill = await tx.bill.findUniqueOrThrow({ where: { id: billId } });
  const [items, payments, methods] = await Promise.all([
    tx.orderItem.findMany({
      where: { billId, status: { not: 'CANCELADO' } },
      orderBy: { id: 'asc' },
      include: itemInclude,
    }),
    tx.payment.findMany({ where: { billId, status: 'APLICADO' }, orderBy: { createdAt: 'asc' } }),
    tx.paymentMethod.findMany(),
  ]);
  const method = new Map(methods.map((m) => [m.id, m]));
  const cashier = bill.paidBy
    ? await tx.user.findUnique({ where: { id: bill.paidBy }, select: { fullName: true } })
    : null;
  const totalPaid = payments.reduce((t, p) => t.plus(p.amount), new D(0));
  const change = payments.reduce((t, p) => t.plus(p.changeGiven), new D(0));
  return {
    bill: toBill(bill),
    items: items.map(toItem),
    payments: payments.map((p) => ({
      id: toApiId(p.id),
      methodName: method.get(p.methodId)?.name ?? '',
      kind: (method.get(p.methodId)?.kind ?? 'OTHER') as PaymentMethod['kind'],
      amount: money(p.amount),
      tendered: p.tendered ? money(p.tendered) : null,
      change: money(p.changeGiven),
      reference: p.reference,
    })),
    totalPaid: money(totalPaid),
    change: money(change),
    paidAt: (bill.paidAt ?? new Date()).toISOString(),
    receivedByName: cashier?.fullName ?? '',
    occupancyClosed,
  };
}

/** Turno abierto que recibe el efectivo: el de la caja que cobra o el de la principal (PA-052). */
async function cashShift(tx: Tx, branchId: string, cashRegisterId: string | undefined) {
  const register = cashRegisterId
    ? await tx.cashRegister.findFirst({
        where: { id: toDbId(cashRegisterId), branchId, active: true },
      })
    : await tx.cashRegister.findFirst({ where: { branchId, isMain: true, active: true } });
  if (!register) throw new AppError('VALIDATION_ERROR', 'No hay una caja para recibir el efectivo');
  const shift = await tx.shift.findFirst({
    where: { cashRegisterId: register.id, status: 'ABIERTO' },
  });
  if (!shift)
    throw new AppError(
      'VALIDATION_ERROR',
      `${register.name} no tiene turno abierto: no se puede cobrar en efectivo (sí con otros métodos)`,
    );
  return { register, shift };
}

/** Cierra la ocupación si todas sus cuentas con ítems están pagadas (Docs/05 paso 12). */
async function closeIfPaid(tx: Tx, occupancyId: string, now: Date): Promise<boolean> {
  const bills = await tx.bill.findMany({
    where: { occupancyId, status: { not: 'ELIMINADA' } },
    include: { items: { where: { status: { not: 'CANCELADO' } }, select: { id: true } } },
  });
  const withItems = bills.filter((b) => b.items.length > 0);
  if (withItems.some((b) => b.status !== 'PAGADA')) return false;
  // Las cuentas vacías se eliminan al cerrar
  const empty = bills.filter((b) => b.items.length === 0 && b.status !== 'PAGADA').map((b) => b.id);
  if (empty.length)
    await tx.bill.updateMany({ where: { id: { in: empty } }, data: { status: 'ELIMINADA' } });
  await tx.occupancy.update({
    where: { id: occupancyId },
    data: { status: 'CERRADA', closedAt: now, version: { increment: 1 } },
  });
  // La mesa y las que se le unieron quedan libres
  await tx.diningTable.updateMany({
    where: { currentOccupancyId: occupancyId },
    data: { status: 'LIBRE', currentOccupancyId: null, version: { increment: 1 } },
  });
  const merged = await tx.occupancy.findMany({
    where: { mergedIntoId: occupancyId },
    select: { id: true },
  });
  if (merged.length)
    await tx.diningTable.updateMany({
      where: { currentOccupancyId: { in: merged.map((m) => m.id) } },
      data: { status: 'LIBRE', currentOccupancyId: null, version: { increment: 1 } },
    });
  return true;
}

/** POST /api/bills/:id/pay (payment.register). */
export async function payBill(
  prisma: PrismaClient,
  branchId: string,
  billId: string,
  input: PayBillRequest,
  actor: Actor,
): Promise<{ receipt: Receipt; created: boolean; occupancyId: string }> {
  const id = toDbId(billId);
  return prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findUnique({ where: { id } });
    if (!bill) throw new AppError('NOT_FOUND', 'La cuenta no existe');
    const occupancy = await operableOccupancy(tx, branchId, bill.occupancyId, actor);

    // Reenvío del mismo cobro (outbox): mismo recibo, sin duplicar
    const firstId = toDbId(input.payments[0]!.id);
    if (bill.status === 'PAGADA') {
      if (await tx.payment.findUnique({ where: { id: firstId } }))
        return {
          receipt: await receiptOf(tx, id, occupancy.status === 'CERRADA'),
          created: false,
          occupancyId: toApiId(occupancy.id),
        };
      throw new AppError('BILL_PAID', `${bill.name} ya está pagada`, { billId });
    }
    if (bill.status === 'ELIMINADA')
      throw new AppError('VALIDATION_ERROR', 'La cuenta fue eliminada');
    if (bill.version !== input.version)
      throw new AppError('STALE_VERSION', 'La cuenta cambió; vuelve a cargarla', {
        currentVersion: bill.version,
      });

    await recomputeBills(tx, [id]);
    const fresh = await tx.bill.findUniqueOrThrow({ where: { id } });
    if (fresh.total.lte(0))
      throw new AppError('VALIDATION_ERROR', 'La cuenta no tiene nada que cobrar');

    const settings = await tx.clientSettings.findFirst();
    const tip = new D(input.tipAmount);
    if (tip.gt(0) && !settings?.tipsEnabled)
      throw new AppError('VALIDATION_ERROR', 'Este restaurante no registra propinas');
    const due = fresh.total.plus(tip);

    // Métodos y reglas de cada pago (Docs/05 paso 11)
    const methods = new Map(
      (await tx.paymentMethod.findMany({ where: { active: true } })).map((m) => [toApiId(m.id), m]),
    );
    let applied = new D(0);
    let needsCash = false;
    for (const p of input.payments) {
      const m = methods.get(p.methodId);
      if (!m) throw new AppError('VALIDATION_ERROR', 'Algún método de pago no está activo');
      if (new D(p.amount).lte(0))
        throw new AppError('VALIDATION_ERROR', 'Cada pago tiene que ser mayor que cero');
      if (m.requiresReference && !p.reference)
        throw new AppError('VALIDATION_ERROR', `${m.name} pide referencia`);
      if (p.tendered !== undefined) {
        if (!m.givesChange) throw new AppError('VALIDATION_ERROR', `${m.name} no da cambio`);
        if (new D(p.tendered).lt(p.amount))
          throw new AppError('VALIDATION_ERROR', 'El efectivo entregado no alcanza');
      }
      if (m.kind === 'CASH') needsCash = true;
      applied = applied.plus(p.amount);
    }
    if (!applied.eq(due)) {
      const diff = due.minus(applied);
      throw new AppError(
        'VALIDATION_ERROR',
        diff.gt(0) ? `Faltan ${money(diff)} por cobrar` : `Se cobró ${money(diff.abs())} de más`,
        { due: money(due), applied: money(applied) },
      );
    }

    const cash = needsCash ? await cashShift(tx, branchId, input.cashRegisterId) : null;
    const now = new Date();
    for (const p of input.payments) {
      const m = methods.get(p.methodId)!;
      const isCash = m.kind === 'CASH';
      await tx.payment.create({
        data: {
          id: toDbId(p.id),
          billId: id,
          methodId: m.id,
          amount: new D(p.amount),
          tendered: p.tendered !== undefined ? new D(p.tendered) : null,
          changeGiven: p.tendered !== undefined ? new D(p.tendered).minus(p.amount) : new D(0),
          reference: p.reference || null,
          shiftId: isCash ? cash!.shift.id : null,
          receivedBy: toDbId(actor.userId),
          createdDeviceId: toDbId(actor.deviceId),
        },
      });
    }
    await tx.bill.update({
      where: { id },
      data: {
        status: 'PAGADA',
        folio: await nextFolio(tx, branchId, 'BILL'),
        tipAmount: tip,
        tipPct:
          fresh.total.gt(0) && tip.gt(0)
            ? tip.times(100).dividedBy(fresh.total).toDecimalPlaces(2)
            : null,
        paidAt: now,
        paidBy: toDbId(actor.userId),
        cashRegisterId:
          cash?.register.id ?? (input.cashRegisterId ? toDbId(input.cashRegisterId) : null),
        shiftId: cash?.shift.id ?? null,
        customerNit: input.customerNit || 'CF',
        customerTaxName: input.customerTaxName || null,
        version: { increment: 1 },
      },
    });
    await recordAudit(tx, {
      action: 'bill.pay',
      entity: 'bill',
      entityId: billId,
      userId: toDbId(actor.userId),
      authorizedBy: actor.authorizedBy ? toDbId(actor.authorizedBy) : null,
      deviceId: toDbId(actor.deviceId),
      branchId,
      ip: actor.ip,
      after: { total: money(fresh.total), tip: money(tip), payments: input.payments.length },
    });
    const closed = await closeIfPaid(tx, occupancy.id, now);
    return {
      receipt: await receiptOf(tx, id, closed),
      created: true,
      occupancyId: toApiId(occupancy.id),
    };
  });
}

/** GET /api/bills/:id/receipt (bill.reprint): datos para reimprimir el recibo. */
export async function getReceipt(
  prisma: PrismaClient,
  branchId: string,
  billId: string,
  actor: Actor,
) {
  return prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findUnique({ where: { id: toDbId(billId) } });
    if (!bill) throw new AppError('NOT_FOUND', 'La cuenta no existe');
    const occupancy = await operableOccupancy(tx, branchId, bill.occupancyId, actor);
    if (bill.status !== 'PAGADA')
      throw new AppError('VALIDATION_ERROR', 'La cuenta todavía no está pagada');
    return receiptOf(tx, bill.id, occupancy.status === 'CERRADA');
  });
}
