// Mesas y ocupaciones (Docs/07 §4.4, Docs/05 paso 2, RF-020, RF-101). Dueño: Pablito.
// Nada se borra: zonas y mesas se desactivan (las ocupaciones viejas las siguen referenciando).
import type {
  BillStatus,
  CreateTable,
  DiningTable,
  FloorResponse,
  FloorTable,
  Occupancy,
  OccupancyStatus,
  OpenOccupancyRequest,
  SaveZone,
  TableShape,
  TableStatus,
  UpdateTable,
  Zone,
} from '@mise/shared/contracts/floor';
import type { AuthContext } from '../../core/auth.js';
import { AppError } from '../../core/errors.js';
import { newDbId, toApiId, toDbId } from '../../core/ids.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { changedFields, recordAudit } from '../audit/index.js';
import { businessDate } from './business-date.js';

type Tx = Prisma.TransactionClient;

export interface Actor {
  userId: string;
  deviceId: string;
  authorizedBy: string | null;
  ip: string;
  permissions: string[];
}

function auditActor(a: Actor, branchId: string) {
  return {
    userId: toDbId(a.userId),
    deviceId: toDbId(a.deviceId),
    authorizedBy: a.authorizedBy ? toDbId(a.authorizedBy) : null,
    branchId,
    ip: a.ip,
  };
}

/**
 * Sucursal de la petición, como uuid de la base: la de `X-Branch-Id` (ya validada por
 * authenticate) o, si no viene, la sucursal donde está emparejado el dispositivo.
 */
export async function requestBranchId(prisma: PrismaClient, auth: AuthContext): Promise<string> {
  if (auth.branchId) return toDbId(auth.branchId);
  const device = await prisma.device.findUnique({
    where: { id: toDbId(auth.deviceId) },
    select: { branchId: true },
  });
  if (!device) throw new AppError('UNAUTHENTICATED', 'Dispositivo no registrado');
  return device.branchId;
}

// ─── Conversión a la API ─────────────────────────────────────────────────────

type ZoneRow = { id: string; name: string; sort: number; active: boolean };

function toZone(z: ZoneRow): Zone {
  return { id: toApiId(z.id), name: z.name, sort: z.sort, active: z.active };
}

type TableRow = Prisma.DiningTableGetPayload<object>;

function toTable(t: TableRow): DiningTable {
  return {
    id: toApiId(t.id),
    zoneId: toApiId(t.zoneId),
    name: t.name,
    capacity: t.capacity,
    shape: t.shape as TableShape,
    posX: t.posX,
    posY: t.posY,
    width: t.width,
    height: t.height,
    status: t.status as TableStatus,
    active: t.active,
    currentOccupancyId: t.currentOccupancyId ? toApiId(t.currentOccupancyId) : null,
    version: t.version,
  };
}

const occupancyInclude = {
  orderType: { select: { code: true } },
  bills: { orderBy: { name: 'asc' } },
  mergedSources: { include: { table: { select: { id: true, name: true } } } },
} satisfies Prisma.OccupancyInclude;

type OccupancyRow = Prisma.OccupancyGetPayload<{ include: typeof occupancyInclude }>;

/** Nombres de los meseros (waiter_id no tiene relación de Prisma: es de otro módulo). */
async function waiterNames(db: PrismaClient | Tx, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((u) => [u.id, u.fullName]));
}

function toOccupancy(o: OccupancyRow, names: Map<string, string>): Occupancy {
  return {
    id: toApiId(o.id),
    branchId: toApiId(o.branchId),
    tableId: o.tableId ? toApiId(o.tableId) : null,
    orderTypeCode: o.orderType.code,
    waiterId: toApiId(o.waiterId),
    waiterName: names.get(o.waiterId) ?? '',
    guests: o.guests,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    status: o.status as OccupancyStatus,
    mergedIntoId: o.mergedIntoId ? toApiId(o.mergedIntoId) : null,
    openedAt: o.openedAt.toISOString(),
    closedAt: o.closedAt?.toISOString() ?? null,
    businessDate: o.businessDate.toISOString().slice(0, 10),
    version: o.version,
    bills: o.bills.map((b) => ({
      id: toApiId(b.id),
      name: b.name,
      status: b.status as BillStatus,
      version: b.version,
    })),
    mergedTables: o.mergedSources
      .flatMap((s) => (s.table ? [{ id: toApiId(s.table.id), name: s.table.name }] : []))
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })),
  };
}

