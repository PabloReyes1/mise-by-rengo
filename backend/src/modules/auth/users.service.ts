// Administración de usuarios (Docs/08 §2.3, RF-030, RNF-001; H3 #21). Dueño: Deniscito;
// reasignado a Pablito (doc 17 §3.1). Contraseña y PIN con argon2id; nunca salen de aquí.
import type { AdminUser, CreateUserRequest, UpdateUserRequest } from '@mise/shared/contracts/auth';
import { AppError } from '../../core/errors.js';
import { toApiId, toDbId } from '../../core/ids.js';
import { hashSecret } from '../../core/secrets.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { recordAudit } from '../audit/index.js';

export type Tx = Prisma.TransactionClient;

export interface AdminActor {
  userId: string;
  deviceId: string;
  ip: string;
  /** Permisos de quien hace el cambio (los del token) */
  permissions: string[];
  /** Quien autorizó con 🔑, si hizo falta: sus permisos también cuentan */
  authorizedBy?: string | null | undefined;
}

/** Permisos que mantienen viva la administración: siempre debe quedar alguien activo con cada uno */
const ADMIN_PERMISSIONS = ['config.users', 'config.roles'] as const;

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

export async function listUsers(prisma: PrismaClient): Promise<AdminUser[]> {
  const rows = await prisma.user.findMany({
    include: userInclude,
    orderBy: [{ active: 'desc' }, { fullName: 'asc' }],
  });
  return rows.map(toAdminUser);
}

/** Permisos de los roles dados (o de los roles que tiene un usuario). */
async function permissionsOf(tx: Tx, where: { roleIds?: string[]; userId?: string }) {
  const rows = await tx.rolePermission.findMany({
    where: where.userId
      ? { role: { users: { some: { userId: where.userId } } } }
      : { roleId: { in: (where.roleIds ?? []).map(toDbId) } },
    select: { permissionCode: true },
  });
  return new Set(rows.map((r) => r.permissionCode));
}

/**
 * Nadie da ni toca permisos que no tiene (SC-61): el gerente con config.users no puede crear un
 * administrador ni cambiarle la contraseña al administrador. Con 🔑 cuentan los permisos de quien
 * autorizó.
 */
export async function assertWithinActor(
  tx: Tx,
  actor: AdminActor,
  target: { roleIds?: string[]; userId?: string; codes?: string[] },
) {
  const own = new Set(actor.permissions);
  if (actor.authorizedBy)
    for (const p of await permissionsOf(tx, { userId: toDbId(actor.authorizedBy) })) own.add(p);
  const wanted = target.codes ?? [...(await permissionsOf(tx, target))];
  const missing = [...new Set(wanted)].filter((p) => !own.has(p));
  if (missing.length > 0)
    throw new AppError(
      'FORBIDDEN',
      target.userId
        ? 'Ese usuario tiene permisos que tú no tienes: solo lo puede cambiar alguien con esos permisos'
        : 'No puedes dar permisos que tú no tienes',
      { missing: missing.sort() },
    );
}

/** Los roles y sucursales que se asignan tienen que existir. */
async function assertRefs(tx: Tx, roleIds: string[], branchIds: string[]) {
  const roles = await tx.role.count({ where: { id: { in: roleIds.map(toDbId) } } });
  if (roles !== new Set(roleIds).size) throw new AppError('VALIDATION_ERROR', 'Rol inválido');
  const branches = await tx.branch.count({ where: { id: { in: branchIds.map(toDbId) } } });
  if (branches !== new Set(branchIds).size)
    throw new AppError('VALIDATION_ERROR', 'Sucursal inválida');
}

/**
 * Siempre tiene que quedar al menos un usuario activo que pueda administrar usuarios y otro (o el
 * mismo) que pueda administrar roles (Docs/03 §2). Se revisa después de cada cambio de usuario o rol.
 */
export async function assertAdminRemains(tx: Tx) {
  for (const permissionCode of ADMIN_PERMISSIONS) {
    const admins = await tx.user.count({
      where: {
        active: true,
        roles: { some: { role: { permissions: { some: { permissionCode } } } } },
      },
    });
    if (admins === 0)
      throw new AppError(
        'LAST_ADMIN',
        permissionCode === 'config.users'
          ? 'Tiene que quedar al menos un usuario activo que pueda administrar usuarios'
          : 'Tiene que quedar al menos un usuario activo que pueda administrar roles',
        { permission: permissionCode },
      );
  }
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
    await assertWithinActor(tx, actor, { roleIds: input.roleIds });
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
    await assertWithinActor(tx, actor, { userId: id });
    await assertWithinActor(tx, actor, { roleIds: input.roleIds });
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
    await assertWithinActor(tx, actor, { userId: id });
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
