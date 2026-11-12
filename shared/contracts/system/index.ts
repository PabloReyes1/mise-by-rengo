// Contratos del módulo system (Docs/08 §2.1). GET /api/config/public llega con el módulo config (H1).
import { z } from 'zod';

export const healthResponseSchema = z.object({
  /** degraded = la base no respondió en 2 s */
  status: z.enum(['ok', 'degraded']),
  /** Segundos desde que arrancó el proceso */
  uptime: z.number(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const timeResponseSchema = z.object({
  /** Hora del servidor en ISO 8601 UTC, para corregir el reloj del dispositivo */
  now: z.iso.datetime(),
});
export type TimeResponse = z.infer<typeof timeResponseSchema>;
