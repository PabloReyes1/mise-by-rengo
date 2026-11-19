// Contrato v1 del módulo floor: zonas, mesas y ocupaciones (Docs/08 §2.5, Docs/07 §4.4).
// Dueño: Pablito.
import { z } from 'zod';
import { authorizationSchema } from '../auth/index.js';
import { idSchema, isoDateTimeSchema, versionSchema } from '../common/index.js';

// ---------------------------------------------------------------------------
// Estados (Docs/05 §5.1 y §5.2)
// ---------------------------------------------------------------------------

/** Estado guardado de la mesa. "Con pedido en cocina", "Lista" y "Pre-cuenta" se derivan (H2). */
export const TABLE_STATUSES = ['LIBRE', 'OCUPADA', 'UNIDA', 'BLOQUEADA'] as const;
export const tableStatusSchema = z.enum(TABLE_STATUSES);
export type TableStatus = z.infer<typeof tableStatusSchema>;

export const OCCUPANCY_STATUSES = ['ABIERTA', 'CERRADA', 'FUSIONADA', 'CANCELADA'] as const;
export const occupancyStatusSchema = z.enum(OCCUPANCY_STATUSES);
export type OccupancyStatus = z.infer<typeof occupancyStatusSchema>;

/** Estados de la cuenta (Docs/07 bills). No existe ANULADA (PA-012). */
export const BILL_STATUSES = ['ABIERTA', 'PRECUENTA', 'PAGADA', 'ELIMINADA'] as const;
export const billStatusSchema = z.enum(BILL_STATUSES);
export type BillStatus = z.infer<typeof billStatusSchema>;

/** Forma de la mesa en el mapa (SC-26). */
export const TABLE_SHAPES = ['SQUARE', 'ROUND', 'RECTANGLE'] as const;
export const tableShapeSchema = z.enum(TABLE_SHAPES);
export type TableShape = z.infer<typeof tableShapeSchema>;

/** Comensales de una ocupación (Docs/05 paso 2). */
export const guestsSchema = z.int().min(1).max(99);

// ---------------------------------------------------------------------------
// Zonas y mesas (config.tables)
// ---------------------------------------------------------------------------

export const zoneSchema = z.object({
  id: idSchema,
  name: z.string(),
  sort: z.int(),
  active: z.boolean(),
});
export type Zone = z.infer<typeof zoneSchema>;

// POST /api/zones · PUT /api/zones/:id
export const saveZoneSchema = z.object({
  name: z.string().trim().min(1).max(60),
  sort: z.int().min(0).optional(),
  active: z.boolean().optional(),
});
export type SaveZone = z.infer<typeof saveZoneSchema>;

/** Posición y tamaño en el mapa, en unidades de una cuadrícula (RF-020; el editor visual es F2). */
const mapNumber = z.int().min(0).max(10_000);

export const diningTableSchema = z.object({
  id: idSchema,
  zoneId: idSchema,
  name: z.string(),
  capacity: z.int(),
  shape: tableShapeSchema,
  posX: z.int().nullable(),
  posY: z.int().nullable(),
  width: z.int().nullable(),
  height: z.int().nullable(),
  status: tableStatusSchema,
  /** Mesa dada de baja: no se muestra en el mapa ni se puede abrir (SC-27) */
  active: z.boolean(),
  currentOccupancyId: idSchema.nullable(),
  version: versionSchema,
});
export type DiningTable = z.infer<typeof diningTableSchema>;

// POST /api/tables
export const createTableSchema = z.object({
  zoneId: idSchema,
  /** "5", "T2", "Barra 1" */
  name: z.string().trim().min(1).max(20),
  capacity: z.int().min(1).max(99),
  shape: tableShapeSchema.default('SQUARE'),
  posX: mapNumber.nullable().optional(),
  posY: mapNumber.nullable().optional(),
  width: mapNumber.nullable().optional(),
  height: mapNumber.nullable().optional(),
});
export type CreateTable = z.infer<typeof createTableSchema>;

// PUT /api/tables/:id — `blocked` bloquea o desbloquea una mesa libre (Docs/05 §5.1)
export const updateTableSchema = createTableSchema.partial().extend({
  blocked: z.boolean().optional(),
  active: z.boolean().optional(),
  /** Versión leída: si cambió entre tanto → 409 STALE_VERSION */
  version: versionSchema,
});
export type UpdateTable = z.infer<typeof updateTableSchema>;

// ---------------------------------------------------------------------------
// Ocupaciones (abrir mesa y para llevar)
// ---------------------------------------------------------------------------

export const billSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  status: billStatusSchema,
  version: versionSchema,
});
export type BillSummary = z.infer<typeof billSummarySchema>;

