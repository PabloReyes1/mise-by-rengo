// Administración de usuarios (Docs/08 §2.3, RF-030, RNF-001; H3 #21). Dueño: Deniscito;
// reasignado a Pablito (doc 17 §3.1). Contraseña y PIN con argon2id; nunca salen de aquí.
import type {
  AdminUser,
  CreateUserRequest,
  Role,
  UpdateUserRequest,
} from '@mise/shared/contracts/auth';
import { AppError } from '../../core/errors.js';
import { toApiId, toDbId } from '../../core/ids.js';
import { hashSecret } from '../../core/secrets.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { recordAudit } from '../audit/index.js';

type Tx = Prisma.TransactionClient;

export interface AdminActor {
  userId: string;
  deviceId: string;
  ip: string;
}

/** Permiso que mantiene viva la administración: siempre debe quedar alguien activo con él */
const ADMIN_PERMISSION = 'config.users';

const userInclude = { roles: true, branches: true } as const;
type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

function toAdminUser(u: UserRow): AdminUser {
  return {
    id: toApiId(u.id),
    fullName: u.fullName,
    username: u.username,
    email: u.email,
    active: u.active,
    hasPin: u.pinHash !== null,
    locked: u.lockedUntil !== null && u.lockedUntil > new Date(),
    roleIds: u.roles.map((r) => toApiId(r.roleId)),
    branchIds: u.branches.map((b) => toApiId(b.branchId)),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  };
}

const money = (d: Prisma.Decimal | null) => (d === null ? null : d.toFixed(2));

export async function listUsers(prisma: PrismaClient): Promise<AdminUser[]> {
  const rows = await prisma.user.findMany({
    include: userInclude,
    orderBy: [{ active: 'desc' }, { fullName: 'asc' }],
  });
  return rows.map(toAdminUser);
}

export async function listRoles(prisma: PrismaClient): Promise<Role[]> {
  const rows = await prisma.role.findMany({
    include: { permissions: true, _count: { select: { users: true } } },
    orderBy: { name: 'asc' },
  });
  return rows.map((r) => ({
    id: toApiId(r.id),
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    permissions: r.permissions.map((p) => p.permissionCode).sort(),
    maxDiscountPct: money(r.maxDiscountPct),
    maxDiscountAmount: money(r.maxDiscountAmount),
    userCount: r._count.users,
  }));
}

/** Los roles y sucursales que se asignan tienen que existir. */
async function assertRefs(tx: Tx, roleIds: string[], branchIds: string[]) {
  const roles = await tx.role.count({ where: { id: { in: roleIds.map(toDbId) } } });
  if (roles !== new Set(roleIds).size) throw new AppError('VALIDATION_ERROR', 'Rol inválido');
  const branches = await tx.branch.count({ where: { id: { in: branchIds.map(toDbId) } } });
  if (branches !== new Set(branchIds).size)
    throw new AppError('VALIDATION_ERROR', 'Sucursal inválida');
}

/** Siempre tiene que quedar al menos un usuario activo que pueda administrar usuarios. */
async function assertAdminRemains(tx: Tx) {
  const admins = await tx.user.count({
    where: {
      active: true,
      roles: { some: { role: { permissions: { some: { permissionCode: ADMIN_PERMISSION } } } } },
    },
  });
  if (admins === 0)
    throw new AppError(
      'LAST_ADMIN',
      'Tiene que quedar al menos un usuario activo que pueda administrar usuarios',
    );
}

async function assertUsernameFree(tx: Tx, username: string, exceptId?: string) {
  const taken = await tx.user.findUnique({ where: { username }, select: { id: true } });
  if (taken && taken.id !== exceptId)
    throw new AppError('USERNAME_TAKEN', `El usuario "${username}" ya existe`);
}

