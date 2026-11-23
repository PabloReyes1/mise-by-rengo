// Contrato v1 de tiempo real (Docs/08 §3, ADR-004). Dueño: Deniscito.
// Conexión: io("/", { path: "/socket.io", auth: { token, deviceId, lastSeq } }).
// Todos los eventos llegan por el canal "event" con el mismo sobre; las acciones van por REST.
import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from '../common/index.js';

export const REALTIME_PATH = '/socket.io';
/** Canal de Socket.IO por el que llegan todos los eventos */
export const REALTIME_CHANNEL = 'event';

/** Datos del handshake (Docs/08 §3). */
export const realtimeAuthSchema = z.object({
  token: z.string().min(1),
  deviceId: idSchema,
  /** Último seq que vio el dispositivo; sin él no se reenvía nada */
  lastSeq: z.number().int().min(0).optional(),
});
export type RealtimeAuth = z.infer<typeof realtimeAuthSchema>;

/** Sobre de cada evento (Docs/08 §3). `seq` crece por sucursal. */
export const realtimeEnvelopeSchema = z.object({
  seq: z.number().int().min(1),
  event: z.string(),
  at: isoDateTimeSchema,
  branchId: idSchema,
  data: z.unknown(),
});
export type RealtimeEnvelope<T = unknown> = Omit<z.infer<typeof realtimeEnvelopeSchema>, 'data'> & {
  data: T;
};

/** Eventos de Docs/08 §3.1 que ya emite el servidor. */
export const REALTIME_EVENTS = {
  occupancyOpened: 'occupancy.opened',
  occupancyUpdated: 'occupancy.updated',
  occupancyClosed: 'occupancy.closed',
  occupancyMerged: 'occupancy.merged',
  occupancyMoved: 'occupancy.moved',
  occupancyTransferred: 'occupancy.transferred',
  orderSent: 'order.sent',
  orderAccepted: 'order.accepted',
  orderItemReady: 'order.item_ready',
  orderReady: 'order.ready',
  orderRecalled: 'order.recalled',
  orderDelivered: 'order.delivered',
  orderItemCancelled: 'order.item_cancelled',
  billUpdated: 'bill.updated',
  billPaid: 'bill.paid',
  menuProductStatus: 'menu.product_status',
  menuChanged: 'menu.changed',
  /** El lastSeq era muy viejo: recargar todo el estado */
  resyncRequired: 'resync.required',
} as const;
export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

/**
 * Salas (Docs/08 §3): "branch" = toda la sucursal, "kds" y "cash" = dispositivos de cocina y caja
 * de la sucursal, "user:<id>" = los dispositivos de un usuario, "device:<id>" = uno solo.
 */
export type RealtimeRoom = 'branch' | 'kds' | 'cash' | `user:${string}` | `device:${string}`;

/** Máximo de eventos que se reenvían al reconectar; más que esto → resync.required */
export const REPLAY_LIMIT = 5000;
