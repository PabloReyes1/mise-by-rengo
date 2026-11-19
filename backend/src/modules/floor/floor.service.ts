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
        include: { currentOccupancy: true },
      },
    },
  });
  const waiterIds = zones.flatMap((z) =>
    z.tables.flatMap((t) => (t.currentOccupancy ? [t.currentOccupancy.waiterId] : [])),
  );
  const names = await waiterNames(prisma, waiterIds);
  return {
    zones: zones.map((z) => ({
      ...toZone(z),
      tables: z.tables
        .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }))
        .map((t): FloorTable => ({
          ...toTable(t),
          occupancy: t.currentOccupancy
            ? {
                id: toApiId(t.currentOccupancy.id),
                waiterId: toApiId(t.currentOccupancy.waiterId),
                waiterName: names.get(t.currentOccupancy.waiterId) ?? '',
                guests: t.currentOccupancy.guests,
                openedAt: t.currentOccupancy.openedAt.toISOString(),
                version: t.currentOccupancy.version,
              }
            : null,
        })),
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
      if (input.waiterId) {
        const waiter = await tx.user.findFirst({
          where: { id: waiterId, active: true, branches: { some: { branchId } } },
        });
        if (!waiter) throw new AppError('VALIDATION_ERROR', 'El mesero no existe en esta sucursal');
      }

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

/** Mesero dueño o con table.view_all (Docs/08 §2.5). */
function assertCanOperate(occupancy: Occupancy, actor: Actor) {
  if (occupancy.waiterId === actor.userId || actor.permissions.includes('table.view_all')) return;
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
