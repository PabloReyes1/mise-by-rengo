// Corte de caja (Docs/05 paso 13, Docs/11 §4.4). H3 #20. Dueño: Pablito; reasignado a Deniscito.
// Esperado = fondo + efectivo cobrado en el turno (incluye lo luego revertido) + depósitos
//            − retiros − reversos por reapertura registrados en el turno.
// Un turno cerrado es inmutable: el reporte queda congelado en report_snapshot.
// El corte sin conexión (CERRADO_PROVISIONAL) llega con la sincronización de H4.
import type { ShiftReport } from '@mise/shared/contracts/cash';
import { AppError } from '../../core/errors.js';
import { toApiId, toDbId } from '../../core/ids.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { recordAudit } from '../audit/index.js';
import type { Actor } from './cash.service.js';

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal;
const money = (d: Prisma.Decimal) => d.toFixed(2);

async function shiftInBranch(tx: Tx, branchId: string, shiftId: string) {
  const shift = await tx.shift.findUnique({
    where: { id: toDbId(shiftId) },
    include: { cashRegister: true, movements: true, counts: true },
  });
  if (!shift || shift.cashRegister.branchId !== branchId)
    throw new AppError('NOT_FOUND', 'El turno no existe');
  return shift;
}

type ShiftRow = Awaited<ReturnType<typeof shiftInBranch>>;

/** Arma el reporte del turno con lo que hay en la base (Docs/11 §4.4). */
async function buildReport(tx: Tx, shift: ShiftRow): Promise<ShiftReport> {
  const until = shift.closedAt ?? new Date();
  // Cuentas cobradas en esta caja durante el turno (efectivo con este turno u otros métodos)
  const bills = await tx.bill.findMany({
    where: {
      OR: [
        { shiftId: shift.id },
        { cashRegisterId: shift.cashRegisterId, paidAt: { gte: shift.openedAt, lte: until } },
      ],
      paidAt: { not: null },
    },
    select: { id: true, tipAmount: true, discountTotal: true },
  });
  const billIds = bills.map((b) => b.id);
  const payments = await tx.payment.findMany({
    where: {
      OR: [{ billId: { in: billIds } }, { shiftId: shift.id }],
      status: { in: ['APLICADO', 'REVERTIDO'] },
    },
  });
  const methods = new Map((await tx.paymentMethod.findMany()).map((m) => [m.id, m.name]));
  const byMethod = new Map<string, { count: number; amount: Prisma.Decimal }>();
  for (const p of payments) {
    const name = methods.get(p.methodId) ?? '—';
    const row = byMethod.get(name) ?? { count: 0, amount: new D(0) };
    byMethod.set(name, { count: row.count + 1, amount: row.amount.plus(p.amount) });
  }
  const sum = (type: string) => {
    const list = shift.movements.filter((m) => m.type === type);
    return { count: list.length, amount: list.reduce((t, m) => t.plus(m.amount), new D(0)) };
  };
  const deposits = sum('DEPOSITO');
  const withdrawals = sum('RETIRO');
  const reversals = sum('REVERSO_REAPERTURA');
  const cashSales = payments
    .filter((p) => p.shiftId === shift.id)
    .reduce((t, p) => t.plus(p.amount), new D(0));
  const expected = shift.openingFloat
    .plus(cashSales)
    .plus(deposits.amount)
    .minus(withdrawals.amount)
    .minus(reversals.amount);
  const totalCollected = payments.reduce((t, p) => t.plus(p.amount), new D(0));
  const tips = bills.reduce((t, b) => t.plus(b.tipAmount), new D(0));
  const users = await tx.user.findMany({
    where: { id: { in: [shift.openedBy, ...(shift.closedBy ? [shift.closedBy] : [])] } },
    select: { id: true, fullName: true },
  });
  const name = (id: string | null) => users.find((u) => u.id === id)?.fullName ?? '';
  return {
    shiftId: toApiId(shift.id),
    cashRegisterName: shift.cashRegister.name,
    status: shift.status as ShiftReport['status'],
    openedByName: name(shift.openedBy),
    openedAt: shift.openedAt.toISOString(),
    closedByName: shift.closedBy ? name(shift.closedBy) : null,
    closedAt: shift.closedAt?.toISOString() ?? null,
    openingFloat: money(shift.openingFloat),
    salesByMethod: [...byMethod].map(([method, v]) => ({
      method,
      count: v.count,
      amount: money(v.amount),
    })),
    totalCollected: money(totalCollected),
    tipsTotal: money(tips),
    cashSales: money(cashSales),
    deposits: { count: deposits.count, amount: money(deposits.amount) },
    withdrawals: { count: withdrawals.count, amount: money(withdrawals.amount) },
    reversals: { count: reversals.count, amount: money(reversals.amount) },
    expectedCash: money(expected),
    countedCash: shift.countedCash ? money(shift.countedCash) : null,
    difference: shift.difference ? money(shift.difference) : null,
    comment: shift.comment,
    counts: shift.counts
      .sort((a, b) => b.denomination.comparedTo(a.denomination))
      .map((c) => ({ denomination: money(c.denomination), quantity: c.quantity })),
    billsPaid: bills.length,
    discountsTotal: money(bills.reduce((t, b) => t.plus(b.discountTotal), new D(0))),
    netSales: money(totalCollected.minus(tips)),
  };
}

