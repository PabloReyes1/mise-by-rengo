// Contrato v1 del módulo billing, parte de sala (Docs/08 §2.7, Docs/07 §4.4). Dueño: Pablito.
// Descuentos, pre-cuenta, cobro y reapertura llegan en H3.
import { z } from 'zod';
import { authorizationSchema } from '../auth/index.js';
import { idSchema, isoDateTimeSchema, moneySchema, versionSchema } from '../common/index.js';
import { billStatusSchema } from '../floor/index.js';
import { orderItemSchema } from '../orders/index.js';

/** Cuenta con sus totales, calculados siempre por el servidor. */
export const billSchema = z.object({
  id: idSchema,
  occupancyId: idSchema,
  name: z.string(),
  status: billStatusSchema,
  /** Folio de recibo, al cobrar (H3) */
  folio: z.string().nullable(),
  subtotal: moneySchema,
  discountTotal: moneySchema,
  tipAmount: moneySchema,
  total: moneySchema,
  customerNit: z.string().nullable(),
  customerTaxName: z.string().nullable(),
  version: versionSchema,
});
export type Bill = z.infer<typeof billSchema>;

const billNameSchema = z.string().trim().min(1).max(40);

// GET /api/occupancies/:id/bills — cuentas de la mesa con sus totales (SC-50)
export const occupancyBillsResponseSchema = z.array(billSchema);

// POST /api/occupancies/:id/bills (bill.split) — crea una cuenta; idempotente por id
export const createBillRequestSchema = z.object({
  /** ULID del dispositivo */
  id: idSchema,
  name: billNameSchema,
  authorization: authorizationSchema.optional(),
});
export type CreateBillRequest = z.infer<typeof createBillRequestSchema>;

// PATCH /api/bills/:id (bill.split) — nombre y datos fiscales (NIT o CF)
export const updateBillRequestSchema = z.object({
  name: billNameSchema.optional(),
  customerNit: z.string().trim().max(20).nullable().optional(),
  customerTaxName: z.string().trim().max(120).nullable().optional(),
  version: versionSchema,
  authorization: authorizationSchema.optional(),
});
export type UpdateBillRequest = z.infer<typeof updateBillRequestSchema>;

// POST /api/bills/move-items (bill.split) — pasa ítems a otra cuenta de la misma mesa (RF-102)
export const moveBillItemsRequestSchema = z.object({
  itemIds: z.array(idSchema).min(1).max(100),
  targetBillId: idSchema,
  /** Versión de cada ítem que vio el dispositivo: { [itemId]: version } → 409 STALE_VERSION (SC-50) */
  versions: z.record(idSchema, versionSchema),
  authorization: authorizationSchema.optional(),
});
export type MoveBillItemsRequest = z.infer<typeof moveBillItemsRequestSchema>;

/** Respuesta de mover: las cuentas que cambiaron (origen y destino) con sus totales nuevos */
export const moveBillItemsResponseSchema = z.object({ bills: z.array(billSchema) });

// POST /api/order-items/:id/split (bill.split) — separa unidades en un ítem nuevo (RF-104)
export const splitOrderItemRequestSchema = z.object({
  /** ULID del dispositivo para el ítem nuevo */
  newItemId: idSchema,
  /** Unidades que pasan al ítem nuevo; menos que la cantidad del ítem */
  quantity: z.int().min(1).max(998),
  /** Si viene, el ítem nuevo nace en esa cuenta */
  targetBillId: idSchema.optional(),
  version: versionSchema,
  authorization: authorizationSchema.optional(),
});
export type SplitOrderItemRequest = z.infer<typeof splitOrderItemRequestSchema>;

/** Respuesta de separar: el ítem original (con menos unidades) y el nuevo */
export const splitOrderItemResponseSchema = z.object({
  original: orderItemSchema,
  created: orderItemSchema,
});

// POST /api/bills/:id/precheck (bill.print_precheck; reimprimir pide bill.reprint o 🔑)
// La cuenta pasa a PRECUENTA y los pedidos listos de esa cuenta se marcan entregados (S-09).
// Devuelve lo necesario para imprimir la pre-cuenta (Docs/11 §4.2). Reasignado a Deniscito.
export const precheckRequestSchema = z.object({
  authorization: authorizationSchema.optional(),
});
export const precheckResponseSchema = z.object({
  bill: billSchema,
  /** Ítems no cancelados de la cuenta */
  items: z.array(orderItemSchema),
  /** Porcentaje de propina sugerida, o null si no aplica (propinas apagadas o para llevar) */
  tipPct: z.string().nullable(),
  /** Propina sugerida sobre el total (después de descuentos) */
  tipAmount: moneySchema,
  totalWithTip: moneySchema,
  /** true si ya se había impreso (reimpresión) */
  reprint: z.boolean(),
});
export type PrecheckResponse = z.infer<typeof precheckResponseSchema>;

// ---------------------------------------------------------------------------
// Cobro (Docs/05 pasos 11 y 12, Docs/08 §2.7). H3 #19, reasignado a Deniscito (doc 17 §3.1).
// ---------------------------------------------------------------------------

export const PAYMENT_KINDS = ['CASH', 'CARD', 'TRANSFER', 'OTHER'] as const;

// GET /api/payment-methods (autenticado): métodos activos para cobrar
export const paymentMethodSchema = z.object({
  id: idSchema,
  name: z.string(),
  kind: z.enum(PAYMENT_KINDS),
  givesChange: z.boolean(),
  requiresReference: z.boolean(),
});
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

// POST /api/bills/:id/pay (payment.register)
export const payBillRequestSchema = z.object({
  /** Propina elegida (sugerida y editable, S-10); 0 si no hay */
  tipAmount: moneySchema,
  payments: z
    .array(
      z.object({
        /** ULID del dispositivo: repetir el cobro con los mismos ids no lo duplica */
        id: idSchema,
        methodId: idSchema,
        /** Lo que se aplica a la cuenta */
        amount: moneySchema,
        /** Lo que entregó el cliente (efectivo): el cambio es tendered − amount */
        tendered: moneySchema.optional(),
        reference: z.string().trim().max(60).optional(),
      }),
    )
    .min(1)
    .max(10),
  /** Caja que cobra; si no viene (mesero), el efectivo va a la caja principal (PA-052) */
  cashRegisterId: idSchema.optional(),
  /** NIT o "CF" para el recibo (no es factura, PA-002) */
  customerNit: z.string().trim().max(20).optional(),
  customerTaxName: z.string().trim().max(120).optional(),
  version: versionSchema,
  authorization: authorizationSchema.optional(),
});
export type PayBillRequest = z.infer<typeof payBillRequestSchema>;

export const receiptPaymentSchema = z.object({
  id: idSchema,
  methodName: z.string(),
  kind: z.enum(PAYMENT_KINDS),
  amount: moneySchema,
  tendered: moneySchema.nullable(),
  change: moneySchema,
  reference: z.string().nullable(),
});

/** Lo que vuelve al cobrar: la cuenta pagada y lo necesario para el recibo (Docs/11 §4.3). */
export const receiptSchema = z.object({
  bill: billSchema,
  items: z.array(orderItemSchema),
  payments: z.array(receiptPaymentSchema),
  totalPaid: moneySchema,
  change: moneySchema,
  paidAt: isoDateTimeSchema,
  receivedByName: z.string(),
  /** true si con este cobro se cerró la mesa (todas sus cuentas pagadas, Docs/05 paso 12) */
  occupancyClosed: z.boolean(),
});
export type Receipt = z.infer<typeof receiptSchema>;
