// Cuentas de la mesa, parte de sala (Docs/08 §2.7, RF-102 a RF-104). Dueño: Pablito.
// Crear y renombrar cuentas, mover ítems entre cuentas y separar unidades de un ítem.
// Los totales los calcula siempre el servidor (recomputeBills). Cobro y descuentos: H3.
import type {
  Bill,
  CreateBillRequest,
  MoveBillItemsRequest,
  PrecheckResponse,
  SplitOrderItemRequest,
  UpdateBillRequest,
} from '@mise/shared/contracts/billing';
import type { BillStatus } from '@mise/shared/contracts/floor';
import type { OrderItem } from '@mise/shared/contracts/orders';
import { AppError } from '../../core/errors.js';
import { newDbId, toApiId, toDbId } from '../../core/ids.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { recordAudit } from '../audit/index.js';
import { assertCanOperate, type Actor } from '../floor/index.js';
import { recomputeBills } from './totals.js';

type Tx = Prisma.TransactionClient;
type BillRow = Prisma.BillGetPayload<object>;
const money = (d: Prisma.Decimal) => d.toFixed(2);

export function toBill(b: BillRow): Bill {
  return {
    id: toApiId(b.id),
    occupancyId: toApiId(b.occupancyId),
    name: b.name,
    status: b.status as BillStatus,
    folio: b.folio,
    subtotal: money(b.subtotal),
    discountTotal: money(b.discountTotal),
    tipAmount: money(b.tipAmount),
    total: money(b.total),
    customerNit: b.customerNit,
    customerTaxName: b.customerTaxName,
    version: b.version,
  };
}

/** Ocupación abierta de la sucursal que el actor puede operar. */
export async function operableOccupancy(
  db: PrismaClient | Tx,
  branchId: string,
  id: string,
  a: Actor,
) {
  const occupancy = await db.occupancy.findUnique({ where: { id } });
  if (!occupancy || occupancy.branchId !== branchId) {
    throw new AppError('NOT_FOUND', 'La mesa no existe');
  }
  assertCanOperate({ waiterId: toApiId(occupancy.waiterId) }, a);
  return occupancy;
}

function assertOpenOccupancy(o: { status: string }) {
  if (o.status !== 'ABIERTA') {
    throw new AppError('VALIDATION_ERROR', 'La mesa ya no está abierta', { status: o.status });
  }
}

/** Cuenta de la sucursal que se puede cambiar: ni pagada ni eliminada. */
async function editableBill(tx: Tx, branchId: string, billId: string, a: Actor) {
  const bill = await tx.bill.findUnique({ where: { id: billId } });
  if (!bill) throw new AppError('NOT_FOUND', 'La cuenta no existe');
  const occupancy = await operableOccupancy(tx, branchId, bill.occupancyId, a);
  if (bill.status === 'PAGADA') {
    throw new AppError('BILL_PAID', `${bill.name} ya está pagada`, { billId: toApiId(bill.id) });
  }
  if (bill.status === 'ELIMINADA') {
    throw new AppError('VALIDATION_ERROR', 'La cuenta fue eliminada', {
      billId: toApiId(bill.id),
    });
  }
  return { bill, occupancy };
}

// ─── Consultar y crear ───────────────────────────────────────────────────────

/** GET /api/occupancies/:id/bills: cuentas con sus totales (sin las eliminadas). */
export async function listOccupancyBills(
  prisma: PrismaClient,
  branchId: string,
  occupancyId: string,
  actor: Actor,
): Promise<Bill[]> {
  const occupancy = await operableOccupancy(prisma, branchId, toDbId(occupancyId), actor);
  const rows = await prisma.bill.findMany({
    where: { occupancyId: occupancy.id, status: { not: 'ELIMINADA' } },
    orderBy: { id: 'asc' },
  });
  return rows.map(toBill);
}

