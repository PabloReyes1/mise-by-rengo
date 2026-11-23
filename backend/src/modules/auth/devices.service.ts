// Administración de dispositivos (ADR-008, Docs/08 §2.3; H3 #21). Dueño: Deniscito; reasignado a
// Pablito (doc 17 §3.1). Emparejar y revocar ya existían (auth.service); aquí, la lista y el nombre.
import type { AdminDevice } from '@mise/shared/contracts/auth';
import { AppError } from '../../core/errors.js';
import { toApiId, toDbId } from '../../core/ids.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { recordAudit } from '../audit/index.js';

type Row = Prisma.DeviceGetPayload<object>;

const toAdminDevice = (d: Row, currentId: string): AdminDevice => ({
  id: toApiId(d.id),
  name: d.name,
  type: d.type as AdminDevice['type'],
  platform: d.platform,
  appVersion: d.appVersion,
  lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
  createdAt: d.createdAt.toISOString(),
  revokedAt: d.revokedAt?.toISOString() ?? null,
  current: d.id === currentId,
});

/** La sucursal del dispositivo desde el que se pregunta. */
async function branchOf(prisma: PrismaClient, deviceId: string) {
  const d = await prisma.device.findUnique({ where: { id: deviceId }, select: { branchId: true } });
  if (!d) throw new AppError('NOT_FOUND', 'El dispositivo no existe');
  return d.branchId;
}

/** Activos primero (los que se vieron hace menos), después los revocados. */
export async function listDevices(prisma: PrismaClient, actorDeviceId: string) {
  const current = toDbId(actorDeviceId);
  const rows = await prisma.device.findMany({
    where: { branchId: await branchOf(prisma, current) },
    orderBy: [{ revokedAt: { sort: 'desc', nulls: 'first' } }, { name: 'asc' }],
  });
  return rows.map((d) => toAdminDevice(d, current));
}

export async function renameDevice(
  prisma: PrismaClient,
  deviceId: string,
  name: string,
  actor: { userId: string; deviceId: string; ip: string },
): Promise<AdminDevice> {
  const id = toDbId(deviceId);
  const current = toDbId(actor.deviceId);
  const branchId = await branchOf(prisma, current);
  return prisma.$transaction(async (tx) => {
    const before = await tx.device.findUnique({ where: { id } });
    if (!before || before.branchId !== branchId)
      throw new AppError('NOT_FOUND', 'El dispositivo no existe');
    const after = await tx.device.update({ where: { id }, data: { name } });
    if (before.name !== name)
      await recordAudit(tx, {
        action: 'device.rename',
        entity: 'device',
        entityId: deviceId,
        userId: toDbId(actor.userId),
        deviceId: current,
        branchId,
        ip: actor.ip,
        before: { name: before.name },
        after: { name },
      });
    return toAdminDevice(after, current);
  });
}
