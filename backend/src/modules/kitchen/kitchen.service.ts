// Cocina / KDS (Docs/05 pasos 5 a 8, Docs/08 §2.6). Dueño: Deniscito.
// Aceptar, listo (pedido o ítem) y recall. Todo es idempotente: si dos pantallas tocan a la vez,
// se conserva la primera marca (accepted_at, ready_at). No hay rechazo de pedidos.
import type { KdsOrder } from '@mise/shared/contracts/kitchen';
import { canOrderTransition, type OrderStatus } from '@mise/shared/domain/orders';
import { AppError } from '../../core/errors.js';
import { toApiId, toDbId } from '../../core/ids.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { recordAudit } from '../audit/index.js';
import { orderInclude, toOrder } from '../orders/index.js';

type Tx = Prisma.TransactionClient;

export interface Actor {
  userId: string;
  deviceId: string;
  ip: string;
}

const kdsInclude = {
  ...orderInclude,
  occupancy: {
    include: {
      table: { include: { zone: { select: { name: true } } } },
      orderType: { select: { code: true } },
    },
  },
} satisfies Prisma.OrderInclude;
type KdsRow = Prisma.OrderGetPayload<{ include: typeof kdsInclude }>;

async function toKds(db: PrismaClient | Tx, rows: KdsRow[]): Promise<KdsOrder[]> {
  const waiterIds = [...new Set(rows.map((r) => r.occupancy.waiterId))];
  const users = await db.user.findMany({
    where: { id: { in: waiterIds } },
    select: { id: true, fullName: true },
  });
  const names = new Map(users.map((u) => [u.id, u.fullName]));
  return rows.map((r) => {
    const t = r.occupancy.table;
    return {
      ...toOrder(r),
      table: t ? `${t.name} · ${t.zone.name}` : null,
      orderTypeCode: r.occupancy.orderType.code,
      customerName: r.occupancy.customerName,
      waiterId: toApiId(r.occupancy.waiterId),
      waiterName: names.get(r.occupancy.waiterId) ?? '',
      guests: r.occupancy.guests,
    };
  });
}

/** Cola FIFO de la sucursal: lo más antiguo primero (Docs/05 paso 5). */
export async function listKdsOrders(
  prisma: PrismaClient,
  branchId: string,
  statuses: OrderStatus[],
): Promise<KdsOrder[]> {
  const rows = await prisma.order.findMany({
    where: { branchId, status: { in: statuses } },
    orderBy: [{ sentAt: 'asc' }, { id: 'asc' }],
    include: kdsInclude,
  });
  return toKds(prisma, rows);
}

async function loadKds(tx: Tx, id: string): Promise<KdsOrder> {
  const row = await tx.order.findUniqueOrThrow({ where: { id }, include: kdsInclude });
  return (await toKds(tx, [row]))[0]!;
}

async function orderInBranch(tx: Tx, branchId: string, orderId: string) {
  const order = await tx.order.findFirst({
    where: { id: toDbId(orderId), branchId },
    include: { items: { select: { id: true, status: true } } },
  });
  if (!order) throw new AppError('NOT_FOUND', 'El pedido no existe');
  return order;
}

function assertOpen(status: string) {
  if (status === 'CANCELADO') throw new AppError('VALIDATION_ERROR', 'El pedido está cancelado');
  if (status === 'ENTREGADO') throw new AppError('VALIDATION_ERROR', 'El pedido ya se entregó');
}

const audit = (tx: Tx, actor: Actor, branchId: string, action: string, orderId: string) =>
  recordAudit(tx, {
    action,
    entity: 'order',
    entityId: orderId,
    userId: toDbId(actor.userId),
    deviceId: toDbId(actor.deviceId),
    branchId,
    ip: actor.ip,
  });

/** Pasa a EN_PREPARACION (si estaba ENVIADO) con su accepted_at. */
async function acceptInTx(tx: Tx, order: { id: string; status: string }, actor: Actor, now: Date) {
  if (order.status !== 'ENVIADO') return false;
  await tx.order.update({
    where: { id: order.id },
    data: {
      status: 'EN_PREPARACION',
      acceptedAt: now,
      acceptedBy: toDbId(actor.userId),
      version: { increment: 1 },
    },
  });
  await tx.orderItem.updateMany({
    where: { orderId: order.id, status: 'ENVIADO' },
    data: { status: 'EN_PREPARACION', version: { increment: 1 } },
  });
  return true;
}

