// Pedidos: enviar ronda, entregar y cancelar ítem (Docs/05 pasos 4 a 9, Docs/08 §2.6). Dueño: Pablito.
// El precio lo pone el dispositivo (el que vio el mesero al vender) y el servidor lo respeta
// (Docs/09 §6.3); el servidor valida que el producto se venda y que los modificadores y combos
// cumplan las reglas del menú. Aceptar, listo y recall son de kitchen (Deniscito).
import type {
  CancelOrderItemRequest,
  Order,
  OrderItem,
  SendOrderRequest,
} from '@mise/shared/contracts/orders';
import { canOrderTransition, type OrderStatus } from '@mise/shared/domain/orders';
import { AppError } from '../../core/errors.js';
import { newDbId, toApiId, toDbId } from '../../core/ids.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { recordAudit } from '../audit/index.js';
import { recomputeBills } from '../billing/index.js';
import { assertCanOperate, type Actor } from '../floor/index.js';

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal;
const money = (d: Prisma.Decimal) => d.toFixed(2);
const iso = (d: Date | null) => (d ? d.toISOString() : null);

function auditActor(a: Actor, branchId: string) {
  return {
    userId: toDbId(a.userId),
    deviceId: toDbId(a.deviceId),
    authorizedBy: a.authorizedBy ? toDbId(a.authorizedBy) : null,
    branchId,
    ip: a.ip,
  };
}

// ─── Conversión a la API ─────────────────────────────────────────────────────

export const orderInclude = {
  items: {
    orderBy: { id: 'asc' },
    include: { modifiers: { orderBy: { id: 'asc' } }, components: { orderBy: { id: 'asc' } } },
  },
} satisfies Prisma.OrderInclude;
export type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
type ItemRow = OrderRow['items'][number];

interface StoredModifier {
  modifierId: string;
  name: string;
  priceDelta: string;
}

function toItem(i: ItemRow): OrderItem {
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
      modifiers: c.modifiers as unknown as StoredModifier[],
    })),
    splitFromId: i.splitFromId ? toApiId(i.splitFromId) : null,
    readyAt: iso(i.readyAt),
    cancelledAt: iso(i.cancelledAt),
    version: i.version,
  };
}

export function toOrder(o: OrderRow): Order {
  return {
    id: toApiId(o.id),
    occupancyId: toApiId(o.occupancyId),
    roundNumber: o.roundNumber,
    folio: o.folio,
    tempFolio: o.tempFolio,
    status: o.status as OrderStatus,
    sentBy: toApiId(o.sentBy),
    sentAt: o.sentAt.toISOString(),
    acceptedAt: iso(o.acceptedAt),
    readyAt: iso(o.readyAt),
    deliveredAt: iso(o.deliveredAt),
    deliveredAuto: o.deliveredAuto,
    syncedLate: o.syncedLate,
    printedAt: iso(o.printedAt),
    items: o.items.map(toItem),
    version: o.version,
  };
}

async function loadOrder(db: PrismaClient | Tx, dbId: string): Promise<OrderRow | null> {
  return db.order.findUnique({ where: { id: dbId }, include: orderInclude });
}

// ─── Reglas del menú ─────────────────────────────────────────────────────────

const productInclude = {
  category: { select: { stationId: true } },
  modifierGroups: { include: { group: { include: { modifiers: true } } } },
  comboGroups: { include: { options: true } },
} satisfies Prisma.ProductInclude;
type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function assertSellable(p: { id: string; name: string; status: string } | undefined, id: string) {
  if (!p) throw new AppError('VALIDATION_ERROR', 'El producto no existe', { productId: id });
  if (p.status !== 'ACTIVE') {
    throw new AppError('PRODUCT_SOLD_OUT', `${p.name} no está disponible`, {
      productId: toApiId(p.id),
    });
  }
}

/**
 * Valida los modificadores elegidos para un producto: que sean de sus grupos, que se vendan y
 * que cada grupo respete su mínimo, máximo y si es obligatorio (MODIFIER_RULES).
 * Devuelve los modificadores con su nombre para guardarlos como snapshot.
 */