export async function createUser(
  prisma: PrismaClient,
  input: CreateUserRequest,
  actor: AdminActor,
): Promise<{ user: AdminUser; created: boolean }> {
  const id = toDbId(input.id);
  const existing = await prisma.user.findUnique({ where: { id }, include: userInclude });
  if (existing) return { user: toAdminUser(existing), created: false };
  const passwordHash = await hashSecret(input.password);
  const pinHash = input.pin ? await hashSecret(input.pin) : null;
  const row = await prisma.$transaction(async (tx) => {
    await assertUsernameFree(tx, input.username);
    await assertRefs(tx, input.roleIds, input.branchIds);
    const created = await tx.user.create({
      data: {
        id,
        fullName: input.fullName,
        username: input.username,
        email: input.email ?? null,
        passwordHash,
        pinHash,
        pinSetAt: pinHash ? new Date() : null,
        roles: { create: input.roleIds.map((r) => ({ roleId: toDbId(r) })) },
        branches: { create: input.branchIds.map((b) => ({ branchId: toDbId(b) })) },
      },
      include: userInclude,
    });
    await recordAudit(tx, {
      action: 'user.create',
      entity: 'user',
      entityId: input.id,
      userId: toDbId(actor.userId),
      deviceId: toDbId(actor.deviceId),
      ip: actor.ip,
      after: {
        username: input.username,
        fullName: input.fullName,
        roleIds: input.roleIds,
        branchIds: input.branchIds,
        hasPin: pinHash !== null,
      },
    });
    return created;
  });
  return { user: toAdminUser(row), created: true };
}

export async function updateUser(
  prisma: PrismaClient,
  userId: string,
  input: UpdateUserRequest,
  actor: AdminActor,
): Promise<AdminUser> {
  const id = toDbId(userId);
  if (userId === actor.userId && !input.active)
    throw new AppError('VALIDATION_ERROR', 'No puedes desactivar tu propio usuario');
  const passwordHash = input.password ? await hashSecret(input.password) : null;
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id }, include: userInclude });
    if (!before) throw new AppError('NOT_FOUND', 'Usuario no encontrado');
    await assertRefs(tx, input.roleIds, input.branchIds);
    await tx.userRole.deleteMany({ where: { userId: id } });
    await tx.userBranch.deleteMany({ where: { userId: id } });
    const after = await tx.user.update({
      where: { id },
      data: {
        fullName: input.fullName,
        email: input.email === undefined ? before.email : input.email,
        active: input.active,
        ...(passwordHash ? { passwordHash } : {}),
        // Cambiar la contraseña o pedir desbloqueo quita el bloqueo por intentos
        ...(passwordHash || input.unlock ? { failedAttempts: 0, lockedUntil: null } : {}),
        roles: { create: input.roleIds.map((r) => ({ roleId: toDbId(r) })) },
        branches: { create: input.branchIds.map((b) => ({ branchId: toDbId(b) })) },
      },
      include: userInclude,
    });
    await assertAdminRemains(tx);
    // Desactivado o con contraseña nueva: se cierran sus sesiones (el token de acceso vence en 15 min)
    if (!input.active || passwordHash) {
      await tx.deviceSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    const was = toAdminUser(before);
    const now = toAdminUser(after);
    await recordAudit(tx, {
      action: 'user.update',
      entity: 'user',
      entityId: userId,
      userId: toDbId(actor.userId),
      deviceId: toDbId(actor.deviceId),
      ip: actor.ip,
      before: {
        fullName: was.fullName,
        email: was.email,
        active: was.active,
        roleIds: was.roleIds,
        branchIds: was.branchIds,
      },
      after: {
        fullName: now.fullName,
        email: now.email,
        active: now.active,
        roleIds: now.roleIds,
        branchIds: now.branchIds,
        passwordChanged: passwordHash !== null,
        unlocked: Boolean(input.unlock),
      },
    });
    return now;
  });
}

export async function setUserPin(
  prisma: PrismaClient,
  userId: string,
  pin: string | null,
  actor: AdminActor,
): Promise<AdminUser> {
  const id = toDbId(userId);
  const pinHash = pin ? await hashSecret(pin) : null;
  return prisma.$transaction(async (tx) => {
    const exists = await tx.user.count({ where: { id } });
    if (!exists) throw new AppError('NOT_FOUND', 'Usuario no encontrado');
    const row = await tx.user.update({
      where: { id },
      data: { pinHash, pinSetAt: pinHash ? new Date() : null },
      include: userInclude,
    });
    await recordAudit(tx, {
      action: pin ? 'user.pin_set' : 'user.pin_removed',
      entity: 'user',
      entityId: userId,
      userId: toDbId(actor.userId),
      deviceId: toDbId(actor.deviceId),
      ip: actor.ip,
    });
    return toAdminUser(row);
  });
}