/** POST /api/occupancies/:id/bills. Idempotente por id (`created: false` si ya existía). */
export async function createBill(
  prisma: PrismaClient,
  branchId: string,
  occupancyId: string,
  input: CreateBillRequest,
  actor: Actor,
): Promise<{ bill: Bill; created: boolean }> {
  const id = toDbId(input.id);
  const existing = await prisma.bill.findUnique({ where: { id } });
  if (existing) return { bill: toBill(existing), created: false };

  const occupancy = await operableOccupancy(prisma, branchId, toDbId(occupancyId), actor);
  assertOpenOccupancy(occupancy);
  try {
    const bill = await prisma.bill.create({
      data: {
        id,
        occupancyId: occupancy.id,
        name: input.name,
        ownerDeviceId: occupancy.ownerDeviceId,
        createdDeviceId: toDbId(actor.deviceId),
      },
    });
    return { bill: toBill(bill), created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return {
        bill: toBill(await prisma.bill.findUniqueOrThrow({ where: { id } })),
        created: false,
      };
    }
    throw error;
  }
}

/** PATCH /api/bills/:id: nombre y datos fiscales, con control de versión. */
export async function updateBill(
  prisma: PrismaClient,
  branchId: string,
  billId: string,
  input: UpdateBillRequest,
  actor: Actor,
): Promise<Bill> {
  return prisma.$transaction(async (tx) => {
    const id = toDbId(billId);
    await editableBill(tx, branchId, id, actor);
    const { count } = await tx.bill.updateMany({
      where: { id, version: input.version },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.customerNit !== undefined ? { customerNit: input.customerNit || null } : {}),
        ...(input.customerTaxName !== undefined
          ? { customerTaxName: input.customerTaxName || null }
          : {}),
        version: { increment: 1 },
      },
    });
    if (count === 0) throw new AppError('STALE_VERSION', 'La cuenta cambió; vuelve a cargarla');
    return toBill(await tx.bill.findUniqueOrThrow({ where: { id } }));
  });
}

// ─── Mover y separar ítems ───────────────────────────────────────────────────

async function lockItems(tx: Tx, ids: string[]) {
  await tx.$queryRaw`SELECT id FROM order_items WHERE id = ANY(${ids}::uuid[]) FOR UPDATE`;
  return tx.orderItem.findMany({ where: { id: { in: ids } }, include: { bill: true } });
}

/** El ítem se puede mover o separar: existe, no está cancelado y su cuenta no está pagada. */
function assertMovable(item: { status: string; bill: BillRow } | undefined, id: string) {
  if (!item) throw new AppError('NOT_FOUND', 'El ítem no existe', { itemId: id });
  if (item.status === 'CANCELADO') {
    throw new AppError('VALIDATION_ERROR', 'El ítem está cancelado', { itemId: id });
  }
  if (item.bill.status === 'PAGADA') {
    throw new AppError('BILL_PAID', `${item.bill.name} ya está pagada`, {
      billId: toApiId(item.bill.id),
    });
  }
}

/** POST /api/bills/move-items (RF-102): recalcula las cuentas de origen y destino. */
export async function moveBillItems(
  prisma: PrismaClient,
  branchId: string,
  input: MoveBillItemsRequest,
  actor: Actor,
): Promise<Bill[]> {
  return prisma.$transaction(async (tx) => {
    const target = await editableBill(tx, branchId, toDbId(input.targetBillId), actor);
    assertOpenOccupancy(target.occupancy);
    const ids = [...new Set(input.itemIds.map(toDbId))];
    const items = await lockItems(tx, ids);
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      assertMovable(item, toApiId(id));
      if (item!.bill.occupancyId !== target.bill.occupancyId) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Solo se mueven ítems entre cuentas de la misma mesa',
          {
            itemId: toApiId(id),
          },
        );
      }
      const seen = input.versions[toApiId(id)];
      if (seen === undefined || seen !== item!.version) {
        throw new AppError('STALE_VERSION', 'La cuenta cambió; vuelve a cargarla', {
          itemId: toApiId(id),
        });
      }
    }
    const moving = items.filter((i) => i.billId !== target.bill.id);
    for (const item of moving) {
      await tx.orderItem.update({
        where: { id: item.id },
        data: { billId: target.bill.id, version: { increment: 1 } },
      });
    }
    const touched = [target.bill.id, ...moving.map((i) => i.billId)];
    await recomputeBills(tx, touched);
    const bills = await tx.bill.findMany({
      where: { id: { in: [...new Set(touched)] } },
      orderBy: { id: 'asc' },
    });
    return bills.map(toBill);
  });
}

export const itemInclude = {
  modifiers: { orderBy: { id: 'asc' } },
  components: { orderBy: { id: 'asc' } },
} satisfies Prisma.OrderItemInclude;
type ItemRow = Prisma.OrderItemGetPayload<{ include: typeof itemInclude }>;