function checkModifiers(
  product: ProductRow,
  chosen: { modifierId: string; priceDelta: string }[],
): { modifierId: string; name: string; priceDelta: Prisma.Decimal }[] {
  const byId = new Map(
    product.modifierGroups.flatMap((pg) => pg.group.modifiers.map((m) => [m.id, m] as const)),
  );
  const result = chosen.map((c) => {
    const m = byId.get(toDbId(c.modifierId));
    if (!m) {
      throw new AppError('MODIFIER_RULES', `Ese modificador no es de ${product.name}`, {
        productId: toApiId(product.id),
        modifierId: c.modifierId,
      });
    }
    if (m.status !== 'ACTIVE') {
      throw new AppError('PRODUCT_SOLD_OUT', `${m.name} no está disponible`, {
        modifierId: c.modifierId,
      });
    }
    return { modifierId: m.id, groupId: m.groupId, name: m.name, priceDelta: new D(c.priceDelta) };
  });
  if (new Set(result.map((r) => r.modifierId)).size !== result.length) {
    throw new AppError('MODIFIER_RULES', 'Un modificador se eligió dos veces', {
      productId: toApiId(product.id),
    });
  }
  for (const { group } of product.modifierGroups) {
    const count = result.filter((r) => r.groupId === group.id).length;
    const min = Math.max(group.minSelect, group.required ? 1 : 0);
    if (count < min || count > group.maxSelect) {
      throw new AppError(
        'MODIFIER_RULES',
        count < min
          ? `${product.name}: elige al menos ${min} en "${group.name}"`
          : `${product.name}: máximo ${group.maxSelect} en "${group.name}"`,
        { productId: toApiId(product.id), groupId: toApiId(group.id) },
      );
    }
  }
  return result.map(({ modifierId, name, priceDelta }) => ({ modifierId, name, priceDelta }));
}

type ItemInput = SendOrderRequest['items'][number];

/** Valida un ítem y arma lo que se guarda: snapshots, total de modificadores y de la línea. */
function buildItem(item: ItemInput, products: Map<string, ProductRow>) {
  const product = products.get(toDbId(item.productId));
  assertSellable(product, item.productId);
  const p = product!;
  const modifiers = checkModifiers(p, item.modifiers);

  if (!p.isCombo && item.components.length > 0) {
    throw new AppError('VALIDATION_ERROR', `${p.name} no es un combo`, {
      productId: item.productId,
    });
  }
  const components = item.components.map((c) => {
    const group = p.comboGroups.find((g) => g.id === toDbId(c.comboGroupId));
    if (!group) {
      throw new AppError('MODIFIER_RULES', `Ese grupo no es del combo ${p.name}`, {
        productId: item.productId,
        comboGroupId: c.comboGroupId,
      });
    }
    if (!group.options.some((o) => o.productId === toDbId(c.productId))) {
      throw new AppError('MODIFIER_RULES', `Esa opción no es de "${group.name}"`, {
        comboGroupId: c.comboGroupId,
        productId: c.productId,
      });
    }
    const option = products.get(toDbId(c.productId));
    assertSellable(option, c.productId);
    return {
      comboGroupId: group.id,
      productId: option!.id,
      name: option!.name,
      priceDelta: new D(c.priceDelta),
      modifiers: checkModifiers(option!, c.modifiers),
    };
  });
  for (const group of p.comboGroups) {
    const count = components.filter((c) => c.comboGroupId === group.id).length;
    if (count < group.minSelect || count > group.maxSelect) {
      throw new AppError('MODIFIER_RULES', `${p.name}: revisa "${group.name}"`, {
        productId: item.productId,
        comboGroupId: toApiId(group.id),
      });
    }
  }

  // Por unidad: modificadores + extras del combo y de sus modificadores (SC-48)
  const modifiersTotal = [
    ...modifiers.map((m) => m.priceDelta),
    ...components.flatMap((c) => [c.priceDelta, ...c.modifiers.map((m) => m.priceDelta)]),
  ].reduce((a, b) => a.plus(b), new D(0));
  const unitPrice = new D(item.unitPrice);
  const lineTotal = unitPrice.plus(modifiersTotal).times(item.quantity);
  return { product: p, modifiers, components, unitPrice, modifiersTotal, lineTotal };
}

// ─── Folio ───────────────────────────────────────────────────────────────────

