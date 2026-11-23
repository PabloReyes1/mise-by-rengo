// Contrato v1 de cocina / KDS (Docs/08 §2.6, Docs/05 pasos 5 a 8). Dueño: Deniscito.
// Las acciones van por REST (idempotentes); los cambios llegan por tiempo real (order.accepted,
// order.item_ready, order.ready, order.recalled).
import { z } from 'zod';
import { ORDER_STATUSES } from '../../domain/orders/index.js';
import { idSchema } from '../common/index.js';
import { orderSchema } from '../orders/index.js';

/** Estados que muestra el KDS: nuevos, en preparación y listos (Docs/05 paso 5). */
export const KDS_STATUSES = ['ENVIADO', 'EN_PREPARACION', 'LISTO'] as const;

// GET /api/kds/orders?status=ENVIADO,EN_PREPARACION,LISTO (kds.operate)
export const kdsOrdersQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : [...KDS_STATUSES]))
    .pipe(z.array(z.enum(ORDER_STATUSES)).min(1)),
});

/** Pedido como lo ve cocina: el pedido + de qué mesa es y quién lo atiende. */
export const kdsOrderSchema = orderSchema.extend({
  /** "5 · Salón"; null en para llevar */
  table: z.string().nullable(),
  orderTypeCode: z.string(),
  customerName: z.string().nullable(),
  waiterId: idSchema,
  waiterName: z.string(),
  guests: z.int(),
});
export type KdsOrder = z.infer<typeof kdsOrderSchema>;
export const kdsOrdersResponseSchema = z.array(kdsOrderSchema);