// Igual que en orders: no se importa de allá porque orders ya usa billing (recomputeBills)
export function toItem(i: ItemRow): OrderItem {
  return {
    id: toApiId(i.id),
    orderId: toApiId(i.orderId),
    billId: toApiId(i.billId),
    productId: toApiId(i.productId),
    productName: i.productNameSnapshot,
    quantity: i.quantity.toNumber(),
    unitPrice: money(i.unitPrice),
    modifiersTotal: money(i.modifiersTotal),
    lineTotal: money(i.lineTotal),
    note: i.note,
    status: i.status as OrderItem['status'],
    modifiers: i.modifiers.map((m) => ({
      modifierId: toApiId(m.modifierId),
      name: m.nameSnapshot,
      priceDelta: money(m.priceDelta),
    })),
    components: i.components.map((c) => ({
      comboGroupId: toApiId(c.comboGroupId),
      productId: toApiId(c.productId),
      name: c.nameSnapshot,
      priceDelta: money(c.priceDelta),
      modifiers: c.modifiers as unknown as OrderItem['components'][number]['modifiers'],
    })),
    splitFromId: i.splitFromId ? toApiId(i.splitFromId) : null,
    readyAt: i.readyAt ? i.readyAt.toISOString() : null,
    cancelledAt: i.cancelledAt ? i.cancelledAt.toISOString() : null,
    version: i.version,
  };
}

/**
 * POST /api/order-items/:id/split (RF-104): "3 × Cerveza" → "2 × Cerveza" + "1 × Cerveza" en el
 * mismo pedido, con el mismo producto, modificadores, nota y precio. El total de la mesa no cambia.
 * Repetirlo con el mismo `newItemId` devuelve lo mismo (idempotente).
 */
export async function splitOrderItem(
  prisma: PrismaClient,
  branchId: string,
  itemId: string,
  input: SplitOrderItemRequest,
  actor: Actor,
): Promise<{ original: OrderItem; created: OrderItem }> {
  const newId = toDbId(input.newItemId);
  const id = toDbId(itemId);
  const already = await prisma.orderItem.findUnique({ where: { id: newId }, include: itemInclude });
  if (already) {
    if (already.splitFromId !== id)
      throw new AppError('VALIDATION_ERROR', 'Ese id de ítem ya se usó');
    const original = await prisma.orderItem.findUniqueOrThrow({
      where: { id },
      include: itemInclude,
    });
    return { original: toItem(original), created: toItem(already) };
  }

  return prisma.$transaction(async (tx) => {
    const [item] = await lockItems(tx, [id]);
    assertMovable(item, itemId);
    const source = item!;
    await operableOccupancy(tx, branchId, source.bill.occupancyId, actor);
    if (source.version !== input.version) {
      throw new AppError('STALE_VERSION', 'La cuenta cambió; vuelve a cargarla');
    }
    const quantity = source.quantity.toNumber();
    if (input.quantity >= quantity) {
      throw new AppError('VALIDATION_ERROR', `Separa menos de ${quantity} unidades`, { quantity });
    }
    let targetBillId = source.billId;
    if (input.targetBillId) {
      const target = await editableBill(tx, branchId, toDbId(input.targetBillId), actor);
      if (target.bill.occupancyId !== source.bill.occupancyId) {
        throw new AppError('VALIDATION_ERROR', 'La cuenta no es de esta mesa');
      }
      targetBillId = target.bill.id;
    }

    const full = await tx.orderItem.findUniqueOrThrow({ where: { id }, include: itemInclude });
    const unit = full.unitPrice.plus(full.modifiersTotal);
    const keep = quantity - input.quantity;
    await tx.orderItem.update({
      where: { id },
      data: { quantity: keep, lineTotal: unit.times(keep), version: { increment: 1 } },
    });
    await tx.orderItem.create({
      data: {
        id: newId,
        orderId: full.orderId,
        billId: targetBillId,
        productId: full.productId,
        productNameSnapshot: full.productNameSnapshot,
        quantity: input.quantity,
        unitPrice: full.unitPrice,
        modifiersTotal: full.modifiersTotal,
        lineTotal: unit.times(input.quantity),
        unitCostSnapshot: full.unitCostSnapshot,
        note: full.note,
        status: full.status,
        splitFromId: id,
        readyAt: full.readyAt,
        createdDeviceId: toDbId(actor.deviceId),
        modifiers: {
          create: full.modifiers.map((m) => ({
            id: newDbId(),
            modifierId: m.modifierId,
            nameSnapshot: m.nameSnapshot,
            priceDelta: m.priceDelta,
            costSnapshot: m.costSnapshot,
          })),
        },
        components: {
          create: full.components.map((c) => ({
            id: newDbId(),
            comboGroupId: c.comboGroupId,
            productId: c.productId,
            nameSnapshot: c.nameSnapshot,
            priceDelta: c.priceDelta,
            costSnapshot: c.costSnapshot,
            modifiers: c.modifiers as Prisma.InputJsonValue,
          })),
        },
      },
    });
    await recomputeBills(tx, [source.billId, targetBillId]);
    const [original, created] = await Promise.all([
      tx.orderItem.findUniqueOrThrow({ where: { id }, include: itemInclude }),
      tx.orderItem.findUniqueOrThrow({ where: { id: newId }, include: itemInclude }),
    ]);
    return { original: toItem(original), created: toItem(created) };
  });
}

