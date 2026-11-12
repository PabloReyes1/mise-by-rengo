// Verificación del token de acceso y de permisos (ADR-008, Docs/03 §5, Docs/08 §1).
// El login, el PIN, el refresco y el emparejamiento son del módulo auth (H1); aquí solo se verifica.
import type {
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
  preHandlerAsyncHookHandler,
  preHandlerHookHandler,
} from 'fastify';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { AppError } from './errors.js';

/** Datos que lleva el token de acceso (15 min). */
export interface AccessClaims {
  userId: string;
  deviceId: string;
  /** Sucursales asignadas al usuario */
  branchIds: string[];
  /** Unión de los permisos de sus roles (Docs/03 §3) */
  permissions: string[];
}

/** Lo que ve cada ruta en `req.auth` después de `authenticate`. */
export interface AuthContext extends AccessClaims {
  /** Sucursal de la petición (X-Branch-Id), ya validada */
  branchId: string | undefined;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
    /** Usuario que autorizó con su PIN (🔑) esta petición, si hizo falta */
    authorizedBy: string | null;
  }
  interface FastifyInstance {
    /** Lanza DEVICE_REVOKED si el dispositivo fue revocado (lo registra el módulo auth) */
    deviceGuard?: (deviceId: string) => Promise<void>;
  }
}

const ALGORITHM = 'HS256';

const payloadSchema = z.object({
  sub: z.string(),
  did: z.string(),
  brs: z.array(z.string()),
  prm: z.array(z.string()),
});

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  claims: AccessClaims,
  secret: string,
  expiresIn: string,
): Promise<string> {
  return new SignJWT({ did: claims.deviceId, brs: claims.branchIds, prm: claims.permissions })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key(secret));
}

async function verifyAccessToken(token: string, secret: string): Promise<AccessClaims> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: [ALGORITHM] });
    const p = payloadSchema.parse(payload);
    return { userId: p.sub, deviceId: p.did, branchIds: p.brs, permissions: p.prm };
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      throw new AppError('TOKEN_EXPIRED', 'La sesión expiró');
    }
    throw new AppError('UNAUTHENTICATED', 'Sesión no válida');
  }
}

function header(req: FastifyRequest, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** preHandler: exige `Authorization: Bearer` + `X-Device-Id` y valida `X-Branch-Id`. */
export const authenticate: preHandlerAsyncHookHandler = async function (
  req: FastifyRequest,
  _reply: FastifyReply,
) {
  const authorization = header(req, 'authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new AppError('UNAUTHENTICATED', 'Inicia sesión para continuar');
  }
  const claims = await verifyAccessToken(authorization.slice(7), req.server.env.JWT_SECRET);

  if (header(req, 'x-device-id') !== claims.deviceId) {
    throw new AppError('UNAUTHENTICATED', 'Sesión no válida para este dispositivo');
  }
  // Un dispositivo revocado deja de operar de inmediato, sin esperar a que venza el token (RF-035)
  if (req.server.deviceGuard) await req.server.deviceGuard(claims.deviceId);

  const branchId = header(req, 'x-branch-id');
  if (
    branchId !== undefined &&
    !claims.permissions.includes('branch.all') &&
    !claims.branchIds.includes(branchId)
  ) {
    throw new AppError('BRANCH_FORBIDDEN', 'No tienes acceso a esta sucursal');
  }

  req.auth = { ...claims, branchId };
};

/** preHandler: sin el permiso → 403 AUTHORIZATION_REQUIRED (el frontend pide el PIN de otro usuario). */
export function requirePermission(permission: string): preHandlerHookHandler {
  return function (req: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction) {
    if (!req.auth) {
      done(new AppError('UNAUTHENTICATED', 'Inicia sesión para continuar'));
    } else if (!req.auth.permissions.includes(permission)) {
      done(
        new AppError('AUTHORIZATION_REQUIRED', 'Esta acción requiere autorización', { permission }),
      );
    } else {
      done();
    }
  };
}