/** POST /api/shifts/:id/start-close: el turno deja de recibir efectivo (Docs/05 paso 13). */
export async function startClose(
  prisma: PrismaClient,
  branchId: string,
  shiftId: string,
  actor: Actor,
) {
  return prisma.$transaction(async (tx) => {
    const shift = await shiftInBranch(tx, branchId, shiftId);
    if (shift.status === 'ABIERTO') {
      await tx.shift.update({ where: { id: shift.id }, data: { status: 'EN_CORTE' } });
      await recordAudit(tx, {
        action: 'cash.shift_start_close',
        entity: 'shift',
        entityId: shiftId,
        userId: toDbId(actor.userId),
        deviceId: toDbId(actor.deviceId),
        branchId,
        ip: actor.ip,
      });
    } else if (shift.status !== 'EN_CORTE') {
      throw new AppError('VALIDATION_ERROR', 'El turno ya está cerrado');
    }
    const fresh = await shiftInBranch(tx, branchId, shiftId);
    const report = await buildReport(tx, fresh);
    // Corte a ciegas: sin cash.view_expected no se ve el esperado antes de contar
    return actor.permissions.includes('cash.view_expected')
      ? report
      : { ...report, expectedCash: null };
  });
}

/** POST /api/shifts/:id/close: cuenta, calcula la diferencia, cierra y congela el reporte. */
export async function closeShift(
  prisma: PrismaClient,
  branchId: string,
  shiftId: string,
  input: {
    countedCash: string;
    counts?: { denomination: string; quantity: number }[] | undefined;
    comment?: string | undefined;
  },
  actor: Actor,
): Promise<ShiftReport> {
  return prisma.$transaction(async (tx) => {
    const shift = await shiftInBranch(tx, branchId, shiftId);
    if (shift.status === 'CERRADO') return buildReport(tx, shift);
    if (shift.status !== 'ABIERTO' && shift.status !== 'EN_CORTE')
      throw new AppError('VALIDATION_ERROR', 'El turno ya está cerrado');
    if (shift.cashRegister.countByDenomination === 'OBLIGATORIO' && !input.counts?.length)
      throw new AppError('VALIDATION_ERROR', 'Esta caja pide contar por denominación');
    const counted = new D(input.countedCash);
    if (input.counts?.length) {
      const fromCounts = input.counts.reduce(
        (t, c) => t.plus(new D(c.denomination).times(c.quantity)),
        new D(0),
      );
      if (!fromCounts.eq(counted))
        throw new AppError(
          'VALIDATION_ERROR',
          `El conteo suma ${money(fromCounts)}, no ${money(counted)}`,
        );
    }
    const report = await buildReport(tx, shift);
    const difference = counted.minus(report.expectedCash!);
    const settings = await tx.clientSettings.findFirst();
    if (difference.abs().gt(settings?.cashDiffThreshold ?? 0) && !input.comment)
      throw new AppError('VALIDATION_ERROR', 'Hay diferencia: escribe un comentario', {
        difference: money(difference),
      });
    const now = new Date();
    if (input.counts?.length)
      await tx.shiftCount.createMany({
        data: input.counts
          .filter((c) => c.quantity > 0)
          .map((c) => ({
            shiftId: shift.id,
            denomination: new D(c.denomination),
            quantity: c.quantity,
          })),
      });
    await tx.shift.update({
      where: { id: shift.id },
      data: {
        status: 'CERRADO',
        closedBy: toDbId(actor.userId),
        closedAt: now,
        expectedCash: new D(report.expectedCash!),
        countedCash: counted,
        difference,
        comment: input.comment || null,
      },
    });
    const closed = await shiftInBranch(tx, branchId, shiftId);
    const final = await buildReport(tx, closed);
    await tx.shift.update({
      where: { id: shift.id },
      data: { reportSnapshot: final },
    });
    await recordAudit(tx, {
      action: 'cash.shift_close',
      entity: 'shift',
      entityId: shiftId,
      userId: toDbId(actor.userId),
      deviceId: toDbId(actor.deviceId),
      branchId,
      ip: actor.ip,
      after: {
        expected: final.expectedCash,
        counted: final.countedCash,
        difference: final.difference,
      },
    });
    return final;
  });
}

/** GET /api/shifts/:id/report: el reporte congelado de un turno cerrado (reimprimir). */
export async function getShiftReport(
  prisma: PrismaClient,
  branchId: string,
  shiftId: string,
  actor: Actor,
) {
  return prisma.$transaction(async (tx) => {
    const shift = await shiftInBranch(tx, branchId, shiftId);
    if (shift.reportSnapshot) return shift.reportSnapshot as unknown as ShiftReport;
    const report = await buildReport(tx, shift);
    return actor.permissions.includes('cash.view_expected')
      ? report
      : { ...report, expectedCash: null };
  });
}