/** POST /api/orders/:id/accept (kds.operate). Idempotente: conserva la primera aceptación. */
export async function acceptOrder(
  prisma: PrismaClient,
  branchId: string,
  orderId: string,
  actor: Actor,
): Promise<{ order: KdsOrder; changed: boolean }> {
  return prisma.$transaction(async (tx) => {
    const order = await orderInBranch(tx, branchId, orderId);
    assertOpen(order.status);
    const changed = await acceptInTx(tx, order, actor, new Date());
    if (changed) await audit(tx, actor, branchId, 'kds.accept', orderId);
    return { order: await loadKds(tx, order.id), changed };
  });
}

/** Si todos los ítems no cancelados están listos, el pedido queda LISTO (Docs/05 paso 7). */
async function readyIfComplete(tx: Tx, orderId: string, now: Date, actor: Actor) {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { status: true } });
  const pending = items.some((i) => i.status === 'ENVIADO' || i.status === 'EN_PREPARACION');
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (pending || order.status !== 'EN_PREPARACION') return false;
  await tx.order.update({
    where: { id: orderId },
    data: {
      status: 'LISTO',
      // Se conserva el primer ready_at aunque haya recall (Docs/05 paso 7)
      readyAt: order.readyAt ?? now,
      readyBy: order.readyBy ?? toDbId(actor.userId),
      version: { increment: 1 },
    },
  });
  return true;
}

/** POST /api/order-items/:id/ready (kds.operate): un ítem listo (tachado en el KDS). */
export async function itemReady(
  prisma: PrismaClient,
  branchId: string,
  itemId: string,
  actor: Actor,
): Promise<{ order: KdsOrder; orderReady: boolean; changed: boolean }> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: toDbId(itemId) },
      include: { order: true },
    });
    if (!item || item.order.branchId !== branchId)
      throw new AppError('NOT_FOUND', 'El ítem no existe');
    assertOpen(item.order.status);
    if (item.status === 'CANCELADO')
      throw new AppError('VALIDATION_ERROR', 'El ítem está cancelado');
    const now = new Date();
    await acceptInTx(tx, item.order, actor, now);
    let changed = false;
    if (item.status === 'ENVIADO' || item.status === 'EN_PREPARACION') {
      await tx.orderItem.update({
        where: { id: item.id },
        data: { status: 'LISTO', readyAt: item.readyAt ?? now, version: { increment: 1 } },
      });
      changed = true;
    }
    const orderReady = await readyIfComplete(tx, item.orderId, now, actor);
    if (changed) await audit(tx, actor, branchId, 'kds.item_ready', toApiId(item.orderId));
    return { order: await loadKds(tx, item.orderId), orderReady, changed };
  });
}

/** POST /api/orders/:id/ready (kds.operate): todo el pedido listo. */
export async function orderReady(
  prisma: PrismaClient,
  branchId: string,
  orderId: string,
  actor: Actor,
): Promise<{ order: KdsOrder; changed: boolean }> {
  return prisma.$transaction(async (tx) => {
    const order = await orderInBranch(tx, branchId, orderId);
    assertOpen(order.status);
    if (order.status === 'LISTO') return { order: await loadKds(tx, order.id), changed: false };
    const now = new Date();
    await acceptInTx(tx, order, actor, now);
    await tx.orderItem.updateMany({
      where: { orderId: order.id, status: { in: ['ENVIADO', 'EN_PREPARACION'] } },
      data: { status: 'LISTO', readyAt: now, version: { increment: 1 } },
    });
    const changed = await readyIfComplete(tx, order.id, now, actor);
    if (changed) await audit(tx, actor, branchId, 'kds.ready', orderId);
    return { order: await loadKds(tx, order.id), changed };
  });
}

/** POST /api/orders/:id/recall (kds.recall): Listo → En preparación (Docs/05 paso 7). */
export async function recallOrder(
  prisma: PrismaClient,
  branchId: string,
  orderId: string,
  actor: Actor,
): Promise<{ order: KdsOrder; changed: boolean }> {
  return prisma.$transaction(async (tx) => {
    const order = await orderInBranch(tx, branchId, orderId);
    if (order.status === 'EN_PREPARACION')
      return { order: await loadKds(tx, order.id), changed: false };
    if (!canOrderTransition(order.status as OrderStatus, 'EN_PREPARACION'))
      throw new AppError('VALIDATION_ERROR', 'Solo se puede regresar un pedido listo', {
        status: order.status,
      });
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'EN_PREPARACION', version: { increment: 1 } },
    });
    // Los ítems vuelven a preparación para poder marcarlos otra vez
    await tx.orderItem.updateMany({
      where: { orderId: order.id, status: 'LISTO' },
      data: { status: 'EN_PREPARACION', version: { increment: 1 } },
    });
    await audit(tx, actor, branchId, 'kds.recall', orderId);
    return { order: await loadKds(tx, order.id), changed: true };
  });
}
