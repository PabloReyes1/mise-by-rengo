// Tipos comunes de la API (Docs/08 §1), usados por los contratos de todos los módulos.
import { z } from 'zod';

/** ID en la API: ULID de 26 caracteres (ADR-006). */
export const idSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'ID inválido');

/** Monto como string decimal con 2 cifras ("203.50"), nunca número (Docs/08 §1). */
export const moneySchema = z
  .string()
  .regex(/^\d{1,10}\.\d{2}$/, 'Monto inválido: usa 2 decimales, ej. "64.00"');

/** Fecha y hora en ISO 8601 UTC. */
export const isoDateTimeSchema = z.iso.datetime();

/** Color hex de 6 dígitos (#RRGGBB). */
export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido: usa #RRGGBB');

/** Recurso con control de concurrencia (Docs/08 §1: `version` → 409 STALE_VERSION). */
export const versionSchema = z.number().int().min(0);
