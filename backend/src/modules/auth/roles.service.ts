// Administración de roles y permisos (Docs/03 §2, Docs/08 §2.3; H3 #21). Dueño: Deniscito;
// reasignado a Pablito (doc 17 §3.1). Los permisos son el catálogo del producto (Docs/03 §3);
// el cliente arma sus roles con ellos. Los topes de descuento los fija quien tiene config.discounts (S-05).
import {
  PERMISSION_CODES,
  type CreateRoleRequest,
  type DiscountLimitsRequest,
  type Role,
  type UpdateRoleRequest,
} from '@mise/shared/contracts/auth';
import { AppError } from '../../core/errors.js';
import { toApiId, toDbId } from '../../core/ids.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { recordAudit } from '../audit/index.js';
import {
  assertAdminRemains,
  assertWithinActor,
  type AdminActor,
  type Tx,
} from './users.service.js';

const roleInclude = { permissions: true, _count: { select: { users: true } } } as const;
type RoleRow = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

const money = (d: Prisma.Decimal | null) => (d === null ? null : d.toFixed(2));

function toRole(r: RoleRow): Role {
  return {
    id: toApiId(r.id),
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    permissions: r.permissions.map((p) => p.permissionCode).sort(),
    maxDiscountPct: money(r.maxDiscountPct),
    maxDiscountAmount: money(r.maxDiscountAmount),
    userCount: r._count.users,
  };
}

export async function listRoles(prisma: PrismaClient): Promise<Role[]> {
  const rows = await prisma.role.findMany({ include: roleInclude, orderBy: { name: 'asc' } });
  return rows.map(toRole);
}

/** Solo códigos del catálogo, sin repetir. */
function cleanPermissions(codes: string[]): string[] {
  const unknown = codes.filter((c) => !PERMISSION_CODES.includes(c));
  if (unknown.length > 0)
    throw new AppError('VALIDATION_ERROR', `Permiso desconocido: ${unknown.join(', ')}`, {
      unknown,
    });
  return [...new Set(codes)];
}

/** El nombre no se repite, sin importar mayúsculas. */
async function assertNameFree(tx: Tx, name: string, exceptId?: string) {
  const taken = await tx.role.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (taken && taken.id !== exceptId)
    throw new AppError('ROLE_NAME_TAKEN', `Ya existe un rol llamado "${name}"`);
}

const audit = (
  tx: Tx,
  actor: AdminActor,
  action: string,
  roleId: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
) =>
  recordAudit(tx, {
    action,
    entity: 'role',
    entityId: roleId,
    userId: toDbId(actor.userId),
    deviceId: toDbId(actor.deviceId),
    ip: actor.ip,
    ...(before === undefined ? {} : { before }),
    ...(after === undefined ? {} : { after }),
  });

const snapshot = (r: Role) => ({
  name: r.name,
  description: r.description,
  permissions: r.permissions,
  maxDiscountPct: r.maxDiscountPct,
  maxDiscountAmount: r.maxDiscountAmount,
});

export async function createRole(
  prisma: PrismaClient,
  input: CreateRoleRequest,
  actor: AdminActor,
): Promise<{ role: Role; created: boolean }> {
  const id = toDbId(input.id);
  const existing = await prisma.role.findUnique({ where: { id }, include: roleInclude });
  if (existing) return { role: toRole(existing), created: false };
  const permissions = cleanPermissions(input.permissions);
  const row = await prisma.$transaction(async (tx) => {
    await assertNameFree(tx, input.name);
    await assertWithinActor(tx, actor, { codes: permissions });
    const created = await tx.role.create({
      data: {
        id,
        name: input.name,
        description: input.description ?? '',
        permissions: { create: permissions.map((permissionCode) => ({ permissionCode })) },
      },
      include: roleInclude,
    });
    await audit(tx, actor, 'role.create', input.id, undefined, snapshot(toRole(created)));
    return created;
  });
  return { role: toRole(row), created: true };
}

async function findRole(tx: Tx, id: string) {
  const row = await tx.role.findUnique({ where: { id: toDbId(id) }, include: roleInclude });
  if (!row) throw new AppError('NOT_FOUND', 'Rol no encontrado');
  return row;
}

export async function updateRole(
  prisma: PrismaClient,
  roleId: string,
  input: UpdateRoleRequest,
  actor: AdminActor,
): Promise<Role> {
  const permissions = cleanPermissions(input.permissions);
  return prisma.$transaction(async (tx) => {
    const before = await findRole(tx, roleId);
    if (before.isSystem && input.name !== before.name)
      throw new AppError(
        'VALIDATION_ERROR',
        `El rol ${before.name} es del sistema: no se renombra`,
      );
    await assertNameFree(tx, input.name, before.id);
    await assertWithinActor(tx, actor, { codes: permissions });
    await tx.rolePermission.deleteMany({ where: { roleId: before.id } });
    const after = await tx.role.update({
      where: { id: before.id },
      data: {
        name: input.name,
        description: input.description ?? '',
        permissions: { create: permissions.map((permissionCode) => ({ permissionCode })) },
      },
      include: roleInclude,
    });
    // Quitar config.users o config.roles no puede dejar el sistema sin quien lo administre
    await assertAdminRemains(tx);
    const role = toRole(after);
    await audit(tx, actor, 'role.update', roleId, snapshot(toRole(before)), snapshot(role));
    return role;
  });
}

/** Solo se borra un rol que no es de sistema y que ningún usuario tiene. */
export async function deleteRole(
  prisma: PrismaClient,
  roleId: string,
  actor: AdminActor,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const row = await findRole(tx, roleId);
    if (row.isSystem)
      throw new AppError('VALIDATION_ERROR', `El rol ${row.name} es del sistema: no se borra`);
    if (row._count.users > 0)
      throw new AppError(
        'ROLE_IN_USE',
        `El rol ${row.name} lo tienen ${row._count.users} usuario(s): quítaselo antes de borrarlo`,
        { userCount: row._count.users },
      );
    await tx.role.delete({ where: { id: row.id } });
    await audit(tx, actor, 'role.delete', roleId, snapshot(toRole(row)), undefined);
  });
}

/** S-05: tope de descuento por rol, sin 🔑 (null = sin tope en esa medida). */
export async function setDiscountLimits(
  prisma: PrismaClient,
  roleId: string,
  input: DiscountLimitsRequest,
  actor: AdminActor,
): Promise<Role> {
  return prisma.$transaction(async (tx) => {
    const before = await findRole(tx, roleId);
    const after = await tx.role.update({
      where: { id: before.id },
      data: { maxDiscountPct: input.maxDiscountPct, maxDiscountAmount: input.maxDiscountAmount },
      include: roleInclude,
    });
    await audit(
      tx,
      actor,
      'role.discount_limits',
      roleId,
      {
        maxDiscountPct: money(before.maxDiscountPct),
        maxDiscountAmount: money(before.maxDiscountAmount),
      },
      input,
    );
    return toRole(after);
  });
}