async function loadOccupancy(db: PrismaClient | Tx, dbId: string): Promise<Occupancy | null> {
  const row = await db.occupancy.findUnique({ where: { id: dbId }, include: occupancyInclude });
  if (!row) return null;
  return toOccupancy(row, await waiterNames(db, [row.waiterId]));
}

// ─── Mapa de mesas ───────────────────────────────────────────────────────────

/** Zonas activas con sus mesas activas y el resumen de la ocupación abierta (Docs/08 §2.5). */
export async function getFloor(prisma: PrismaClient, branchId: string): Promise<FloorResponse> {
  const zones = await prisma.zone.findMany({
    where: { branchId, active: true },
    orderBy: [{ sort: 'asc' }, { name: 'asc' }],
    include: {
      tables: {
        where: { active: true },
        orderBy: { name: 'asc' },
        include: {
          currentOccupancy: {
            include: { mergedInto: { include: { table: { select: { id: true, name: true } } } } },
          },
        },
      },
    },
  });
  // En una mesa UNIDA, lo que se muestra es la ocupación de la mesa principal
  const shown = (t: (typeof zones)[number]['tables'][number]) =>
    t.currentOccupancy?.mergedInto ?? t.currentOccupancy;
  const names = await waiterNames(
    prisma,
    zones.flatMap((z) => z.tables.flatMap((t) => (shown(t) ? [shown(t)!.waiterId] : []))),
  );
  // Estado derivado de cada ocupación (Docs/05 §5.1): pedidos en cocina o listos, pre-cuenta
  const occupancyIds = [
    ...new Set(zones.flatMap((z) => z.tables.flatMap((t) => (shown(t) ? [shown(t)!.id] : [])))),
  ];
  const [activeOrders, prechecks] = await Promise.all([
    prisma.order.findMany({
      where: {
        occupancyId: { in: occupancyIds },
        status: { in: ['ENVIADO', 'EN_PREPARACION', 'LISTO'] },
      },
      select: { occupancyId: true, status: true },
    }),
    prisma.bill.findMany({
      where: { occupancyId: { in: occupancyIds }, status: 'PRECUENTA' },
      select: { occupancyId: true },
    }),
  ]);
  const service = (occupancyId: string): FloorTable['service'] => {
    const statuses = activeOrders.filter((o) => o.occupancyId === occupancyId).map((o) => o.status);
    if (statuses.includes('LISTO')) return 'LISTA';
    if (statuses.length > 0) return 'EN_COCINA';
    if (prechecks.some((b) => b.occupancyId === occupancyId)) return 'PRECUENTA';
    return null;
  };
  return {
    zones: zones.map((z) => ({
      ...toZone(z),
      tables: z.tables
        .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }))
        .map((t): FloorTable => {
          const occ = shown(t);
          const main = t.currentOccupancy?.mergedInto?.table;
          return {
            ...toTable(t),
            occupancy: occ
              ? {
                  id: toApiId(occ.id),
                  waiterId: toApiId(occ.waiterId),
                  waiterName: names.get(occ.waiterId) ?? '',
                  guests: occ.guests,
                  openedAt: occ.openedAt.toISOString(),
                  version: occ.version,
                }
              : null,
            joinedTo:
              t.status === 'UNIDA' && main
                ? { tableId: toApiId(main.id), tableName: main.name }
                : null,
            service: occ && t.status === 'OCUPADA' ? service(occ.id) : null,
          };
        }),
    })),
  };
}

// ─── Zonas (config.tables) ───────────────────────────────────────────────────

