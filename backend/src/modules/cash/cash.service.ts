// Caja: cajas, turnos y retiros/depósitos (Docs/05 paso 1, Docs/07 §4.5, Docs/08 §2.8).
// Dueño: Pablito; reasignado a Deniscito (doc 17 §3.1, H3 #18). El cobro (#19) suma los pagos en
// efectivo al esperado; el corte (#20) cierra el turno.
import type {
  CashMovement,
  CashRegister,
  ShiftDetail,
  ShiftSummary,
} from '@mise/shared/contracts/cash';
import { AppError } from '../../core/errors.js';
import { toApiId, toDbId } from '../../core/ids.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { recordAudit } from '../audit/index.js';

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;
const D = Prisma.Decimal;
const money = (d: Prisma.Decimal) => d.toFixed(2);

export interface Actor {
  userId: string;
  deviceId: string;
  authorizedBy: string | null;
  ip: string;
  permissions: string[];
}

type ShiftRow = Prisma.ShiftGetPayload<{ include: { movements: true } }>;

/** Efectivo cobrado en el turno: pagos en efectivo con este turno (incluye los luego revertidos, Docs/05 paso 13). */
async function cashSales(db: Db, shiftId: string): Promise<Prisma.Decimal> {
  const { _sum } = await db.payment.aggregate({
    where: { shiftId, status: { in: ['APLICADO', 'REVERTIDO'] } },
    _sum: { amount: true },
  });
  return _sum.amount ?? new D(0);
}

async function userNames(db: Db, ids: string[]): Promise<Map<string, string>> {
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((u) => [u.id, u.fullName]));
}

async function toSummary(db: Db, s: ShiftRow, actor: Actor): Promise<ShiftSummary> {
  const sum = (type: string) =>
    s.movements.filter((m) => m.type === type).reduce((t, m) => t.plus(m.amount), new D(0));
  const deposits = sum('DEPOSITO');
  const withdrawals = sum('RETIRO');
  const reversals = sum('REVERSO_REAPERTURA');
  const sales = await cashSales(db, s.id);
  // Fondo + efectivo cobrado + depósitos − retiros − reversos por reapertura (Docs/11 §4.4)
  const expected = s.openingFloat.plus(sales).plus(deposits).minus(withdrawals).minus(reversals);
  const names = await userNames(db, [s.openedBy]);
  return {
    id: toApiId(s.id),
    cashRegisterId: toApiId(s.cashRegisterId),
    status: s.status as ShiftSummary['status'],
    openedBy: toApiId(s.openedBy),
    openedByName: names.get(s.openedBy) ?? '',
    openedAt: s.openedAt.toISOString(),
    openingFloat: money(s.openingFloat),
    depositsTotal: money(deposits),
    withdrawalsTotal: money(withdrawals),
    cashSalesTotal: money(sales),
    // Corte "a ciegas" si no tiene cash.view_expected (Docs/03 §3)
    expectedCash: actor.permissions.includes('cash.view_expected') ? money(expected) : null,
  };
}

/** GET /api/cash-registers: cajas activas de la sucursal con su turno abierto. */
export async function listCashRegisters(
  prisma: PrismaClient,
  branchId: string,
  actor: Actor,
): Promise<CashRegister[]> {
  const registers = await prisma.cashRegister.findMany({
    where: { branchId, active: true },
    orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
    include: {
      shifts: {
        where: { status: { in: ['ABIERTO', 'EN_CORTE'] } },
        include: { movements: true },
        take: 1,
      },
    },
  });
  return Promise.all(
    registers.map(async (r) => {
      // Fondo sugerido en cajas VARIABLE: lo contado en el último corte (Docs/05 paso 1)
      const last =
        r.openingFloatMode === 'VARIABLE'
          ? await prisma.shift.findFirst({
              where: { cashRegisterId: r.id, status: 'CERRADO', countedCash: { not: null } },
              orderBy: { closedAt: 'desc' },
              select: { countedCash: true },
            })
          : null;
      const open = r.shifts[0];
      return {
        id: toApiId(r.id),
        name: r.name,
        openingFloatMode: r.openingFloatMode as CashRegister['openingFloatMode'],
        openingFloatAmount: money(r.openingFloatAmount),
        isMain: r.isMain,
        active: r.active,
        suggestedFloat: last?.countedCash ? money(last.countedCash) : null,
        openShift: open ? await toSummary(prisma, open, actor) : null,
      };
    }),
  );
}

async function loadShift(db: Db, branchId: string, shiftId: string) {
  const shift = await db.shift.findUnique({
    where: { id: toDbId(shiftId) },
    include: { movements: { orderBy: { createdAt: 'asc' } }, cashRegister: true },
  });
  if (!shift || shift.cashRegister.branchId !== branchId)
    throw new AppError('NOT_FOUND', 'El turno no existe');
  return shift;
}

/**
 * POST /api/shifts (cash.open_shift): abre el turno. Solo en línea (PA-042). Idempotente por id.
 * En cajas FIJO el fondo es el configurado; en VARIABLE, el que escribe el cajero.
 */
