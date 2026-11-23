// Contrato v1 del módulo config (Docs/08 §2.1 config/public y §2.3). Dueño: Deniscito.
import { z } from 'zod';
import { hexColorSchema, idSchema } from '../common/index.js';

export const LICENSE_STATUSES = ['ACTIVA', 'GRACIA', 'SOLO_LECTURA', 'SUSPENDIDA'] as const;
export const MODULE_KEYS = ['recipes', 'ai', 'multiBranch', 'advancedReports'] as const;
export const modulesSchema = z.record(z.string(), z.boolean());

/**
 * Tiempos y sonido del KDS (Docs/07 client_settings.kds_thresholds y kds_sound, SC-54).
 * Arreglo 4 de la demo de H2 (doc 17 §5): el pedido nuevo suena una vez; cada `reminderSec`
 * suena UNA vez el recordatorio con el sonido del estado más crítico (0 = sin recordatorio).
 */
export const kdsSettingsSchema = z
  .object({
    /** Minutos desde el envío para "Por vencer" */
    warnMin: z.number().int().min(1).max(120),
    /** Minutos desde el envío para "Atrasado" */
    lateMin: z.number().int().min(2).max(240),
    /** Cada cuántos segundos se recuerda lo pendiente; 0 = nunca */
    reminderSec: z.number().int().min(0).max(3600),
    /** Volumen de 0 a 1 */
    volume: z.number().min(0).max(1),
  })
  .refine((k) => k.lateMin > k.warnMin, {
    message: '"Atrasado" tiene que ser después de "Por vencer"',
    path: ['lateMin'],
  });
export type KdsSettings = z.infer<typeof kdsSettingsSchema>;

// GET /api/config/public (público): lo que la PWA necesita antes de iniciar sesión
export const publicConfigSchema = z.object({
  tradeName: z.string(),
  logoUrl: z.string().nullable(),
  themeId: z.string(),
  colorPrimaryOverride: hexColorSchema.nullable(),
  locale: z.string(),
  currency: z.string().length(3),
  currencySymbol: z.string(),
  decimals: z.number().int().min(0).max(4),
  timeZone: z.string(),
  uiTexts: z.record(z.string(), z.string()),
  modules: modulesSchema,
  licenseStatus: z.enum(LICENSE_STATUSES),
  settingsVersion: z.number().int(),
  minFrontendVersion: z.string(),
  /** El KDS lo lee sin permisos de configuración */
  kds: kdsSettingsSchema,
  /** Propina para el cobro (S-10): sugerida y, si editable, se cambia al cobrar */
  tips: z.object({
    enabled: z.boolean(),
    suggestedPct: z.string().nullable(),
    editable: z.boolean(),
    appliesTakeaway: z.boolean(),
  }),
});
export type PublicConfig = z.infer<typeof publicConfigSchema>;

// GET/PUT /api/config/settings (config.restaurant) — campos de H1; los demás llegan con su módulo
export const settingsSchema = z.object({
  legalName: z.string().max(200),
  tradeName: z.string().trim().min(1).max(120),
  nit: z.string().max(20),
  locale: z.string().min(2).max(20),
  currencyCode: z.string().length(3),
  currencySymbol: z.string().min(1).max(5),
  decimals: z.number().int().min(0).max(4),
  timezone: z.string().min(1),
  /** Hora de corte del día de negocio, HH:MM (ADR-011) */
  businessDayCutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  themeId: z.string().min(1),
  colorPrimaryOverride: hexColorSchema.nullable(),
  kds: kdsSettingsSchema,
  settingsVersion: z.number().int(),
});
export type Settings = z.infer<typeof settingsSchema>;
export const updateSettingsSchema = settingsSchema
  .omit({ settingsVersion: true })
  .partial()
  .extend({
    /** Versión leída: si cambió entre tanto → 409 STALE_VERSION */
    settingsVersion: z.number().int(),
  });