export async function listZones(prisma: PrismaClient, branchId: string): Promise<Zone[]> {
  const zones = await prisma.zone.findMany({
    where: { branchId },
    orderBy: [{ sort: 'asc' }, { name: 'asc' }],
  });
  return zones.map(toZone);
}

export async function saveZone(
  prisma: PrismaClient,
  branchId: string,
  id: string | null,
  input: SaveZone,
  actor: Actor,
): Promise<Zone> {
  return prisma.$transaction(async (tx) => {
    if (!id) {
      const created = await tx.zone.create({
        data: {
          id: newDbId(),
          branchId,
          name: input.name,
          sort: input.sort ?? (await tx.zone.count({ where: { branchId } })),
          active: input.active ?? true,
        },
      });
      await recordAudit(tx, {
        action: 'config.tables.update',
        entity: 'zone',
        entityId: toApiId(created.id),
        ...auditActor(actor, branchId),
        after: toZone(created),
      });
      return toZone(created);
    }
    const dbId = toDbId(id);
    const current = await tx.zone.findFirst({ where: { id: dbId, branchId } });
    if (!current) throw new AppError('NOT_FOUND', 'La zona no existe');
    if (input.active === false) {
      const busy = await tx.diningTable.count({
        where: { zoneId: dbId, status: { in: ['OCUPADA', 'UNIDA'] } },
      });
      if (busy > 0) {
        throw new AppError('TABLE_OCCUPIED', 'La zona tiene mesas ocupadas: libéralas primero');
      }
    }
    const updated = await tx.zone.update({ where: { id: dbId }, data: input });
    const diff = changedFields(toZone(current), toZone(updated));
    if (diff)
      await recordAudit(tx, {
        action: 'config.tables.update',
        entity: 'zone',
        entityId: id,
        ...auditActor(actor, branchId),
        ...diff,
      });
    return toZone(updated);
  });
}

// ─── Mesas (config.tables) ───────────────────────────────────────────────────

async function zoneInBranch(tx: Tx, zoneId: string, branchId: string) {
  const zone = await tx.zone.findFirst({ where: { id: toDbId(zoneId), branchId } });
  if (!zone) throw new AppError('VALIDATION_ERROR', 'La zona no existe en esta sucursal');
  return zone;
}

/** El nombre de la mesa no se repite en la sucursal (los meseros dicen "la 5", no "la 5 de Terraza"). */
async function assertNameFree(tx: Tx, branchId: string, name: string, exceptId: string | null) {
  const clash = await tx.diningTable.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      active: true,
      zone: { branchId },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
  if (clash) throw new AppError('VALIDATION_ERROR', `Ya existe una mesa llamada ${clash.name}`);
}

export async function createTable(
  prisma: PrismaClient,
  branchId: string,
  input: CreateTable,
  actor: Actor,
): Promise<DiningTable> {
  return prisma.$transaction(async (tx) => {
    const zone = await zoneInBranch(tx, input.zoneId, branchId);
    await assertNameFree(tx, branchId, input.name, null);
    const created = await tx.diningTable.create({
      data: {
        id: newDbId(),
        zoneId: zone.id,
        name: input.name,
        capacity: input.capacity,
        shape: input.shape,
        posX: input.posX ?? null,
        posY: input.posY ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
      },
    });
    await recordAudit(tx, {
      action: 'config.tables.update',
      entity: 'dining_table',
      entityId: toApiId(created.id),
      ...auditActor(actor, branchId),
      after: toTable(created),
    });
    return toTable(created);
  });
}