/** Siguiente folio definitivo de la sucursal (Docs/09 §5): "C-000123", o "000123" sin prefijo. */
async function nextFolio(tx: Tx, branchId: string, docType: 'ORDER' | 'BILL'): Promise<string> {
  const [row] = await tx.$queryRaw<{ last_value: number }[]>`
    INSERT INTO folio_sequences (branch_id, doc_type, last_value)
    VALUES (${branchId}::uuid, ${docType}, 1)
    ON CONFLICT (branch_id, doc_type)
    DO UPDATE SET last_value = folio_sequences.last_value + 1
    RETURNING last_value`;
  const branch = await tx.branch.findUniqueOrThrow({
    where: { id: branchId },
    select: { folioPrefix: true },
  });
  const number = String(row!.last_value).padStart(6, '0');
  return branch.folioPrefix ? `${branch.folioPrefix}-${number}` : number;
}

// ─── Enviar ronda ────────────────────────────────────────────────────────────

/**
 * POST /api/orders. Idempotente por `id`: reenviar la misma ronda devuelve la misma
 * (`created: false`). Todo en una transacción: folio, ronda, ítems y totales de las cuentas.
 */
export async function sendOrder(
  prisma: PrismaClient,
  branchId: string,
  input: SendOrderRequest,
  actor: Actor,
): Promise<{ order: Order; created: boolean }> {
  const id = toDbId(input.id);
  const existing = await loadOrder(prisma, id);
  // Reenvío (outbox): la misma ronda, aunque la mesa se haya unido a otra después
  if (existing) return { order: toOrder(existing), created: false };

  try {
    const order = await prisma.$transaction(async (tx) => {
      const occupancyId = toDbId(input.occupancyId);
      // Bloquea la ocupación: dos rondas a la vez no toman el mismo número de ronda
      await tx.$queryRaw`SELECT id FROM occupancies WHERE id = ${occupancyId}::uuid FOR UPDATE`;
      const occupancy = await tx.occupancy.findUnique({ where: { id: occupancyId } });
      if (!occupancy || occupancy.branchId !== branchId) {
        throw new AppError('NOT_FOUND', 'La mesa no existe');
      }
      if (occupancy.status !== 'ABIERTA') {
        throw new AppError('VALIDATION_ERROR', 'La mesa ya no está abierta', {
          status: occupancy.status,
        });
      }
      assertCanOperate({ waiterId: toApiId(occupancy.waiterId) }, actor);

      // Cuentas: de esta mesa y abiertas (RF-103)
      const billIds = [...new Set(input.items.map((i) => toDbId(i.billId)))];
      const bills = await tx.bill.findMany({ where: { id: { in: billIds } } });
      for (const billId of billIds) {
        const bill = bills.find((b) => b.id === billId);
        if (!bill || bill.occupancyId !== occupancyId || bill.status === 'ELIMINADA') {
          throw new AppError('VALIDATION_ERROR', 'La cuenta no es de esta mesa', {
            billId: toApiId(billId),
          });
        }
        if (bill.status === 'PAGADA') {
          throw new AppError('BILL_PAID', `${bill.name} ya está pagada`, {
            billId: toApiId(billId),
          });
        }
      }

      // Productos del pedido y de las opciones de los combos, con sus reglas
      const productIds = new Set(
        input.items.flatMap((i) => [
          toDbId(i.productId),
          ...i.components.map((c) => toDbId(c.productId)),
        ]),
      );
      const products = new Map(
        (
          await tx.product.findMany({
            where: { id: { in: [...productIds] } },
            include: productInclude,
          })
        ).map((p) => [p.id, p]),
      );
      const built = input.items.map((item) => ({ item, ...buildItem(item, products) }));

      const rounds = await tx.order.count({ where: { occupancyId } });
      const station = await tx.kitchenStation.findFirst({
        where: { branchId, isDefault: true },
        select: { id: true },
      });
      const now = new Date();
      await tx.order.create({
        data: {
          id,
          occupancyId,
          branchId,
          // MVP: una estación por sucursal (RF-022); la de la categoría si no hay predeterminada
          stationId: station?.id ?? built[0]!.product.category.stationId,
          roundNumber: rounds + 1,
          folio: await nextFolio(tx, branchId, 'ORDER'),
          tempFolio: input.tempFolio ?? null,
          sentBy: toDbId(actor.userId),
          sentAt: now,
          syncedLate: input.tempFolio !== undefined,
          createdDeviceId: toDbId(actor.deviceId),
          items: {
            create: built.map(({ item, product, modifiers, components, ...totals }) => ({
              id: toDbId(item.id),
              billId: toDbId(item.billId),
              productId: product.id,
              productNameSnapshot: product.name,
              quantity: item.quantity,
              unitPrice: totals.unitPrice,
              modifiersTotal: totals.modifiersTotal,
              lineTotal: totals.lineTotal,
              note: item.note ? item.note : null,
              createdDeviceId: toDbId(actor.deviceId),
              modifiers: {
                create: modifiers.map((m) => ({
                  id: newDbId(),
                  modifierId: m.modifierId,
                  nameSnapshot: m.name,
                  priceDelta: m.priceDelta,
                })),
              },
              components: {
                create: components.map((c) => ({
                  id: newDbId(),
                  comboGroupId: c.comboGroupId,
                  productId: c.productId,
                  nameSnapshot: c.name,
                  priceDelta: c.priceDelta,
                  modifiers: c.modifiers.map((m) => ({
                    modifierId: toApiId(m.modifierId),
                    name: m.name,
                    priceDelta: money(m.priceDelta),
                  })),
                })),
              },
            })),
          },
        },
      });
      await recomputeBills(tx, billIds);
      // Si se pidió más sobre una pre-cuenta, la cuenta vuelve a ABIERTA (Docs/05 paso 10)
      await tx.bill.updateMany({
        where: { id: { in: billIds }, status: 'PRECUENTA' },
        data: { status: 'ABIERTA', version: { increment: 1 } },
      });
      return (await loadOrder(tx, id))!;
    });
    return { order: toOrder(order), created: true };
  } catch (error) {
    // Dos envíos de la misma ronda a la vez: gana uno y el otro recibe la misma
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const again = await loadOrder(prisma, id);
      if (again) return { order: toOrder(again), created: false };
      throw new AppError('VALIDATION_ERROR', 'Un ítem tiene un id que ya existe');
    }
    throw error;
  }
}

