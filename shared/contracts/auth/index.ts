// Contrato v1 del módulo auth (Docs/08 §2.2, ADR-008). Dueño: Deniscito. Revisa: Pablito.
import { z } from 'zod';
import { idSchema } from '../common/index.js';

export const DEVICE_TYPES = ['WAITER', 'CASH', 'KDS', 'ADMIN'] as const;
export const deviceTypeSchema = z.enum(DEVICE_TYPES);
export type DeviceType = z.infer<typeof deviceTypeSchema>;

/** Cabecera con el token del dispositivo emparejado (SC-01). */
export const DEVICE_TOKEN_HEADER = 'x-device-token';

export const pinSchema = z.string().regex(/^\d{4,6}$/, 'El PIN debe tener de 4 a 6 dígitos');

// POST /api/devices/pairing-codes (config.devices)
export const pairingCodeRequestSchema = z.object({ branchId: idSchema });
export const pairingCodeResponseSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  expiresAt: z.iso.datetime(),
});

// POST /api/devices/pair (código válido)
export const pairDeviceRequestSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos'),
  name: z.string().trim().min(1).max(60),
  type: deviceTypeSchema,
});
export const pairDeviceResponseSchema = z.object({
  deviceId: idSchema,
  deviceToken: z.string().min(32),
  offlinePrefix: z.string(),
  branchId: idSchema,
  type: deviceTypeSchema,
});
export type PairDeviceResponse = z.infer<typeof pairDeviceResponseSchema>;

// POST /api/auth/login (dispositivo)
export const loginRequestSchema = z.object({
  username: z.string().trim().min(1).max(60),
  password: z.string().min(1).max(200),
});

// POST /api/auth/pin (dispositivo)
export const pinLoginRequestSchema = z.object({ userId: idSchema, pin: pinSchema });

// POST /api/auth/refresh y POST /api/auth/logout
export const refreshRequestSchema = z.object({ refreshToken: z.string().min(32) });

export const sessionUserSchema = z.object({
  id: idSchema,
  fullName: z.string(),
  username: z.string(),
});

export const sessionResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Segundos de vida del token de acceso (900 = 15 min) */
  expiresIn: z.number().int().positive(),
  user: sessionUserSchema,
  permissions: z.array(z.string()),
  branches: z.array(z.object({ id: idSchema, name: z.string() })),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

// GET /api/auth/device-users (dispositivo, SC-07): usuarios para elegir antes del PIN
export const deviceUsersResponseSchema = z.array(z.object({ id: idSchema, fullName: z.string() }));

/** Autorización 🔑 en la misma petición (Docs/08 §1): vale para una sola acción. */
export const authorizationSchema = z.object({ userId: idSchema, pin: pinSchema });
export type Authorization = z.infer<typeof authorizationSchema>;
