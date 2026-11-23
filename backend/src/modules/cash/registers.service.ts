// Administración de cajas (Docs/07 cash_registers, PA-024, PA-025, PA-052; H3 #21). Dueño: Pablito.
// Una sola caja principal por sucursal (recibe el efectivo de los meseros). Las cajas no se borran:
// se desactivan, y no mientras tengan un turno abierto o sean la principal.
import type {
  CashRegister,
  CreateCashRegisterRequest,
  UpdateCashRegisterRequest,
} from '@mise/shared/contracts/cash';
import { AppError } from '../../core/errors.js';
import { toApiId, toDbId } from '../../core/ids.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { changedFields, recordAudit } from '../audit/index.js';
import { listCashRegisters, type Actor } from './cash.service.js';

type Tx = Prisma.TransactionClient;
type Row = Prisma.CashRegisterGetPayload<object>;

const fields = (r: Row) => ({
  name: r.name,
  openingFloatMode: r.openingFloatMode,
  openingFloatAmount: r.openingFloatAmount.toFixed(2),
  countByDenomination: r.countByDenomination,
  isMain: r.isMain,
  active: r.active,
});

const auditActor = (a: Actor, branchId: string) => ({
  userId: toDbId(a.userId),
  deviceId: toDbId(a.deviceId),
  authorizedBy: a.authorizedBy ? toDbId(a.authorizedBy) : null,
  branchId,
  ip: a.ip,
});

async function assertNameFree(tx: Tx, branchId: string, name: string, exceptId?: string) {
  const taken = await tx.cashRegister.findFirst({
    where: { branchId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (taken && taken.id !== exceptId)
    throw new AppError('VALIDATION_ERROR', `Ya existe una caja llamada "${name}"`);
}

/** La caja marcada como principal le quita la marca a las demás de la sucursal. */
async function takeMain(tx: Tx, branchId: string, id: string) {
  await tx.cashRegister.updateMany({
    where: { branchId, isMain: true, id: { not: id } },
    data: { isMain: false },
  });
}

/** La lista de administración con el resultado (para responder con la caja ya con su turno). */
async function one(prisma: PrismaClient, branchId: string, id: string, actor: Actor) {
  const all = await listCashRegisters(prisma, branchId, actor, true);
  return all.find((r) => r.id === toApiId(id))!;
}

export async function createCashRegister(
  prisma: PrismaClient,
  branchId: string,
  input: CreateCashRegisterRequest,
  actor: Actor,
): Promise<{ register: CashRegister; created: boolean }> {
  const id = toDbId(input.id);
  const existing = await prisma.cashRegister.findUnique({ where: { id } });
  if (existing && existing.branchId === branchId)
    return { register: await one(prisma, branchId, id, actor), created: false };
  if (existing) throw new AppError('NOT_FOUND', 'Caja no encontrada');
  await prisma.$transaction(async (tx) => {
    await assertNameFree(tx, branchId, input.name);
    // La primera caja de la sucursal siempre es la principal
    const others = await tx.cashRegister.count({ where: { branchId, active: true } });
    const isMain = input.isMain || others === 0;
    if (isMain) await takeMain(tx, branchId, id);
    const row = await tx.cashRegister.create({
      data: {
        id,
        branchId,
        name: input.name,
        openingFloatMode: input.openingFloatMode,
        openingFloatAmount: input.openingFloatAmount,
        countByDenomination: input.countByDenomination,
        isMain,
      },
    });
    await recordAudit(tx, {
      action: 'cash.register.create',
      entity: 'cash_register',
      entityId: input.id,
      ...auditActor(actor, branchId),
      after: fields(row),
    });
  });
  return { register: await one(prisma, branchId, id, actor), created: true };
}

export async function updateCashRegister(
  prisma: PrismaClient,
  branchId: string,
  registerId: string,
  input: UpdateCashRegisterRequest,
  actor: Actor,
): Promise<CashRegister> {
  const id = toDbId(registerId);
  await prisma.$transaction(async (tx) => {
    const before = await tx.cashRegister.findUnique({ where: { id } });
    if (!before || before.branchId !== branchId)
      throw new AppError('NOT_FOUND', 'Caja no encontrada');
    await assertNameFree(tx, branchId, input.name, id);
    if (before.isMain && !input.isMain)
      throw new AppError(
        'VALIDATION_ERROR',
        'Siempre hay una caja principal: marca otra como principal y esta deja de serlo',
      );
    if (!input.active && (input.isMain || before.isMain))
      throw new AppError(
        'VALIDATION_ERROR',
        'La caja principal no se desactiva: marca otra como principal primero',
      );
    if (before.active && !input.active) {
      const open = await tx.shift.count({
        where: { cashRegisterId: id, status: { in: ['ABIERTO', 'EN_CORTE'] } },
      });
      if (open > 0)
        throw new AppError(
          'VALIDATION_ERROR',
          'La caja tiene un turno abierto: haz el corte antes de desactivarla',
        );
    }
    if (input.isMain && !before.isMain) await takeMain(tx, branchId, id);
    const after = await tx.cashRegister.update({
      where: { id },
      data: {
        name: input.name,
        openingFloatMode: input.openingFloatMode,
        openingFloatAmount: input.openingFloatAmount,
        countByDenomination: input.countByDenomination,
        isMain: input.isMain,
        active: input.active,
      },
    });
    const diff = changedFields(fields(before), fields(after));
    if (diff)
      await recordAudit(tx, {
        action: 'cash.register.update',
        entity: 'cash_register',
        entityId: registerId,
        ...auditActor(actor, branchId),
        ...diff,
      });
  });
  return one(prisma, branchId, id, actor);
}
