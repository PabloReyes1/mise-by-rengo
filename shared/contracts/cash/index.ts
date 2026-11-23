// Contrato v1 de caja: cajas, turnos y movimientos (Docs/08 §2.8, Docs/07 §4.5, Docs/05 paso 1).
// Dueño: Pablito. Reasignado a Deniscito (doc 17 §3.1, H3 #18).
import { z } from 'zod';
import { authorizationSchema } from '../auth/index.js';
import { idSchema, isoDateTimeSchema, moneySchema } from '../common/index.js';

export const FLOAT_MODES = ['FIJO', 'VARIABLE'] as const;
export const SHIFT_STATUSES = ['ABIERTO', 'EN_CORTE', 'CERRADO_PROVISIONAL', 'CERRADO'] as const;
export const MOVEMENT_TYPES = ['DEPOSITO', 'RETIRO', 'REVERSO_REAPERTURA'] as const;

export const shiftSummarySchema = z.object({
  id: idSchema,
  cashRegisterId: idSchema,
  status: z.enum(SHIFT_STATUSES),
  openedBy: idSchema,
  openedByName: z.string(),
  openedAt: isoDateTimeSchema,
  openingFloat: moneySchema,
  depositsTotal: moneySchema,
  withdrawalsTotal: moneySchema,
  /** Cobros en efectivo del turno (llegan con el cobro, #19) */
  cashSalesTotal: moneySchema,
  /**
   * Efectivo esperado en el cajón. null si el usuario no tiene cash.view_expected: el corte es "a
   * ciegas" (Docs/03 §3)
   */
  expectedCash: moneySchema.nullable(),
});
export type ShiftSummary = z.infer<typeof shiftSummarySchema>;

export const cashRegisterSchema = z.object({
  id: idSchema,
  name: z.string(),
  /** FIJO: el fondo lo pone el sistema; VARIABLE: lo escribe el cajero (PA-024) */
  openingFloatMode: z.enum(FLOAT_MODES),
  openingFloatAmount: moneySchema,
  /** Caja principal: recibe el efectivo que cobran los meseros (PA-052) */
  isMain: z.boolean(),
  active: z.boolean(),
  /** Fondo sugerido para el próximo turno (lo que quedó en el último corte) en cajas VARIABLE */
  suggestedFloat: moneySchema.nullable(),
  openShift: shiftSummarySchema.nullable(),
});
export type CashRegister = z.infer<typeof cashRegisterSchema>;

// GET /api/cash-registers (autenticado)
export const cashRegistersResponseSchema = z.array(cashRegisterSchema);

// POST /api/shifts (cash.open_shift) — solo en línea (PA-042); idempotente por id
export const openShiftRequestSchema = z.object({
  id: idSchema,
  cashRegisterId: idSchema,
  /** En cajas FIJO se ignora: el servidor usa el monto configurado */
  openingFloat: moneySchema,
});

export const cashMovementSchema = z.object({
  id: idSchema,
  shiftId: idSchema,
  type: z.enum(MOVEMENT_TYPES),
  amount: moneySchema,
  reasonId: idSchema.nullable(),
  reasonName: z.string().nullable(),
  note: z.string().nullable(),
  userName: z.string(),
  at: isoDateTimeSchema,
});
export type CashMovement = z.infer<typeof cashMovementSchema>;

// POST /api/shifts/:id/movements (cash.movement; 🔑 si falta) — retiro o depósito, idempotente por id
export const createMovementRequestSchema = z.object({
  id: idSchema,
  type: z.enum(['DEPOSITO', 'RETIRO']),
  amount: moneySchema.refine((a) => Number(a) > 0, 'El monto tiene que ser mayor que cero'),
  reasonId: idSchema,
  note: z.string().trim().max(140).optional(),
  authorization: authorizationSchema.optional(),
});

// GET /api/shifts/:id (cash.open_shift)
export const shiftDetailSchema = shiftSummarySchema.extend({
  movements: z.array(cashMovementSchema),
});
export type ShiftDetail = z.infer<typeof shiftDetailSchema>;
