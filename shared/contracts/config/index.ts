// Contrato v1 del módulo config (Docs/08 §2.1 config/public y §2.3). Dueño: Deniscito.
import { z } from 'zod';
import { hexColorSchema, idSchema } from '../common/index.js';

export const LICENSE_STATUSES = ['ACTIVA', 'GRACIA', 'SOLO_LECTURA', 'SUSPENDIDA'] as const;
export const MODULE_KEYS = ['recipes', 'ai', 'multiBranch', 'advancedReports'] as const;
export const modulesSchema = z.record(z.string(), z.boolean());

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
export const ticketTemplateSchema = z.object({
  docType: docTypeSchema,
  header: z.string().max(500),
  footer: z.string().max(500),
  showLogo: z.boolean(),
  paperWidth: z.union([z.literal(58), z.literal(80)]),
});
export type TicketTemplate = z.infer<typeof ticketTemplateSchema>;
export const updateTicketTemplateSchema = ticketTemplateSchema.omit({ docType: true }).partial();
