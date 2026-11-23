// Administración de métodos de pago (RF-027, Docs/08 §2.3; H3 #21). Dueño: Pablito.
// Solo el efectivo da cambio y entra al efectivo esperado del corte. El tipo no cambia después de
// crearlo (los cobros viejos y el corte lo usan) y nunca se queda el restaurante sin un método activo.
import type {
  CreatePaymentMethodRequest,
  PaymentMethodAdmin,
  UpdatePaymentMethodRequest,
} from '@mise/shared/contracts/billing';
import { AppError } from '../../core/errors.js';
import { toApiId, toDbId } from '../../core/ids.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { changedFields, recordAudit } from '../audit/index.js';
import type { Actor } from '../floor/index.js';

type Tx = Prisma.TransactionClient;
type Row = Prisma.PaymentMethodGetPayload<object>;

const toAdmin = (m: Row): PaymentMethodAdmin => ({
  id: toApiId(m.id),
  name: m.name,
  kind: m.kind as PaymentMethodAdmin['kind'],
  givesChange: m.givesChange,
  requiresReference: m.requiresReference,
  active: m.active,
  sort: m.sort,
});

const auditActor = (a: Actor) => ({
  userId: toDbId(a.userId),
  deviceId: toDbId(a.deviceId),
  authorizedBy: a.authorizedBy ? toDbId(a.authorizedBy) : null,
  ip: a.ip,
});

export async function listAllPaymentMethods(prisma: PrismaClient): Promise<PaymentMethodAdmin[]> {
  const rows = await prisma.paymentMethod.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }] });
  return rows.map(toAdmin);
}

async function assertNameFree(tx: Tx, name: string, exceptId?: string) {
  const taken = await tx.paymentMethod.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (taken && taken.id !== exceptId)
    throw new AppError('VALIDATION_ERROR', `Ya existe el método "${name}"`);
}

export async function createPaymentMethod(
  prisma: PrismaClient,
  input: CreatePaymentMethodRequest,
  actor: Actor,
): Promise<{ method: PaymentMethodAdmin; created: boolean }> {
  const id = toDbId(input.id);
  const existing = await prisma.paymentMethod.findUnique({ where: { id } });
  if (existing) return { method: toAdmin(existing), created: false };
  const row = await prisma.$transaction(async (tx) => {
    await assertNameFree(tx, input.name);
    const last = await tx.paymentMethod.aggregate({ _max: { sort: true } });
    const created = await tx.paymentMethod.create({
      data: {
        id,
        name: input.name,
        kind: input.kind,
        // Solo el efectivo da cambio (RF-027)
        givesChange: input.kind === 'CASH' && (input.givesChange ?? false),
        requiresReference: input.requiresReference ?? false,
        sort: input.sort ?? (last._max.sort ?? -1) + 1,
      },
    });
    const m = toAdmin(created);
    await recordAudit(tx, {
      action: 'config.payment_method.create',
      entity: 'payment_method',
      entityId: input.id,
      ...auditActor(actor),
      after: { ...m, id: undefined },
    });
    return created;
  });
  return { method: toAdmin(row), created: true };
}

export async function updatePaymentMethod(
  prisma: PrismaClient,
  methodId: string,
  input: UpdatePaymentMethodRequest,
  actor: Actor,
): Promise<PaymentMethodAdmin> {
  const id = toDbId(methodId);
  return prisma.$transaction(async (tx) => {
    const before = await tx.paymentMethod.findUnique({ where: { id } });
    if (!before) throw new AppError('NOT_FOUND', 'Método de pago no encontrado');
    await assertNameFree(tx, input.name, id);
    if (before.active && !input.active) {
      const others = await tx.paymentMethod.count({
        where: { active: true, id: { not: id } },
      });
      if (others === 0)
        throw new AppError(
          'VALIDATION_ERROR',
          'Es el único método de pago activo: agrega otro antes de desactivarlo',
        );
    }
    const after = await tx.paymentMethod.update({
      where: { id },
      data: {
        name: input.name,
        givesChange: before.kind === 'CASH' && input.givesChange,
        requiresReference: input.requiresReference,
        active: input.active,
        sort: input.sort,
      },
    });
    const diff = changedFields(toAdmin(before), toAdmin(after));
    if (diff)
      await recordAudit(tx, {
        action: 'config.payment_method.update',
        entity: 'payment_method',
        entityId: methodId,
        ...auditActor(actor),
        ...diff,
      });
    return toAdmin(after);
  });
}