// ─── Pre-cuenta (Docs/05 paso 10) ────────────────────────────────────────────

/**
 * POST /api/bills/:id/precheck: la cuenta pasa a PRECUENTA (se puede seguir pidiendo; al agregar
 * vuelve a ABIERTA) y los pedidos LISTO con ítems en esta cuenta quedan entregados
 * automáticamente (S-09). Reasignado a Deniscito (doc 17 §3.1).
 */
export async function precheckBill(
  prisma: PrismaClient,
  branchId: string,
  billId: string,
  actor: Actor,
): Promise<{
  result: PrecheckResponse;
  occupancyId: string;
  autoDelivered: string[];
}> {
  return prisma.$transaction(async (tx) => {
    const id = toDbId(billId);
    const { bill, occupancy } = await editableBill(tx, branchId, id, actor);
    const reprint = bill.status === 'PRECUENTA';
    const now = new Date();

    // Pedidos listos de esta cuenta: se dan por entregados (S-09)
    const ready = await tx.order.findMany({
      where: { occupancyId: occupancy.id, status: 'LISTO', items: { some: { billId: id } } },
      select: { id: true },
    });
    for (const o of ready) {
      await tx.orderItem.updateMany({
        where: { orderId: o.id, status: 'LISTO' },
        data: { status: 'ENTREGADO', version: { increment: 1 } },
      });
      await tx.order.update({
        where: { id: o.id },
        data: {
          status: 'ENTREGADO',
          deliveredAt: now,
          deliveredAuto: true,
          version: { increment: 1 },
        },
      });
    }

    const updated = reprint
      ? bill
      : await tx.bill.update({
          where: { id },
          data: { status: 'PRECUENTA', version: { increment: 1 } },
        });
    await recordAudit(tx, {
      action: reprint ? 'bill.precheck_reprint' : 'bill.precheck',
      entity: 'bill',
      entityId: billId,
      userId: toDbId(actor.userId),
      authorizedBy: actor.authorizedBy ? toDbId(actor.authorizedBy) : null,
      deviceId: toDbId(actor.deviceId),
      branchId,
      ip: actor.ip,
    });

    const items = await tx.orderItem.findMany({
      where: { billId: id, status: { not: 'CANCELADO' } },
      orderBy: { id: 'asc' },
      include: itemInclude,
    });
    // Propina sugerida (Docs/03 §5): solo si está activa y, en para llevar, si aplica
    const settings = await tx.clientSettings.findFirst();
    const applies =
      settings?.tipsEnabled &&
      settings.tipSuggestedPct !== null &&
      (occupancy.tableId !== null || settings.tipAppliesTakeaway);
    const pct = applies ? settings.tipSuggestedPct! : null;
    const tip = pct
      ? updated.total.times(pct).dividedBy(100).toDecimalPlaces(2)
      : new Prisma.Decimal(0);
    return {
      result: {
        bill: toBill(updated),
        items: items.map(toItem),
        tipPct: pct ? pct.toString() : null,
        tipAmount: money(tip),
        totalWithTip: money(updated.total.plus(tip)),
        reprint,
      },
      occupancyId: toApiId(occupancy.id),
      autoDelivered: ready.map((o) => toApiId(o.id)),
    };
  });
}
