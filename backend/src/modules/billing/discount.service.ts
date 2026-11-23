// Descuentos sobre la cuenta o un ítem (Docs/03 §5 regla 2, Docs/05 §4, Docs/08 §2.7). H3 #19.
// Dueño: Pablito; reasignado a Deniscito (doc 17 §3.1).
// - Solo si el restaurante los activó (client_settings.discounts_enabled).
// - Motivo obligatorio (tipo DISCOUNT).
// - Tope por rol (roles.max_discount_pct y max_discount_amount, el más alto de sus roles; null =
//   sin tope en esa medida). Por encima del tope hace falta discount.apply_unlimited o 🔑.
import type {
  AppliedDiscount,
  ApplyDiscountRequest,
  BillDiscountsResponse,
} from '@mise/shared/contracts/billing';
import { AppError } from '../../core/errors.js';
import { toApiId, toDbId } from '../../core/ids.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { recordAudit } from '../audit/index.js';
import type { Actor } from '../floor/index.js';
import { editableBill, operableOccupancy, toBill } from './billing.service.js';
import { discountAmount, recomputeBills } from './totals.js';

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal;
const money = (d: Prisma.Decimal) => d.toFixed(2);

async function listDiscounts(tx: Tx, billId: string): Promise<AppliedDiscount[]> {
  const items = await tx.orderItem.findMany({ where: { billId }, select: { id: true } });
  const rows = await tx.appliedDiscount.findMany({
    where: { OR: [{ billId }, { orderItemId: { in: items.map((i) => i.id) } }] },
    orderBy: { createdAt: 'asc' },
  });
  const reasons = new Map(
    (await tx.reason.findMany({ where: { id: { in: rows.map((r) => r.reasonId) } } })).map((r) => [
      r.id,
      r.name,
    ]),
  );
  return rows.map((r) => ({
    id: toApiId(r.id),
    target: r.billId ? 'BILL' : 'ITEM',
    itemId: r.orderItemId ? toApiId(r.orderItemId) : null,
    kind: r.kind as AppliedDiscount['kind'],
    value: money(r.value),
    amount: money(r.amount),
    reasonName: reasons.get(r.reasonId) ?? '',
  }));
}

/** El tope más alto entre los roles del usuario (null = sin tope en esa medida). */
async function roleLimits(tx: Tx, userId: string) {
  const roles = await tx.userRole.findMany({ where: { userId }, include: { role: true } });
  const pick = (values: (Prisma.Decimal | null)[]) =>
    values.some((v) => v === null)
      ? null
      : values.reduce<Prisma.Decimal>((a, b) => (b!.gt(a) ? b! : a), new D(0));
  return {
    pct: pick(roles.map((r) => r.role.maxDiscountPct)),
    amount: pick(roles.map((r) => r.role.maxDiscountAmount)),
  };
}