// ─── Consultar ───────────────────────────────────────────────────────────────

async function occupancyInBranch(db: PrismaClient | Tx, branchId: string, occupancyId: string) {
  const occupancy = await db.occupancy.findUnique({ where: { id: occupancyId } });
  if (!occupancy || occupancy.branchId !== branchId) {
    throw new AppError('NOT_FOUND', 'La mesa no existe');
  }
  return occupancy;
}

/** GET /api/occupancies/:id/orders: las rondas de la mesa (incluye las de mesas unidas). */
export async function listOccupancyOrders(
  prisma: PrismaClient,
  branchId: string,
  occupancyId: string,
  actor: Actor,
): Promise<Order[]> {
  const occupancy = await occupancyInBranch(prisma, branchId, toDbId(occupancyId));
  assertCanOperate({ waiterId: toApiId(occupancy.waiterId) }, actor);
  const rows = await prisma.order.findMany({
    where: { occupancyId: occupancy.id },
    orderBy: { roundNumber: 'asc' },
    include: orderInclude,
  });
  return rows.map(toOrder);
}

async function orderInBranch(tx: Tx, branchId: string, orderId: string) {
  // Bloquea el pedido: entregar y cancelar no se pisan
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
  const order = await loadOrder(tx, orderId);
  if (!order || order.branchId !== branchId) throw new AppError('NOT_FOUND', 'El pedido no existe');
  return order;
}

// ─── Entregar ────────────────────────────────────────────────────────────────