export const occupancySchema = z.object({
  id: idSchema,
  branchId: idSchema,
  /** Null en para llevar */
  tableId: idSchema.nullable(),
  /** Código del tipo de orden: MESA, PARA_LLEVAR (catálogo order_types) */
  orderTypeCode: z.string(),
  waiterId: idSchema,
  waiterName: z.string(),
  guests: z.int(),
  customerName: z.string().nullable(),
  customerPhone: z.string().nullable(),
  status: occupancyStatusSchema,
  mergedIntoId: idSchema.nullable(),
  openedAt: isoDateTimeSchema,
  closedAt: isoDateTimeSchema.nullable(),
  /** Día de negocio (zona horaria + hora de corte, ADR-011) */
  businessDate: z.iso.date(),
  version: versionSchema,
  /** Cuentas de la ocupación. Los pedidos se agregan en H2 (orders) */
  bills: z.array(billSummarySchema),
  /** Mesas unidas a esta ocupación (RF-105): "Mesa 5 + 6" */
  mergedTables: z.array(z.object({ id: idSchema, name: z.string() })),
});
export type Occupancy = z.infer<typeof occupancySchema>;

// POST /api/occupancies (table.open) → crea la ocupación y la Cuenta 1 (RF-101)
export const openOccupancyRequestSchema = z.object({
  /** ULID generado por el dispositivo: repetir el mismo id devuelve la misma ocupación */
  id: idSchema,
  /** ULID de la Cuenta 1, del dispositivo, para poder asignarle ítems sin conexión (SC-28) */
  billId: idSchema.optional(),
  /** Obligatoria si el tipo de orden requiere mesa; prohibida si no */
  tableId: idSchema.optional(),
  orderTypeCode: z.string().min(1).max(30),
  guests: guestsSchema,
  /** Por defecto, quien abre */
  waiterId: idSchema.optional(),
  customerName: z.string().trim().max(80).optional(),
  customerPhone: z.string().trim().max(30).optional(),
});
export type OpenOccupancyRequest = z.infer<typeof openOccupancyRequestSchema>;

// GET /api/occupancies?status=ABIERTA
export const listOccupanciesQuerySchema = z.object({
  status: occupancyStatusSchema.default('ABIERTA'),
});
export const occupancyListSchema = z.array(occupancySchema);

// PATCH /api/occupancies/:id (mesero dueño o table.view_all)
export const updateOccupancyRequestSchema = z.object({
  guests: guestsSchema,
  version: versionSchema,
});
export type UpdateOccupancyRequest = z.infer<typeof updateOccupancyRequestSchema>;

// POST /api/occupancies/:id/merge (table.merge) — la ocupación `sourceOccupancyId` se une a :id.
// Sus cuentas pasan a :id y su mesa queda UNIDA (RF-105, HU-029).
export const mergeOccupancyRequestSchema = z.object({
  sourceOccupancyId: idSchema,
  /** 🔑 si quien une no tiene el permiso */
  authorization: authorizationSchema.optional(),
});
export type MergeOccupancyRequest = z.infer<typeof mergeOccupancyRequestSchema>;

// POST /api/occupancies/:id/move (table.move) — pasa la ocupación a otra mesa libre (RF-106)
export const moveOccupancyRequestSchema = z.object({
  targetTableId: idSchema,
  authorization: authorizationSchema.optional(),
});
export type MoveOccupancyRequest = z.infer<typeof moveOccupancyRequestSchema>;

// POST /api/occupancies/:id/transfer (table.transfer_waiter) — otro mesero la atiende (RF-107)
export const transferOccupancyRequestSchema = z.object({
  waiterId: idSchema,
  authorization: authorizationSchema.optional(),
});
export type TransferOccupancyRequest = z.infer<typeof transferOccupancyRequestSchema>;

// ---------------------------------------------------------------------------
// GET /api/floor — mapa de la sucursal
// ---------------------------------------------------------------------------

/** Resumen de la ocupación de una mesa, sin ítems (Docs/08 §2.5). */
export const occupancySummarySchema = occupancySchema.pick({
  id: true,
  waiterId: true,
  waiterName: true,
  guests: true,
  openedAt: true,
  version: true,
});
export type OccupancySummary = z.infer<typeof occupancySummarySchema>;

export const floorTableSchema = diningTableSchema.extend({
  /** La ocupación abierta de la mesa; en una mesa UNIDA, la de la mesa principal */
  occupancy: occupancySummarySchema.nullable(),
  /** Solo en mesas UNIDA: la mesa principal ("Unida a 5") */
  joinedTo: z.object({ tableId: idSchema, tableName: z.string() }).nullable(),
});
export type FloorTable = z.infer<typeof floorTableSchema>;

export const floorResponseSchema = z.object({
  zones: z.array(zoneSchema.extend({ tables: z.array(floorTableSchema) })),
});
export type FloorResponse = z.infer<typeof floorResponseSchema>;

// ---------------------------------------------------------------------------
// Eventos de tiempo real (los emite el backend cuando exista realtime, H2)
// ---------------------------------------------------------------------------

/** Datos de `occupancy.opened` / `.updated` / `.closed` (Docs/08 §3.1, sala `branch`). */
export const occupancyEventSchema = occupancySchema;

export const FLOOR_EVENTS = {
  occupancyOpened: 'occupancy.opened',
  occupancyUpdated: 'occupancy.updated',
  occupancyClosed: 'occupancy.closed',
  occupancyMerged: 'occupancy.merged',
  occupancyMoved: 'occupancy.moved',
  occupancyTransferred: 'occupancy.transferred',
} as const;
