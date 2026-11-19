// Reglas de auth (ADR-008, Docs/03 §5 y §6, RF-030 a RF-035). IDs de la API = ULID; base = uuid.
import type { DeviceType } from '@mise/shared/contracts/auth';
import type { SessionResponse } from '@mise/shared/contracts/auth';
import { signAccessToken } from '../../core/auth.js';
import type { Env } from '../../core/env.js';
import { AppError } from '../../core/errors.js';
import { newDbId, toApiId, toDbId } from '../../core/ids.js';
import { hashToken, numericCode, randomToken, verifySecret } from '../../core/secrets.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { recordAudit } from '../audit/index.js';

/** Token de acceso: 15 min (ADR-008) */
export const ACCESS_TOKEN_TTL = '15m';
const ACCESS_TOKEN_SECONDS = 15 * 60;
/** La sesión vence tras 12 h sin actividad (S-04): cada refresco la extiende */
const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;
/** Código de emparejamiento: 6 dígitos, 10 min (ADR-008) */
const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
/** Bloqueo por intentos (SC-11) */
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

const PREFIX_LETTER: Record<DeviceType, string> = { WAITER: 'M', CASH: 'C', KDS: 'K', ADMIN: 'A' };

export interface RequestMeta {
  ip: string;
}

export interface DeviceRow {
  id: string;
  branchId: string;
  type: string;
}

// ─── Dispositivos ────────────────────────────────────────────────────────────

export async function createPairingCode(
  prisma: PrismaClient,
  {
    branchId,
    createdBy,
    ttlMs = PAIRING_CODE_TTL_MS,
  }: { branchId: string; createdBy?: string; ttlMs?: number },
): Promise<{ code: string; expiresAt: Date }> {
  await prisma.branch.findUniqueOrThrow({ where: { id: branchId } });
  // Un código vigente no puede repetirse (se busca por su hash)
  for (;;) {
    const code = numericCode(6);
    const codeHash = hashToken(code);
    const clash = await prisma.pairingCode.findUnique({ where: { codeHash } });
    if (clash && !clash.usedAt && clash.expiresAt > new Date()) continue;
    if (clash) await prisma.pairingCode.delete({ where: { codeHash } });
    const expiresAt = new Date(Date.now() + ttlMs);
    await prisma.pairingCode.create({
      data: { id: newDbId(), branchId, codeHash, expiresAt, createdBy: createdBy ?? branchId },
    });
    return { code, expiresAt };
  }
}

export async function pairDevice(
  prisma: PrismaClient,
  input: { code: string; name: string; type: DeviceType; platform: string },
  meta: RequestMeta,
) {
  const deviceToken = randomToken();
  const device = await prisma.$transaction(async (tx) => {
    const pairing = await tx.pairingCode.findUnique({ where: { codeHash: hashToken(input.code) } });
    if (!pairing || pairing.usedAt || pairing.expiresAt <= new Date()) {
      throw new AppError('VALIDATION_ERROR', 'El código no es válido o ya venció. Pide uno nuevo.');
    }
    await tx.pairingCode.update({ where: { id: pairing.id }, data: { usedAt: new Date() } });

    const letter = PREFIX_LETTER[input.type];
    const sameType = await tx.device.count({ where: { offlinePrefix: { startsWith: letter } } });
    const created = await tx.device.create({
      data: {
        id: newDbId(),
        branchId: pairing.branchId,
        name: input.name,
        type: input.type,
        deviceTokenHash: hashToken(deviceToken),
        offlinePrefix: `${letter}${sameType + 1}`,
        platform: input.platform.slice(0, 120),
      },
    });
    await recordAudit(tx, {
      action: 'device.paired',
      entity: 'device',
      entityId: toApiId(created.id),
      deviceId: created.id,
      branchId: created.branchId,
      ip: meta.ip,
      after: { name: created.name, type: created.type },
    });
    return created;
  });

  return {
    deviceId: toApiId(device.id),
    deviceToken,
    offlinePrefix: device.offlinePrefix,
    branchId: toApiId(device.branchId),
    type: input.type,
  };
}

/** Verifica X-Device-Id + X-Device-Token. Devuelve el dispositivo (uuid). */
export async function authenticateDevice(
  prisma: PrismaClient,
  deviceId: string | undefined,
  deviceToken: string | undefined,
): Promise<DeviceRow> {
  if (!deviceId || !deviceToken) {
    throw new AppError('UNAUTHENTICATED', 'Este dispositivo no está emparejado');
  }
  let id: string;
  try {
    id = toDbId(deviceId);
  } catch {
    throw new AppError('UNAUTHENTICATED', 'Este dispositivo no está emparejado');
  }
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device || device.deviceTokenHash !== hashToken(deviceToken)) {
    throw new AppError('UNAUTHENTICATED', 'Este dispositivo no está emparejado');
  }
  if (device.revokedAt) throw new AppError('DEVICE_REVOKED', 'Este dispositivo fue dado de baja');
  return device;
}