export async function openShift(
  prisma: PrismaClient,
  branchId: string,
  input: { id: string; cashRegisterId: string; openingFloat: string },
  actor: Actor,
): Promise<{ shift: ShiftSummary; created: boolean }> {
  const id = toDbId(input.id);
  const existing = await prisma.shift.findUnique({ where: { id }, include: { movements: true } });
  if (existing) return { shift: await toSummary(prisma, existing, actor), created: false };
  try {
    return await prisma.$transaction(async (tx) => {
      const register = await tx.cashRegister.findFirst({
        where: { id: toDbId(input.cashRegisterId), branchId, active: true },
      });
      if (!register) throw new AppError('NOT_FOUND', 'La caja no existe');
      const open = await tx.shift.findFirst({
        where: { cashRegisterId: register.id, status: 'ABIERTO' },
      });
      if (open)
        throw new AppError('SHIFT_ALREADY_OPEN', `${register.name} ya tiene un turno abierto`, {
          shiftId: toApiId(open.id),
        });
      const openingFloat =
        register.openingFloatMode === 'FIJO'
          ? register.openingFloatAmount
          : new D(input.openingFloat);
      const shift = await tx.shift.create({
        data: {
          id,
          cashRegisterId: register.id,
          openedBy: toDbId(actor.userId),
          openedAt: new Date(),
          openingFloat,
        },
        include: { movements: true },
      });
      await recordAudit(tx, {
        action: 'cash.shift_open',
        entity: 'shift',
        entityId: input.id,
        userId: toDbId(actor.userId),
        deviceId: toDbId(actor.deviceId),
        branchId,
        ip: actor.ip,
        after: { cashRegister: register.name, openingFloat: money(openingFloat) },
      });
      return { shift: await toSummary(tx, shift, actor), created: true };
    });
  } catch (error) {
    // Dos aperturas a la vez: el índice único deja pasar solo una
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new AppError('SHIFT_ALREADY_OPEN', 'La caja ya tiene un turno abierto');
    throw error;
  }
}

async function toMovements(db: Db, rows: ShiftRow['movements']): Promise<CashMovement[]> {
  const names = await userNames(
    db,
    rows.map((m) => m.userId),
  );
  const reasons = await db.reason.findMany({
    where: { id: { in: rows.flatMap((m) => (m.reasonId ? [m.reasonId] : [])) } },
    select: { id: true, name: true },
  });
  const reasonName = new Map(reasons.map((r) => [r.id, r.name]));
  return rows.map((m) => ({
    id: toApiId(m.id),
    shiftId: toApiId(m.shiftId),
    type: m.type as CashMovement['type'],
    amount: money(m.amount),
    reasonId: m.reasonId ? toApiId(m.reasonId) : null,
    reasonName: m.reasonId ? (reasonName.get(m.reasonId) ?? null) : null,
    note: m.note,
    userName: names.get(m.userId) ?? '',
    at: m.createdAt.toISOString(),
  }));
}

/** GET /api/shifts/:id: resumen y movimientos (el esperado solo con cash.view_expected). */
export async function getShift(
  prisma: PrismaClient,
  branchId: string,
  shiftId: string,
  actor: Actor,
): Promise<ShiftDetail> {
  const shift = await loadShift(prisma, branchId, shiftId);
  return {
    ...(await toSummary(prisma, shift, actor)),
    movements: await toMovements(prisma, shift.movements),
  };
}

/** POST /api/shifts/:id/movements (cash.movement o 🔑): retiro o depósito con motivo. */
export async function addMovement(
  prisma: PrismaClient,
  branchId: string,
  shiftId: string,
  input: {
    id: string;
    type: 'DEPOSITO' | 'RETIRO';
    amount: string;
    reasonId: string;
    note?: string | undefined;
  },
  actor: Actor,
): Promise<ShiftDetail> {
  return prisma.$transaction(async (tx) => {
    const shift = await loadShift(tx, branchId, shiftId);
    const id = toDbId(input.id);
    if (!(await tx.cashMovement.findUnique({ where: { id } }))) {
      if (shift.status !== 'ABIERTO')
        throw new AppError('VALIDATION_ERROR', 'El turno ya no está abierto', {
          status: shift.status,
        });
      const reasonType = input.type === 'RETIRO' ? 'CASH_WITHDRAWAL' : 'CASH_DEPOSIT';
      const reason = await tx.reason.findFirst({
        where: { id: toDbId(input.reasonId), type: reasonType, active: true },
      });
      if (!reason) throw new AppError('VALIDATION_ERROR', 'Elige un motivo válido');
      await tx.cashMovement.create({
        data: {
          id,
          shiftId: shift.id,
          type: input.type,
          amount: new D(input.amount),
          reasonId: reason.id,
          note: input.note || null,
          userId: toDbId(actor.userId),
          authorizedBy: actor.authorizedBy ? toDbId(actor.authorizedBy) : null,
        },
      });
      await recordAudit(tx, {
        action: input.type === 'RETIRO' ? 'cash.withdrawal' : 'cash.deposit',
        entity: 'shift',
        entityId: shiftId,
        userId: toDbId(actor.userId),
        authorizedBy: actor.authorizedBy ? toDbId(actor.authorizedBy) : null,
        deviceId: toDbId(actor.deviceId),
        branchId,
        ip: actor.ip,
        reasonId: reason.id,
        note: input.note ?? null,
        after: { amount: input.amount },
      });
    }
    const fresh = await loadShift(tx, branchId, shiftId);
    return {
      ...(await toSummary(tx, fresh, actor)),
      movements: await toMovements(tx, fresh.movements),
    };
  });
}
