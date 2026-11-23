// Contrato v1 del módulo auth (Docs/08 §2.2, ADR-008). Dueño: Deniscito. Revisa: Pablito.
import { z } from 'zod';
import { idSchema, isoDateTimeSchema, moneySchema } from '../common/index.js';

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

// GET /api/auth/device-users (dispositivo, SC-07): usuarios para elegir antes del PIN.
// Con `?permission=` solo quienes tienen ese permiso: los que pueden autorizar una 🔑 (SC-40).
export const deviceUsersQuerySchema = z.object({
  permission: z.string().trim().min(1).max(60).optional(),
});
export const deviceUsersResponseSchema = z.array(z.object({ id: idSchema, fullName: z.string() }));

/** Autorización 🔑 en la misma petición (Docs/08 §1): vale para una sola acción. */
export const authorizationSchema = z.object({ userId: idSchema, pin: pinSchema });
export type Authorization = z.infer<typeof authorizationSchema>;

// ---------------------------------------------------------------------------
// Administración de usuarios y roles (Docs/08 §2.3, RF-030, Docs/03; H3 #21)
// ---------------------------------------------------------------------------

/** Contraseña: mínimo 10 caracteres (RNF-001) */
export const passwordSchema = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .max(200);

/** Usuario para entrar: se guarda en minúsculas, sin espacios */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,40}$/, 'Usa de 3 a 40 letras, números, punto o guion, sin espacios');

const fullNameSchema = z.string().trim().min(1, 'Escribe el nombre').max(80);
const emailSchema = z.email('Correo inválido').nullable();

// GET /api/users (config.users)
export const adminUserSchema = z.object({
  id: idSchema,
  fullName: z.string(),
  username: z.string(),
  email: z.string().nullable(),
  active: z.boolean(),
  hasPin: z.boolean(),
  /** Bloqueado por intentos fallidos (se desbloquea al editarlo) */
  locked: z.boolean(),
  roleIds: z.array(idSchema),
  branchIds: z.array(idSchema),
  lastLoginAt: isoDateTimeSchema.nullable(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;
export const usersResponseSchema = z.array(adminUserSchema);

// POST /api/users (config.users) — idempotente por id
export const createUserRequestSchema = z.object({
  id: idSchema,
  fullName: fullNameSchema,
  username: usernameSchema,
  email: emailSchema.optional(),
  password: passwordSchema,
  pin: pinSchema.optional(),
  roleIds: z.array(idSchema).min(1, 'Elige al menos un rol'),
  branchIds: z.array(idSchema).min(1, 'Elige al menos una sucursal'),
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

// PUT /api/users/:id (config.users). Sin password no se cambia; unlock quita el bloqueo por intentos
export const updateUserRequestSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema.optional(),
  active: z.boolean(),
  roleIds: z.array(idSchema).min(1, 'Elige al menos un rol'),
  branchIds: z.array(idSchema).min(1, 'Elige al menos una sucursal'),
  password: passwordSchema.optional(),
  unlock: z.boolean().optional(),
});
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

// POST /api/users/:id/pin (config.users) — null quita el PIN (ya no entra por PIN ni autoriza)
export const setPinRequestSchema = z.object({ pin: pinSchema.nullable() });

// GET /api/roles (config.users o config.roles)
export const roleSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string(),
  /** Roles de la plantilla: no se borran ni se renombran */
  isSystem: z.boolean(),
  permissions: z.array(z.string()),
  maxDiscountPct: moneySchema.nullable(),
  maxDiscountAmount: moneySchema.nullable(),
  userCount: z.int(),
});
export type Role = z.infer<typeof roleSchema>;
export const rolesResponseSchema = z.array(roleSchema);
