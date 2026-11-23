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

// ---------------------------------------------------------------------------
// Descuentos (Docs/03 §5 regla 2, Docs/05 §4). H3 #19, reasignado a Deniscito.
// ---------------------------------------------------------------------------

// POST /api/bills/:id/discounts (discount.apply; por encima del tope del rol pide
// discount.apply_unlimited o 🔑). Uno por cuenta y uno por ítem: aplicar otro lo reemplaza.
export const applyDiscountRequestSchema = z.object({
  id: idSchema,
  target: z.enum(['BILL', 'ITEM']),
  itemId: idSchema.optional(),
  kind: z.enum(['PCT', 'AMOUNT']),
  /** Porcentaje ("10.00") o monto ("25.00") */
  value: moneySchema,
  reasonId: idSchema,
  authorization: authorizationSchema.optional(),
});
export type ApplyDiscountRequest = z.infer<typeof applyDiscountRequestSchema>;

export const appliedDiscountSchema = z.object({
  id: idSchema,
  target: z.enum(['BILL', 'ITEM']),
  itemId: idSchema.nullable(),
  kind: z.enum(['PCT', 'AMOUNT']),
  value: moneySchema,
  amount: moneySchema,
  reasonName: z.string(),
});
export type AppliedDiscount = z.infer<typeof appliedDiscountSchema>;

export const billDiscountsResponseSchema = z.object({
  bill: billSchema,
  discounts: z.array(appliedDiscountSchema),
});
export type BillDiscountsResponse = z.infer<typeof billDiscountsResponseSchema>;

// ---------------------------------------------------------------------------
// Reabrir cuentas pagadas en efectivo (Docs/05 paso 14, RF-069). H3 #20, reasignado a Deniscito.
// ---------------------------------------------------------------------------

// POST /api/bills/:id/reopen (bill.reopen o 🔑) — solo en línea
export const reopenBillRequestSchema = z.object({
  reasonId: idSchema,
  note: z.string().trim().max(140).optional(),
  /** Caja con turno abierto donde se registra el reverso; si no viene, la principal */
  cashRegisterId: idSchema.optional(),
  version: versionSchema,
  authorization: authorizationSchema.optional(),
});

/** Cuenta pagada (o reabierta) del día, para la caja. */
export const paidBillSummarySchema = z.object({
  id: idSchema,
  occupancyId: idSchema,
  name: z.string(),
  /** "Mesa 5" o "Para llevar" */
  where: z.string(),
  status: billStatusSchema,
  folio: z.string().nullable(),
  total: moneySchema,
  paidAt: isoDateTimeSchema.nullable(),
  /** Solo se reabre si todos los pagos fueron en efectivo (PA-051) */
  cashOnly: z.boolean(),
  reopenCount: z.int(),
  version: versionSchema,
});
export type PaidBillSummary = z.infer<typeof paidBillSummarySchema>;

// GET /api/bills/today (payment.register): pagadas hoy y reabiertas pendientes de cobrar
export const todayBillsResponseSchema = z.object({
  paid: z.array(paidBillSummarySchema),
  reopened: z.array(paidBillSummarySchema),
});