// GET /api/license (config.restaurant)
export const licenseSchema = z.object({
  plan: z.string(),
  /** Estado efectivo: calculado con valid_until y grace_days (RF-256) */
  status: z.enum(LICENSE_STATUSES),
  modules: modulesSchema,
  limits: z.record(z.string(), z.number()),
  validUntil: z.iso.date().nullable(),
  graceDays: z.number().int(),
  /** Días que faltan para vencer (aviso desde 15 días antes, S-32) */
  daysLeft: z.number().int().nullable(),
});
export type License = z.infer<typeof licenseSchema>;

// /api/branches (config.restaurant)
export const branchSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(80),
  address: z.string().max(200),
  phone: z.string().max(30),
  timezone: z.string().nullable(),
  folioPrefix: z.string().regex(/^[A-Z0-9]{0,3}$/, 'Hasta 3 letras o números en mayúscula'),
  active: z.boolean(),
});
export type Branch = z.infer<typeof branchSchema>;
export const createBranchSchema = branchSchema.omit({ id: true });
export const updateBranchSchema = createBranchSchema.partial();

// /api/branches/:id/ticket-templates/:docType (config.restaurant)
export const DOC_TYPES = ['COMANDA', 'PRECUENTA', 'RECIBO', 'CORTE', 'MOVIMIENTO'] as const;
export const docTypeSchema = z.enum(DOC_TYPES);
export type DocType = z.infer<typeof docTypeSchema>;
export const ticketTemplateSchema = z.object({
  docType: docTypeSchema,
  header: z.string().max(500),
  footer: z.string().max(500),
  showLogo: z.boolean(),
  paperWidth: z.union([z.literal(58), z.literal(80)]),
});
export type TicketTemplate = z.infer<typeof ticketTemplateSchema>;
export const updateTicketTemplateSchema = ticketTemplateSchema.omit({ docType: true }).partial();

// GET /api/reasons?type= (cualquier usuario con sesión): motivos activos para elegir al cancelar
// un ítem, reabrir una cuenta, etc. Con ?all=true (config.payments o config.discounts) trae también
// los inactivos para administrarlos (H3 #21).
export const REASON_TYPES = [
  'CANCEL_ITEM',
  'REOPEN_BILL',
  'DISCOUNT',
  'CASH_WITHDRAWAL',
  'CASH_DEPOSIT',
  'CONFLICT',
] as const;
export const reasonTypeSchema = z.enum(REASON_TYPES);
export type ReasonType = z.infer<typeof reasonTypeSchema>;
export const reasonSchema = z.object({
  id: idSchema,
  type: reasonTypeSchema,
  name: z.string(),
  sort: z.number().int(),
});
export type Reason = z.infer<typeof reasonSchema>;
export const listReasonsQuerySchema = z.object({
  type: reasonTypeSchema.optional(),
  all: z.enum(['true', 'false']).optional(),
});
export const reasonAdminSchema = reasonSchema.extend({ active: z.boolean() });
export type ReasonAdmin = z.infer<typeof reasonAdminSchema>;

const reasonNameSchema = z.string().trim().min(1, 'Escribe el motivo').max(80);

// POST /api/reasons (config.payments; los de DISCOUNT también con config.discounts) — idempotente por id
export const createReasonRequestSchema = z.object({
  id: idSchema,
  type: reasonTypeSchema,
  name: reasonNameSchema,
  sort: z.number().int().min(0).max(999).optional(),
});
export type CreateReasonRequest = z.infer<typeof createReasonRequestSchema>;

// PUT /api/reasons/:id. El tipo no cambia; nunca se queda un tipo sin motivos activos
export const updateReasonRequestSchema = z.object({
  name: reasonNameSchema,
  active: z.boolean(),
  sort: z.number().int().min(0).max(999),
});
export type UpdateReasonRequest = z.infer<typeof updateReasonRequestSchema>;