/** POST /api/bills/:id/discounts. `allowUnlimited`: el actor (o su 🔑) puede pasar el tope. */
export async function applyDiscount(
  prisma: PrismaClient,
  branchId: string,
  billId: string,
  input: ApplyDiscountRequest,
  actor: Actor,
  allowUnlimited: boolean,
): Promise<BillDiscountsResponse> {
  return prisma.$transaction(async (tx) => {
    const settings = await tx.clientSettings.findFirst();
    if (!settings?.discountsEnabled)
      throw new AppError(
        'VALIDATION_ERROR',
        'Los descuentos están desactivados en este restaurante',
      );
    const id = toDbId(billId);
    await editableBill(tx, branchId, id, actor);
    const reason = await tx.reason.findFirst({
      where: { id: toDbId(input.reasonId), type: 'DISCOUNT', active: true },
    });
    if (!reason) throw new AppError('VALIDATION_ERROR', 'Elige un motivo de descuento');

    // Base: la línea del ítem o lo que queda de la cuenta después de los descuentos de ítem
    await recomputeBills(tx, [id]);
    const bill = await tx.bill.findUniqueOrThrow({ where: { id } });
    let base: Prisma.Decimal;
    let itemId: string | null = null;
    if (input.target === 'ITEM') {
      if (!input.itemId) throw new AppError('VALIDATION_ERROR', 'Falta el ítem');
      const item = await tx.orderItem.findFirst({
        where: { id: toDbId(input.itemId), billId: id, status: { not: 'CANCELADO' } },
      });
      if (!item) throw new AppError('VALIDATION_ERROR', 'El ítem no es de esta cuenta');
      itemId = item.id;
      base = item.lineTotal;
    } else {
      const billDiscount = await tx.appliedDiscount.findFirst({ where: { billId: id } });
      base = bill.subtotal.minus(bill.discountTotal).plus(billDiscount?.amount ?? 0);
    }
    const value = new D(input.value);
    if (input.kind === 'PCT' && value.gt(100))
      throw new AppError('VALIDATION_ERROR', 'El porcentaje no puede pasar de 100');
    if (input.kind === 'AMOUNT' && value.gt(base))
      throw new AppError('VALIDATION_ERROR', `El descuento no puede pasar de ${money(base)}`);
    const amount = discountAmount(input.kind, value, base);

    // Tope del rol (Docs/03 §5 regla 2)
    if (!allowUnlimited) {
      const limits = await roleLimits(tx, toDbId(actor.userId));
      const pct = base.gt(0) ? amount.times(100).dividedBy(base) : new D(0);
      const over =
        (limits.pct !== null && pct.gt(limits.pct)) ||
        (limits.amount !== null && amount.gt(limits.amount));
      if (over)
        throw new AppError(
          'AUTHORIZATION_REQUIRED',
          'El descuento pasa tu tope: hace falta autorización',
          {
            permission: 'discount.apply_unlimited',
          },
        );
    }

    // Uno por cuenta y uno por ítem: el nuevo reemplaza al anterior
    await tx.appliedDiscount.deleteMany({
      where: itemId ? { orderItemId: itemId } : { billId: id },
    });
    await tx.appliedDiscount.create({
      data: {
        id: toDbId(input.id),
        billId: itemId ? null : id,
        orderItemId: itemId,
        kind: input.kind,
        value,
        amount,
        reasonId: reason.id,
        appliedBy: toDbId(actor.userId),
        authorizedBy: actor.authorizedBy ? toDbId(actor.authorizedBy) : null,
        createdDeviceId: toDbId(actor.deviceId),
      },
    });
    await recomputeBills(tx, [id]);
    await recordAudit(tx, {
      action: 'discount.apply',
      entity: 'bill',
      entityId: billId,
      userId: toDbId(actor.userId),
      authorizedBy: actor.authorizedBy ? toDbId(actor.authorizedBy) : null,
      deviceId: toDbId(actor.deviceId),
      branchId,
      ip: actor.ip,
      reasonId: reason.id,
      after: { target: input.target, kind: input.kind, value: input.value, amount: money(amount) },
    });
    return {
      bill: toBill(await tx.bill.findUniqueOrThrow({ where: { id } })),
      discounts: await listDiscounts(tx, id),
    };
  });
}

/** DELETE /api/discounts/:id (discount.apply): queda en la bitácora. */
export async function removeDiscount(
  prisma: PrismaClient,
  branchId: string,
  discountId: string,
  actor: Actor,
): Promise<BillDiscountsResponse> {
  return prisma.$transaction(async (tx) => {
    const d = await tx.appliedDiscount.findUnique({ where: { id: toDbId(discountId) } });
    if (!d) throw new AppError('NOT_FOUND', 'El descuento no existe');
    const billId =
      d.billId ?? (await tx.orderItem.findUniqueOrThrow({ where: { id: d.orderItemId! } })).billId;
    await editableBill(tx, branchId, billId, actor);
    await tx.appliedDiscount.delete({ where: { id: d.id } });
    await recomputeBills(tx, [billId]);
    await recordAudit(tx, {
      action: 'discount.remove',
      entity: 'bill',
      entityId: toApiId(billId),
      userId: toDbId(actor.userId),
      deviceId: toDbId(actor.deviceId),
      branchId,
      ip: actor.ip,
      before: { kind: d.kind, value: money(d.value), amount: money(d.amount) },
    });
    return {
      bill: toBill(await tx.bill.findUniqueOrThrow({ where: { id: billId } })),
      discounts: await listDiscounts(tx, billId),
    };
  });
}

/** GET /api/bills/:id/discounts */
export async function getDiscounts(
  prisma: PrismaClient,
  branchId: string,
  billId: string,
  actor: Actor,
) {
  return prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findUnique({ where: { id: toDbId(billId) } });
    if (!bill) throw new AppError('NOT_FOUND', 'La cuenta no existe');
    await operableOccupancy(tx, branchId, bill.occupancyId, actor);
    return { bill: toBill(bill), discounts: await listDiscounts(tx, bill.id) };
  });
}