/** POST /api/orders/:id/deliver: LISTO → ENTREGADO (Docs/05 paso 9). Repetirlo no cambia nada. */
export async function deliverOrder(
  prisma: PrismaClient,
  branchId: string,
  orderId: string,
  actor: Actor,
): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const id = toDbId(orderId);
    const order = await orderInBranch(tx, branchId, id);
    const occupancy = await occupancyInBranch(tx, branchId, order.occupancyId);
    assertCanOperate({ waiterId: toApiId(occupancy.waiterId) }, actor);
    if (order.status === 'ENTREGADO') return toOrder(order);
    if (!canOrderTransition(order.status as OrderStatus, 'ENTREGADO')) {
      throw new AppError(
        'VALIDATION_ERROR',
        order.status === 'CANCELADO'
          ? 'El pedido está cancelado'
          : 'El pedido todavía no está listo',
        { status: order.status },
      );
    }
    const now = new Date();
    await tx.orderItem.updateMany({
      where: { orderId: id, status: { not: 'CANCELADO' } },
      data: { status: 'ENTREGADO', version: { increment: 1 } },
    });
    await tx.order.update({
      where: { id },
      data: {
        status: 'ENTREGADO',
        deliveredAt: now,
        deliveredBy: toDbId(actor.userId),
        version: { increment: 1 },
      },
    });
    return toOrder((await loadOrder(tx, id))!);
  });
}

// ─── Cancelar ítem ───────────────────────────────────────────────────────────

/**
 * POST /api/order-items/:id/cancel (order.cancel_sent o 🔑, motivo obligatorio; Docs/05 §7).
 * Si el ítem ya estaba listo o entregado queda como merma (`cancel_after_ready`). Si se cancelan
 * todos los ítems, el pedido pasa a CANCELADO salvo que ya esté ENTREGADO (PA-055).
 */
export async function cancelOrderItem(
  prisma: PrismaClient,
  branchId: string,
  itemId: string,
  input: CancelOrderItemRequest,
  actor: Actor,
): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: toDbId(itemId) },
      include: { bill: true },
    });
    if (!item) throw new AppError('NOT_FOUND', 'El ítem no existe');
    const order = await orderInBranch(tx, branchId, item.orderId);
    const occupancy = await occupancyInBranch(tx, branchId, order.occupancyId);
    assertCanOperate({ waiterId: toApiId(occupancy.waiterId) }, actor);
    if (item.status === 'CANCELADO') {
      throw new AppError('VALIDATION_ERROR', 'El ítem ya está cancelado');
    }
    if (item.bill.status === 'PAGADA') {
      throw new AppError('BILL_PAID', `${item.bill.name} ya está pagada`, {
        billId: toApiId(item.billId),
      });
    }
    const reason = await tx.reason.findUnique({ where: { id: toDbId(input.reasonId) } });
    if (!reason || reason.type !== 'CANCEL_ITEM' || !reason.active) {
      throw new AppError('VALIDATION_ERROR', 'Elige un motivo de cancelación', {
        reasonId: input.reasonId,
      });
    }

    const afterReady = item.status === 'LISTO' || item.status === 'ENTREGADO';
    const now = new Date();
    await tx.orderItem.update({
      where: { id: item.id },
      data: {
        status: 'CANCELADO',
        cancelledAt: now,
        cancelledBy: toDbId(actor.userId),
        authorizedBy: actor.authorizedBy ? toDbId(actor.authorizedBy) : null,
        cancelReasonId: reason.id,
        cancelAfterReady: afterReady,
        version: { increment: 1 },
      },
    });
    const remaining = await tx.orderItem.count({
      where: { orderId: order.id, status: { not: 'CANCELADO' } },
    });
    const orderStatus = order.status as OrderStatus;
    const cancelOrder = remaining === 0 && canOrderTransition(orderStatus, 'CANCELADO');
    await tx.order.update({
      where: { id: order.id },
      data: { ...(cancelOrder ? { status: 'CANCELADO' } : {}), version: { increment: 1 } },
    });
    await recomputeBills(tx, [item.billId]);

    await recordAudit(tx, {
      action: 'order.item_cancel',
      entity: 'order_item',
      entityId: toApiId(item.id),
      ...auditActor(actor, branchId),
      before: { status: item.status },
      after: {
        status: 'CANCELADO',
        afterReady,
        product: item.productNameSnapshot,
        quantity: item.quantity.toNumber(),
        lineTotal: money(item.lineTotal),
        orderStatus: cancelOrder ? 'CANCELADO' : orderStatus,
      },
      reasonId: reason.id,
      note: input.note ?? null,
    });
    return toOrder((await loadOrder(tx, order.id))!);
  });
}
