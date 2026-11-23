// Reabrir una cuenta pagada en efectivo (Docs/05 paso 14, RF-069, S-28, S-29, PA-051). H3 #20.
// Dueño: Pablito; reasignado a Deniscito (doc 17 §3.1).
// - Solo si TODOS los pagos fueron en efectivo y el cobro es del mismo día de negocio.
// - Requiere un turno abierto en la caja que reabre: ahí se registra REVERSO_REAPERTURA (el turno
//   original no cambia). Los pagos quedan REVERTIDO; la cuenta vuelve a ABIERTA sin folio (al
//   cobrarla de nuevo sale un recibo nuevo). La mesa y la ocupación no cambian.
import type { PaidBillSummary } from '@mise/shared/contracts/billing';
import { AppError } from '../../core/errors.js';
import { newDbId, toApiId, toDbId } from '../../core/ids.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { recordAudit } from '../audit/index.js';
import { businessDate, type Actor } from '../floor/index.js';
import { operableOccupancy } from './billing.service.js';

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal;

async function today(tx: Tx | PrismaClient, branchId: string, at: Date) {
  const settings = await tx.clientSettings.findFirstOrThrow();
  const branch = await tx.branch.findUniqueOrThrow({ where: { id: branchId } });
  return businessDate(at, branch.timezone ?? settings.timezone, settings.businessDayCutoff);
}

export async function reopenBill(
  prisma: PrismaClient,
  branchId: string,
  billId: string,
  input: {
    reasonId: string;
    note?: string | undefined;
    cashRegisterId?: string | undefined;
    version: number;
  },
  actor: Actor,
) {
  return prisma.$transaction(async (tx) => {
    const id = toDbId(billId);
    const bill = await tx.bill.findUnique({ where: { id } });
    if (!bill) throw new AppError('NOT_FOUND', 'La cuenta no existe');
    await operableOccupancy(tx, branchId, bill.occupancyId, actor);
    if (bill.status !== 'PAGADA')
      throw new AppError('VALIDATION_ERROR', 'La cuenta no está pagada');
    if (bill.version !== input.version)
      throw new AppError('STALE_VERSION', 'La cuenta cambió; vuelve a cargarla');
    const reason = await tx.reason.findFirst({
      where: { id: toDbId(input.reasonId), type: 'REOPEN_BILL', active: true },
    });
    if (!reason) throw new AppError('VALIDATION_ERROR', 'Elige un motivo de reapertura');

    const payments = await tx.payment.findMany({ where: { billId: id, status: 'APLICADO' } });
    const methods = await tx.paymentMethod.findMany({
      where: { id: { in: payments.map((p) => p.methodId) } },
    });
    // PA-051: con tarjeta, transferencia u otro método no se corrige en el sistema
    if (methods.some((m) => m.kind !== 'CASH'))
      throw new AppError('REOPEN_NOT_ALLOWED', 'Solo se reabren cuentas pagadas todo en efectivo');
    const now = new Date();
    if (
      !bill.paidAt ||
      (await today(tx, branchId, bill.paidAt)) !== (await today(tx, branchId, now))
    )
      throw new AppError('REOPEN_NOT_ALLOWED', 'Solo se reabren cuentas cobradas hoy');

    // Turno abierto en la caja que reabre (S-28): ahí sale el efectivo
    const register = input.cashRegisterId
      ? await tx.cashRegister.findFirst({ where: { id: toDbId(input.cashRegisterId), branchId } })
      : await tx.cashRegister.findFirst({ where: { branchId, isMain: true, active: true } });
    const shift = register
      ? await tx.shift.findFirst({ where: { cashRegisterId: register.id, status: 'ABIERTO' } })
      : null;
    if (!shift)
      throw new AppError(
        'REOPEN_NOT_ALLOWED',
        'Para reabrir hace falta un turno abierto en la caja',
      );

    const amount = payments.reduce((t, p) => t.plus(p.amount), new D(0));
    await tx.payment.updateMany({
      where: { billId: id, status: 'APLICADO' },
      data: { status: 'REVERTIDO' },
    });
    await tx.cashMovement.create({
      data: {
        id: newDbId(),
        shiftId: shift.id,
        type: 'REVERSO_REAPERTURA',
        billId: id,
        amount,
        reasonId: reason.id,
        note: input.note || null,
        userId: toDbId(actor.userId),
        authorizedBy: actor.authorizedBy ? toDbId(actor.authorizedBy) : null,
      },
    });
    const reopened = await tx.bill.update({
      where: { id },
      data: {
        status: 'ABIERTA',
        folio: null,
        tipAmount: 0,
        tipPct: null,
        reopenCount: { increment: 1 },
        version: { increment: 1 },
      },
    });
    await tx.bill.update({
      where: { id },
      data: { total: reopened.subtotal.minus(reopened.discountTotal) },
    });
    await recordAudit(tx, {
      action: 'bill.reopen',
      entity: 'bill',
      entityId: billId,
      userId: toDbId(actor.userId),
      authorizedBy: actor.authorizedBy ? toDbId(actor.authorizedBy) : null,
      deviceId: toDbId(actor.deviceId),
      branchId,
      ip: actor.ip,
      reasonId: reason.id,
      note: input.note ?? null,
      before: { folio: bill.folio, total: bill.total.toFixed(2) },
      after: { reversed: amount.toFixed(2), shiftId: toApiId(shift.id) },
    });
    return { occupancyId: toApiId(bill.occupancyId) };
  });
}

/** GET /api/bills/today: pagadas hoy (para reabrir) y reabiertas pendientes de volver a cobrar. */
export async function todayBills(prisma: PrismaClient, branchId: string) {
  const day = await today(prisma, branchId, new Date());
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000);
  const rows = await prisma.bill.findMany({
    where: {
      occupancy: { branchId },
      OR: [
        { status: 'PAGADA', paidAt: { gte: since } },
        { status: { in: ['ABIERTA', 'PRECUENTA'] }, reopenCount: { gt: 0 } },
      ],
    },
    include: { occupancy: { include: { table: true } } },
    orderBy: { paidAt: 'desc' },
  });
  const methods = new Map((await prisma.paymentMethod.findMany()).map((m) => [m.id, m.kind]));
  const payments = await prisma.payment.findMany({
    where: { billId: { in: rows.map((r) => r.id) }, status: 'APLICADO' },
  });
  const summaries: PaidBillSummary[] = [];
  for (const b of rows) {
    if (b.status === 'PAGADA' && (!b.paidAt || (await today(prisma, branchId, b.paidAt)) !== day))
      continue;
    const mine = payments.filter((p) => p.billId === b.id);
    summaries.push({
      id: toApiId(b.id),
      occupancyId: toApiId(b.occupancyId),
      name: b.name,
      where: b.occupancy.table ? `Mesa ${b.occupancy.table.name}` : 'Para llevar',
      status: b.status as PaidBillSummary['status'],
      folio: b.folio,
      total: b.total.toFixed(2),
      paidAt: b.paidAt?.toISOString() ?? null,
      cashOnly: mine.length > 0 && mine.every((p) => methods.get(p.methodId) === 'CASH'),
      reopenCount: b.reopenCount,
      version: b.version,
    });
  }
  return {
    paid: summaries.filter((s) => s.status === 'PAGADA'),
    reopened: summaries.filter((s) => s.status !== 'PAGADA'),
  };
}