export async function assertDeviceActive(prisma: PrismaClient, deviceId: string): Promise<void> {
  let id: string;
  try {
    id = toDbId(deviceId);
  } catch {
    throw new AppError('UNAUTHENTICATED', 'Sesión no válida');
  }
  const device = await prisma.device.findUnique({ where: { id }, select: { revokedAt: true } });
  if (!device) throw new AppError('UNAUTHENTICATED', 'Sesión no válida');
  if (device.revokedAt) throw new AppError('DEVICE_REVOKED', 'Este dispositivo fue dado de baja');
}

export async function revokeDevice(
  prisma: PrismaClient,
  deviceId: string,
  by: { userId: string; ip: string },
) {
  const id = toDbId(deviceId);
  await prisma.$transaction(async (tx) => {
    const device = await tx.device.findUnique({ where: { id } });
    if (!device) throw new AppError('NOT_FOUND', 'El dispositivo no existe');
    const now = new Date();
    await tx.device.update({ where: { id }, data: { revokedAt: now } });
    await tx.deviceSession.updateMany({
      where: { deviceId: id, revokedAt: null },
      data: { revokedAt: now },
    });
    await recordAudit(tx, {
      action: 'device.revoked',
      entity: 'device',
      entityId: deviceId,
      userId: toDbId(by.userId),
      branchId: device.branchId,
      ip: by.ip,
    });
  });
}

// ─── Usuarios y sesiones ─────────────────────────────────────────────────────

/** Permisos (unión de sus roles) y sucursales del usuario (todas si tiene branch.all). */
export async function userAccess(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      roles: { include: { role: { include: { permissions: true } } } },
      branches: { include: { branch: true } },
    },
  });
  const permissions = [
    ...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permissionCode))),
  ].sort();
  const branches = permissions.includes('branch.all')
    ? await prisma.branch.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
    : user.branches.map((b) => b.branch).filter((b) => b.active);
  return { user, permissions, branches };
}

function assertNotLocked(user: { active: boolean; lockedUntil: Date | null }) {
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(
      'ACCOUNT_LOCKED',
      'La cuenta está bloqueada por intentos fallidos. Intenta en 15 minutos.',
    );
  }
}

async function registerFailure(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { failedAttempts: { increment: 1 } },
  });
  if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() + LOCK_MS), failedAttempts: 0 },
    });
  }
}

async function openSession(
  prisma: PrismaClient,
  env: Env,
  userId: string,
  device: DeviceRow,
  meta: RequestMeta,
): Promise<SessionResponse> {
  const { user, permissions, branches } = await userAccess(prisma, userId);
  if (!branches.some((b) => b.id === device.branchId)) {
    throw new AppError('BRANCH_FORBIDDEN', 'No tienes acceso a la sucursal de este dispositivo');
  }
  const refreshToken = randomToken();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    }),
    prisma.deviceSession.create({
      data: {
        id: newDbId(),
        deviceId: device.id,
        userId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + SESSION_IDLE_MS),
        ip: meta.ip,
      },
    }),
    prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }),
  ]);
  return buildSession(env, { user, permissions, branches, deviceId: device.id, refreshToken });
}

async function buildSession(
  env: Env,
  s: {
    user: { id: string; fullName: string; username: string };
    permissions: string[];
    branches: { id: string; name: string }[];
    deviceId: string;
    refreshToken: string;
  },
): Promise<SessionResponse> {
  const branchIds = s.branches.map((b) => toApiId(b.id));
  const accessToken = await signAccessToken(
    {
      userId: toApiId(s.user.id),
      deviceId: toApiId(s.deviceId),
      branchIds,
      permissions: s.permissions,
    },
    env.JWT_SECRET,
    ACCESS_TOKEN_TTL,
  );
  return {
    accessToken,
    refreshToken: s.refreshToken,
    expiresIn: ACCESS_TOKEN_SECONDS,
    user: { id: toApiId(s.user.id), fullName: s.user.fullName, username: s.user.username },
    permissions: s.permissions,
    branches: s.branches.map((b) => ({ id: toApiId(b.id), name: b.name })),
  };
}