export async function updateTable(
  prisma: PrismaClient,
  branchId: string,
  id: string,
  input: UpdateTable,
  actor: Actor,
): Promise<DiningTable> {
  return prisma.$transaction(async (tx) => {
    const dbId = toDbId(id);
    const current = await tx.diningTable.findFirst({ where: { id: dbId, zone: { branchId } } });
    if (!current) throw new AppError('NOT_FOUND', 'La mesa no existe');
    if (current.version !== input.version) {
      throw new AppError('STALE_VERSION', 'La mesa cambió mientras la editabas', {
        currentVersion: current.version,
      });
    }

    const { blocked, version: _version, zoneId, ...fields } = input;
    const data: Prisma.DiningTableUncheckedUpdateInput = { ...fields, version: { increment: 1 } };
    if (zoneId) data.zoneId = (await zoneInBranch(tx, zoneId, branchId)).id;
    if (input.name) await assertNameFree(tx, branchId, input.name, dbId);

    const inUse = current.status === 'OCUPADA' || current.status === 'UNIDA';
    if ((blocked !== undefined || input.active === false) && inUse) {
      throw new AppError('TABLE_OCCUPIED', `La mesa ${current.name} está ocupada`, {
        status: current.status,
      });
    }
    if (blocked !== undefined) data.status = blocked ? 'BLOQUEADA' : 'LIBRE';

    const updated = await tx.diningTable.update({ where: { id: dbId }, data });
    const { version: _a, ...before } = toTable(current);
    const { version: _b, ...after } = toTable(updated);
    const diff = changedFields(before, after);
    if (diff)
      await recordAudit(tx, {
        action: 'config.tables.update',
        entity: 'dining_table',
        entityId: id,
        ...auditActor(actor, branchId),
        ...diff,
      });
    return toTable(updated);
  });
}

// ─── Ocupaciones ─────────────────────────────────────────────────────────────

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Abre una mesa o una orden para llevar (Docs/05 paso 2): crea la ocupación ABIERTA y la
 * Cuenta 1, y deja la mesa OCUPADA. Repetir el mismo `id` devuelve la misma ocupación
 * (la outbox puede reenviar, Docs/09 §4.2).
 */
export async function openOccupancy(
  prisma: PrismaClient,
  branchId: string,
  input: OpenOccupancyRequest,
  actor: Actor,
  now: Date = new Date(),
): Promise<{ occupancy: Occupancy; created: boolean }> {
  const id = toDbId(input.id);

  const existing = await loadOccupancy(prisma, id);
  if (existing) {
    if (existing.branchId !== toApiId(branchId) || existing.tableId !== (input.tableId ?? null)) {
      throw new AppError('VALIDATION_ERROR', 'Ese id ya se usó para otra ocupación');
    }
    return { occupancy: existing, created: false };
  }

  try {
    const occupancy = await prisma.$transaction(async (tx) => {
      const orderType = await tx.orderType.findUnique({ where: { code: input.orderTypeCode } });
      if (!orderType?.active) {
        throw new AppError('VALIDATION_ERROR', `El tipo de orden ${input.orderTypeCode} no existe`);
      }
      if (orderType.requiresTable && !input.tableId) {
        throw new AppError('VALIDATION_ERROR', 'Elige una mesa');
      }
      if (!orderType.requiresTable && input.tableId) {
        throw new AppError('VALIDATION_ERROR', `${orderType.name} no lleva mesa`);
      }

      const waiterId = toDbId(input.waiterId ?? actor.userId);
      if (input.waiterId) await activeWaiter(tx, branchId, input.waiterId);

      const [settings, branch] = await Promise.all([
        tx.clientSettings.findFirstOrThrow({
          select: { timezone: true, businessDayCutoff: true },
        }),
        tx.branch.findUniqueOrThrow({ where: { id: branchId }, select: { timezone: true } }),
      ]);
      const deviceId = toDbId(actor.deviceId);

      let tableId: string | null = null;
      if (input.tableId) {
        tableId = toDbId(input.tableId);
        const table = await tx.diningTable.findFirst({
          where: { id: tableId, active: true, zone: { branchId } },
        });
        if (!table) throw new AppError('NOT_FOUND', 'La mesa no existe');
        if (table.status !== 'LIBRE') {
          const message =
            table.status === 'BLOQUEADA'
              ? `La mesa ${table.name} está bloqueada`
              : `La mesa ${table.name} ya está ocupada`;
          throw new AppError('TABLE_OCCUPIED', message, { status: table.status });
        }
      }

      await tx.occupancy.create({
        data: {
          id,
          branchId,
          tableId,
          orderTypeId: orderType.id,
          waiterId,
          guests: input.guests,
          customerName: input.customerName || null,
          customerPhone: input.customerPhone || null,
          ownerDeviceId: deviceId,
          createdDeviceId: deviceId,
          openedAt: now,
          businessDate: new Date(
            businessDate(now, branch.timezone ?? settings.timezone, settings.businessDayCutoff),
          ),
          bills: {
            create: {
              id: input.billId ? toDbId(input.billId) : newDbId(),
              name: 'Cuenta 1',
              ownerDeviceId: deviceId,
              createdDeviceId: deviceId,
            },
          },
        },
      });

      if (tableId) {
        // Solo si sigue LIBRE: si otro la ocupó entre tanto, no se actualiza nada
        const { count } = await tx.diningTable.updateMany({
          where: { id: tableId, status: 'LIBRE' },
          data: { status: 'OCUPADA', currentOccupancyId: id, version: { increment: 1 } },
        });
        if (count === 0) throw new AppError('TABLE_OCCUPIED', 'La mesa ya está ocupada');
      }

      return (await loadOccupancy(tx, id))!;
    });
    return { occupancy, created: true };
  } catch (error) {
    // Dos dispositivos abriendo la misma mesa a la vez: el índice único parcial decide
    if (isUniqueViolation(error)) {
      const again = await loadOccupancy(prisma, id);
      if (again) return { occupancy: again, created: false };
      throw new AppError('TABLE_OCCUPIED', 'La mesa ya está ocupada');
    }
    throw error;
  }
}

