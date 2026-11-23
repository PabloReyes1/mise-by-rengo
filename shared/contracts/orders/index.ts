// Contrato v1 del módulo orders (Docs/08 §2.6 y §3.1, Docs/07 §4.4). Dueño: Pablito. Revisa: Deniscito.
// Las rutas y eventos del KDS (accept, ready, recall) son de kitchen (Deniscito) y van en contracts/kitchen.
import { z } from 'zod';
import { ORDER_STATUSES, PERSISTED_ITEM_STATUSES } from '../../domain/orders/index.js';
import { authorizationSchema } from '../auth/index.js';
import { idSchema, isoDateTimeSchema, moneySchema, versionSchema } from '../common/index.js';

export const orderStatusSchema = z.enum(ORDER_STATUSES);
/** Estados de un ítem enviado. BORRADOR vive solo en el dispositivo y nunca viaja. */
export const orderItemStatusSchema = z.enum(PERSISTED_ITEM_STATUSES);

/** Folio temporal sin conexión: prefijo del dispositivo + 4 dígitos, ej. "M3-0005" (Docs/09 §5, SC-10). */
export const tempFolioSchema = z.string().regex(/^[A-Z]\d{1,2}-\d{4}$/, 'Folio temporal inválido');

/** Nota de un ítem o de una cancelación (máx. 140, Docs/07). */
const noteSchema = z.string().trim().max(140);

// ---------------------------------------------------------------------------
// POST /api/orders — enviar una ronda a cocina (order.create)
// ---------------------------------------------------------------------------

/** Modificador elegido. priceDelta = precio al vender; el servidor lo respeta (Docs/09 §6.3). */
export const sendOrderModifierSchema = z.object({
  modifierId: idSchema,
  priceDelta: moneySchema,
});

export const sendOrderComponentSchema = z.object({
  comboGroupId: idSchema,
  productId: idSchema,
  priceDelta: moneySchema,
  modifiers: z.array(sendOrderModifierSchema).max(20).default([]),
});

export const sendOrderItemSchema = z.object({
  /** ULID generado en el dispositivo */
  id: idSchema,
  /** Una sola cuenta por ítem (RF-103) */
  billId: idSchema,
  productId: idSchema,
  /** Entero en el MVP */
  quantity: z.int().min(1).max(999),
  /** Precio unitario que vio el mesero al vender (Docs/09 §6.3) */
  unitPrice: moneySchema,
  modifiers: z.array(sendOrderModifierSchema).max(20).default([]),
  components: z.array(sendOrderComponentSchema).max(10).default([]),
  note: noteSchema.optional(),
});

export const sendOrderRequestSchema = z.object({
  id: idSchema,
  occupancyId: idSchema,
  /** Solo si se envió sin conexión */
  tempFolio: tempFolioSchema.optional(),
  /** Hora del dispositivo; el servidor la corrige con clockOffsetMs (Docs/09 §4.2) */
  clientSentAt: isoDateTimeSchema,
  items: z.array(sendOrderItemSchema).min(1).max(100),
});
export type SendOrderRequest = z.infer<typeof sendOrderRequestSchema>;

// ---------------------------------------------------------------------------
// Pedido e ítem como los devuelve el servidor
// ---------------------------------------------------------------------------

export const orderItemModifierSchema = z.object({
  modifierId: idSchema,
  name: z.string(),
  priceDelta: moneySchema,
});

export const orderItemComponentSchema = z.object({
  comboGroupId: idSchema,
  productId: idSchema,
  name: z.string(),
  priceDelta: moneySchema,
  modifiers: z.array(orderItemModifierSchema),
});

export const orderItemSchema = z.object({
  id: idSchema,
  orderId: idSchema,
  billId: idSchema,
  productId: idSchema,
  /** product_name_snapshot */
  productName: z.string(),
  quantity: z.int().min(1),
  unitPrice: moneySchema,
  /** Σ modificadores por unidad */
  modifiersTotal: moneySchema,
  /** (unitPrice + modifiersTotal) × quantity */
  lineTotal: moneySchema,
  note: z.string().nullable(),
  status: orderItemStatusSchema,
  modifiers: z.array(orderItemModifierSchema),
  components: z.array(orderItemComponentSchema),
  /** Ítem del que se separó (RF-104) */
  splitFromId: idSchema.nullable(),
  readyAt: isoDateTimeSchema.nullable(),
  cancelledAt: isoDateTimeSchema.nullable(),
  version: versionSchema,
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderSchema = z.object({
  id: idSchema,
  occupancyId: idSchema,
  /** 1, 2, 3… (≥ 2 se imprime "ADICIONAL") */
  roundNumber: z.int().min(1),
  /** Folio definitivo; null mientras no llegue al servidor */
  folio: z.string().nullable(),
  tempFolio: tempFolioSchema.nullable(),
  status: orderStatusSchema,
  sentBy: idSchema,
  sentAt: isoDateTimeSchema,
  acceptedAt: isoDateTimeSchema.nullable(),
  readyAt: isoDateTimeSchema.nullable(),
  deliveredAt: isoDateTimeSchema.nullable(),
  /** Entregado automáticamente al imprimir la pre-cuenta (S-09) */
  deliveredAuto: z.boolean(),
  /** Llegó desde la outbox después de un corte de internet */
  syncedLate: z.boolean(),
  printedAt: isoDateTimeSchema.nullable(),
  items: z.array(orderItemSchema),
  version: versionSchema,
});
export type Order = z.infer<typeof orderSchema>;

/** Respuesta 201 de POST /api/orders */
export const sendOrderResponseSchema = orderSchema;

// ---------------------------------------------------------------------------
// Otras acciones
// ---------------------------------------------------------------------------

/** POST /api/order-items/:id/cancel (order.cancel_sent; 🔑 si no lo tiene) */
export const cancelOrderItemRequestSchema = z.object({
  reasonId: idSchema,
  note: noteSchema.optional(),
  authorization: authorizationSchema.optional(),
});
export type CancelOrderItemRequest = z.infer<typeof cancelOrderItemRequestSchema>;

/** POST /api/orders/:id/printed — el dispositivo confirma que imprimió la comanda */
export const orderPrintedRequestSchema = z.object({
  deviceId: idSchema,
  printerId: idSchema,
});

// POST /api/orders/:id/deliver y POST /api/orders/:id/reprint no llevan cuerpo.

// ---------------------------------------------------------------------------
// Eventos de tiempo real que emite orders (Docs/08 §3.1). El sobre es de realtime.
// ---------------------------------------------------------------------------

/** order.sent → branch:<id>:kds y branch:<id>: pedido completo */
export const orderSentEventSchema = orderSchema;

/** order.delivered → branch:<id> */
export const orderDeliveredEventSchema = z.object({
  id: idSchema,
  deliveredAt: isoDateTimeSchema,
  deliveredAuto: z.boolean(),
});

/** order.item_cancelled → branch:<id>:kds y branch:<id> */
export const orderItemCancelledEventSchema = z.object({
  orderId: idSchema,
  itemId: idSchema,
  reason: z.string(),
  /** Cancelado después de estar listo (merma, Docs/05 §5.4) */
  afterReady: z.boolean(),
});

export const ORDERS_EVENTS = {
  'order.sent': orderSentEventSchema,
  'order.delivered': orderDeliveredEventSchema,
  'order.item_cancelled': orderItemCancelledEventSchema,
} as const;
export type OrdersEventName = keyof typeof ORDERS_EVENTS;