export async function loginWithPassword(
  prisma: PrismaClient,
  env: Env,
  device: DeviceRow,
  input: { username: string; password: string },
  meta: RequestMeta,
): Promise<SessionResponse> {
  const user = await prisma.user.findUnique({ where: { username: input.username } });
  const fail = async () => {
    if (user) await registerFailure(prisma, user.id);
    await recordAudit(prisma, {
      action: 'auth.login_failed',
      entity: 'user',
      entityId: input.username,
      userId: user?.id ?? null,
      deviceId: device.id,
      branchId: device.branchId,
      ip: meta.ip,
    });
    // No se dice si falló el usuario o la contraseña
    return new AppError('UNAUTHENTICATED', 'Usuario o contraseña incorrectos');
  };
  if (!user || !user.active) throw await fail();
  assertNotLocked(user);
  if (!(await verifySecret(user.passwordHash, input.password))) throw await fail();
  return openSession(prisma, env, user.id, device, meta);
}

export async function loginWithPin(
  prisma: PrismaClient,
  env: Env,
  device: DeviceRow,
  input: { userId: string; pin: string },
  meta: RequestMeta,
): Promise<SessionResponse> {
  const user = await prisma.user.findUnique({ where: { id: toDbId(input.userId) } });
  if (!user || !user.active || !user.pinHash) {
    throw new AppError('PIN_INVALID', 'PIN incorrecto');
  }
  assertNotLocked(user);
  if (!(await verifySecret(user.pinHash, input.pin))) {
    await registerFailure(prisma, user.id);
    await recordAudit(prisma, {
      action: 'auth.pin_failed',
      entity: 'user',
      entityId: input.userId,
      userId: user.id,
      deviceId: device.id,
      branchId: device.branchId,
      ip: meta.ip,
    });
    throw new AppError('PIN_INVALID', 'PIN incorrecto');
  }
  return openSession(prisma, env, user.id, device, meta);
}

/** Usuarios activos con PIN de la sucursal del dispositivo (para elegir antes del PIN, SC-07). */
export async function deviceUsers(prisma: PrismaClient, device: DeviceRow) {
  const users = await prisma.user.findMany({
    where: {
      active: true,
      pinHash: { not: null },
      branches: { some: { branchId: device.branchId } },
    },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true },
  });
  return users.map((u) => ({ id: toApiId(u.id), fullName: u.fullName }));
}

export async function refreshSession(
  prisma: PrismaClient,
  env: Env,
  refreshToken: string,
): Promise<SessionResponse> {
  const session = await prisma.deviceSession.findUnique({
    where: { refreshTokenHash: hashToken(refreshToken) },
    include: { device: true, user: true },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.device.revokedAt ||
    !session.user.active
  ) {
    throw new AppError('UNAUTHENTICATED', 'La sesión terminó. Inicia sesión de nuevo.');
  }
  const next = randomToken();
  await prisma.deviceSession.update({
    where: { id: session.id },
    data: { refreshTokenHash: hashToken(next), expiresAt: new Date(Date.now() + SESSION_IDLE_MS) },
  });
  const { user, permissions, branches } = await userAccess(prisma, session.userId);
  return buildSession(env, {
    user,
    permissions,
    branches,
    deviceId: session.deviceId,
    refreshToken: next,
  });
}

export async function logout(prisma: PrismaClient, refreshToken: string): Promise<void> {
  await prisma.deviceSession.updateMany({
    where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ─── Autorización 🔑 ─────────────────────────────────────────────────────────

/**
 * Valida que `userId` (ULID) pueda autorizar `permission` con su PIN en la sucursal:
 * activo, sin bloqueo, con el permiso y con acceso a la sucursal (Docs/03 §5 regla 3).
 */
export async function verifyAuthorizer(
  prisma: PrismaClient,
  input: { userId: string; pin: string; permission: string; branchId: string | undefined },
): Promise<void> {
  let id: string;
  try {
    id = toDbId(input.userId);
  } catch {
    throw new AppError('PIN_INVALID', 'PIN incorrecto');
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.active || !user.pinHash) throw new AppError('PIN_INVALID', 'PIN incorrecto');
  assertNotLocked(user);
  if (!(await verifySecret(user.pinHash, input.pin))) {
    await registerFailure(prisma, user.id);
    throw new AppError('PIN_INVALID', 'PIN incorrecto');
  }
  const { permissions, branches } = await userAccess(prisma, id);
  if (!permissions.includes(input.permission)) {
    throw new AppError('FORBIDDEN', 'Ese usuario no puede autorizar esta acción', {
      permission: input.permission,
    });
  }
  if (input.branchId && !branches.some((b) => toApiId(b.id) === input.branchId)) {
    throw new AppError('BRANCH_FORBIDDEN', 'Ese usuario no tiene acceso a esta sucursal');
  }
}