export async function listOccupancies(
  prisma: PrismaClient,
  branchId: string,
  status: OccupancyStatus,
): Promise<Occupancy[]> {
  const rows = await prisma.occupancy.findMany({
    where: { branchId, status },
    orderBy: { openedAt: 'asc' },
    include: occupancyInclude,
  });
  const names = await waiterNames(
    prisma,
    rows.map((r) => r.waiterId),
  );
  return rows.map((r) => toOccupancy(r, names));
}

/** Mesero dueño o con table.view_all (Docs/08 §2.5). También lo usa orders. */
export function assertCanOperate(occupancy: { waiterId: string }, actor: Actor) {
  if (occupancy.waiterId === actor.userId || actor.permissions.includes('table.view_all')) return;
  // Un gerente autorizó esta acción con su PIN (🔑): vale también para la mesa ajena (SC-33)
  if (actor.authorizedBy) return;
  throw new AppError('AUTHORIZATION_REQUIRED', 'Esta mesa es de otro mesero', {
    permission: 'table.view_all',
  });
}

export async function getOccupancy(
  prisma: PrismaClient,
  branchId: string,
  id: string,
  actor: Actor,
): Promise<Occupancy> {
  const occupancy = await loadOccupancy(prisma, toDbId(id));
  if (!occupancy || occupancy.branchId !== toApiId(branchId)) {
    throw new AppError('NOT_FOUND', 'La ocupación no existe');
  }
  assertCanOperate(occupancy, actor);
  return occupancy;
}

/** Cambia el número de comensales (PATCH /api/occupancies/:id). */
export async function updateGuests(
  prisma: PrismaClient,
  branchId: string,
  id: string,
  input: { guests: number; version: number },
  actor: Actor,
): Promise<Occupancy> {
  return prisma.$transaction(async (tx) => {
    const dbId = toDbId(id);
    const current = await loadOccupancy(tx, dbId);
    if (!current || current.branchId !== toApiId(branchId)) {
      throw new AppError('NOT_FOUND', 'La ocupación no existe');
    }
    assertCanOperate(current, actor);
    if (current.status !== 'ABIERTA') {
      throw new AppError('VALIDATION_ERROR', 'La ocupación ya está cerrada');
    }
    const { count } = await tx.occupancy.updateMany({
      where: { id: dbId, version: input.version },
      data: { guests: input.guests, version: { increment: 1 } },
    });
    if (count === 0) {
      throw new AppError('STALE_VERSION', 'La mesa cambió mientras la editabas', {
        currentVersion: current.version,
      });
    }
    return (await loadOccupancy(tx, dbId))!;
  });
}

// ─── Unir, trasladar y transferir (RF-105 a RF-107) ──────────────────────────

/** Ocupación ABIERTA de la sucursal que el actor puede operar; si no, el error que toca. */
async function openOccupancyFor(
  tx: Tx,
  branchId: string,
  id: string,
  actor: Actor,
): Promise<Occupancy> {
  const occupancy = await loadOccupancy(tx, toDbId(id));
  if (!occupancy || occupancy.branchId !== toApiId(branchId)) {
    throw new AppError('NOT_FOUND', 'La ocupación no existe');
  }
  assertCanOperate(occupancy, actor);
  if (occupancy.status !== 'ABIERTA') {
    throw new AppError('VALIDATION_ERROR', 'La ocupación ya está cerrada');
  }
  return occupancy;
}

async function activeWaiter(tx: Tx, branchId: string, waiterId: string) {
  const waiter = await tx.user.findFirst({
    where: { id: toDbId(waiterId), active: true, branches: { some: { branchId } } },
    select: { id: true, fullName: true },
  });
  if (!waiter) throw new AppError('VALIDATION_ERROR', 'El mesero no existe en esta sucursal');
  return waiter;
}

/**
 * Une la ocupación `sourceId` (mesa B) a `targetId` (mesa A): las cuentas de B pasan a A con
 * el nombre de su mesa, B queda FUSIONADA y su mesa UNIDA ("Unida a 5"). Los comensales se suman.
 * Cuando exista orders (H2), sus pedidos también pasan a A. Al cerrar A (H3) se liberan sus
 * mesas unidas.
 */
export async function mergeOccupancies(
  prisma: PrismaClient,
  branchId: string,
  targetId: string,
  sourceId: string,
  actor: Actor,
  now: Date = new Date(),
): Promise<Occupancy> {
  if (targetId === sourceId) {
    throw new AppError('VALIDATION_ERROR', 'Elige otra mesa para unir');
  }
  return prisma.$transaction(async (tx) => {
    const target = await openOccupancyFor(tx, branchId, targetId, actor);
    const source = await openOccupancyFor(tx, branchId, sourceId, actor);
    if (!target.tableId || !source.tableId) {
      throw new AppError('VALIDATION_ERROR', 'Solo se unen mesas, no órdenes para llevar');
    }
    const [targetDb, sourceDb] = [toDbId(targetId), toDbId(sourceId)];
    const sourceTable = await tx.diningTable.findUniqueOrThrow({
      where: { id: toDbId(source.tableId) },
    });

    // Cuentas: "Cuenta 1" de la mesa 6 → "Cuenta 1 · Mesa 6"
    for (const bill of source.bills) {
      await tx.bill.update({
        where: { id: toDbId(bill.id) },
        data: {
          occupancyId: targetDb,
          name: `${bill.name} · Mesa ${sourceTable.name}`,
          version: { increment: 1 },
        },
      });
    }
    // Sus pedidos también: la siguiente ronda de A cuenta los de B ("ADICIONAL", SC-49)
    await tx.order.updateMany({
      where: { occupancyId: sourceDb },
      data: { occupancyId: targetDb },
    });
    // Si a B ya le habían unido otras mesas, ahora cuelgan de A (un solo nivel)
    await tx.occupancy.updateMany({
      where: { mergedIntoId: sourceDb },
      data: { mergedIntoId: targetDb },
    });
    await tx.occupancy.update({
      where: { id: sourceDb },
      data: {
        status: 'FUSIONADA',
        mergedIntoId: targetDb,
        closedAt: now,
        version: { increment: 1 },
      },
    });
    await tx.occupancy.update({
      where: { id: targetDb },
      data: { guests: Math.min(99, target.guests + source.guests), version: { increment: 1 } },
    });
    await tx.diningTable.update({
      where: { id: sourceTable.id },
      data: { status: 'UNIDA', version: { increment: 1 } },
    });

    await recordAudit(tx, {
      action: 'table.merge',
      entity: 'occupancy',
      entityId: targetId,
      ...auditActor(actor, branchId),
      after: { sourceOccupancyId: sourceId, sourceTable: sourceTable.name },
    });
    return (await loadOccupancy(tx, targetDb))!;
  });
}

/** Pasa la ocupación a otra mesa libre; la mesa anterior queda LIBRE (RF-106). */
export async function moveOccupancy(
  prisma: PrismaClient,
  branchId: string,
  id: string,
  targetTableId: string,
  actor: Actor,
): Promise<Occupancy> {
  return prisma.$transaction(async (tx) => {
    const occupancy = await openOccupancyFor(tx, branchId, id, actor);
    if (!occupancy.tableId) {
      throw new AppError('VALIDATION_ERROR', 'Una orden para llevar no tiene mesa');
    }
    if (occupancy.tableId === targetTableId) {
      throw new AppError('VALIDATION_ERROR', 'La ocupación ya está en esa mesa');
    }
    const dbId = toDbId(id);
    const fromId = toDbId(occupancy.tableId);
    const toId = toDbId(targetTableId);
    const target = await tx.diningTable.findFirst({
      where: { id: toId, active: true, zone: { branchId } },
    });
    if (!target) throw new AppError('NOT_FOUND', 'La mesa no existe');
    if (target.status !== 'LIBRE') {
      throw new AppError('TABLE_OCCUPIED', `La mesa ${target.name} no está libre`, {
        status: target.status,
      });
    }
    const from = await tx.diningTable.update({
      where: { id: fromId },
      data: { status: 'LIBRE', currentOccupancyId: null, version: { increment: 1 } },
    });
    const { count } = await tx.diningTable.updateMany({
      where: { id: toId, status: 'LIBRE' },
      data: { status: 'OCUPADA', currentOccupancyId: dbId, version: { increment: 1 } },
    });
    if (count === 0) throw new AppError('TABLE_OCCUPIED', `La mesa ${target.name} no está libre`);
    await tx.occupancy.update({
      where: { id: dbId },
      data: { tableId: toId, version: { increment: 1 } },
    });

    // La bitácora conserva la mesa original (RF-106)
    await recordAudit(tx, {
      action: 'table.move',
      entity: 'occupancy',
      entityId: id,
      ...auditActor(actor, branchId),
      before: { tableId: occupancy.tableId, table: from.name },
      after: { tableId: targetTableId, table: target.name },
    });
    return (await loadOccupancy(tx, dbId))!;
  });
}

/** Otro mesero atiende la ocupación y recibe sus avisos de "Listo" (RF-107, HU-030). */
export async function transferOccupancy(
  prisma: PrismaClient,
  branchId: string,
  id: string,
  waiterId: string,
  actor: Actor,
): Promise<Occupancy> {
  return prisma.$transaction(async (tx) => {
    const occupancy = await openOccupancyFor(tx, branchId, id, actor);
    if (occupancy.waiterId === waiterId) return occupancy;
    const waiter = await activeWaiter(tx, branchId, waiterId);
    const dbId = toDbId(id);
    await tx.occupancy.update({
      where: { id: dbId },
      data: { waiterId: waiter.id, version: { increment: 1 } },
    });
    await recordAudit(tx, {
      action: 'table.transfer',
      entity: 'occupancy',
      entityId: id,
      ...auditActor(actor, branchId),
      before: { waiterId: occupancy.waiterId, waiter: occupancy.waiterName },
      after: { waiterId, waiter: waiter.fullName },
    });
    return (await loadOccupancy(tx, dbId))!;
  });
}
