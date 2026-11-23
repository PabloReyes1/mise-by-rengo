// Configuración del cliente, sucursales y plantillas de ticket (Docs/07 §4.1, RF-001 a RF-004).
import type {
  Branch,
  CreateReasonRequest,
  KdsSettings,
  Reason,
  ReasonAdmin,
  ReasonType,
  UpdateReasonRequest,
  Settings,
  TicketTemplate,
} from '@mise/shared/contracts/config';
import { THEMES, themeById, validatePrimaryOverride } from '@mise/shared/domain/theme';
import { AppError } from '../../core/errors.js';
import { newDbId, toApiId, toDbId } from '../../core/ids.js';
import type { ClientSettings, Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { changedFields, recordAudit } from '../audit/index.js';

export interface Actor {
  userId: string;
  deviceId: string;
  authorizedBy: string | null;
  ip: string;
  permissions: string[];
}

function auditActor(actor: Actor) {
  return {
    userId: toDbId(actor.userId),
    deviceId: toDbId(actor.deviceId),
    authorizedBy: actor.authorizedBy ? toDbId(actor.authorizedBy) : null,
    ip: actor.ip,
  };
}

/** Lee kds_thresholds y kds_sound (jsonb) con los valores por defecto del doc 07. */
export function toKdsSettings(s: Pick<ClientSettings, 'kdsThresholds' | 'kdsSound'>): KdsSettings {
  const t = (s.kdsThresholds ?? {}) as { warnMin?: number; lateMin?: number };
  const sound = (s.kdsSound ?? {}) as { volume?: number; repeatSec?: number };
  return {
    warnMin: t.warnMin ?? 10,
    lateMin: t.lateMin ?? 20,
    reminderSec: sound.repeatSec ?? 120,
    volume: sound.volume ?? 0.8,
  };
}

export function toSettings(s: ClientSettings): Settings {
  return {
    legalName: s.legalName,
    tradeName: s.tradeName,
    nit: s.nit,
    locale: s.locale,
    currencyCode: s.currencyCode,
    currencySymbol: s.currencySymbol,
    decimals: s.decimals,
    timezone: s.timezone,
    businessDayCutoff: s.businessDayCutoff,
    themeId: s.themeId,
    colorPrimaryOverride: s.colorPrimaryOverride,
    kds: toKdsSettings(s),
    settingsVersion: s.settingsVersion,
  };
}

export async function getSettings(prisma: PrismaClient): Promise<ClientSettings> {
  const settings = await prisma.clientSettings.findFirst();
  if (!settings) throw new AppError('NOT_FOUND', 'El cliente no está configurado');
  return settings;
}

const CHECK_NAMES: Record<string, string> = {
  'white/primary': 'texto blanco sobre el color',
  'primary/background': 'el color sobre el fondo',
  'primary/surface': 'el color sobre las tarjetas',
};

export async function updateSettings(
  prisma: PrismaClient,
  input: Partial<Omit<Settings, 'settingsVersion'>> & { settingsVersion: number },
  actor: Actor,
): Promise<Settings> {
  const { settingsVersion, kds, ...changes } = input;
  return prisma.$transaction(async (tx) => {
    const current = await tx.clientSettings.findFirst();
    if (!current) throw new AppError('NOT_FOUND', 'El cliente no está configurado');
    if (current.settingsVersion !== settingsVersion) {
      throw new AppError(
        'STALE_VERSION',
        'Otra persona cambió la configuración. Recarga y vuelve a intentar.',
      );
    }

    const themeId = changes.themeId ?? current.themeId;
    if (!THEMES[themeId])
      throw new AppError('VALIDATION_ERROR', `El tema ${themeId} no se puede elegir`);
    const override =
      changes.colorPrimaryOverride !== undefined
        ? changes.colorPrimaryOverride
        : current.colorPrimaryOverride;
    if (override) {
      const failures = validatePrimaryOverride(override, themeById(themeId));
      if (failures.length > 0) {
        const detail = failures
          .map(
            (f) =>
              `${CHECK_NAMES[`${f.foreground}/${f.background}`]} da ${f.ratio.toFixed(2)} y necesita ${f.minimum}`,
          )
          .join('; ');
        throw new AppError(
          'VALIDATION_ERROR',
          `El color no cumple el contraste: ${detail}`,
          failures.map((f) => ({ ...f })),
        );
      }
    }

    // El KDS se guarda en los dos jsonb del doc 07, conservando las demás claves
    const kdsData = kds
      ? {
          kdsThresholds: {
            ...((current.kdsThresholds ?? {}) as object),
            warnMin: kds.warnMin,
            lateMin: kds.lateMin,
          },
          kdsSound: {
            ...((current.kdsSound ?? {}) as object),
            repeatSec: kds.reminderSec,
            volume: kds.volume,
          },
        }
      : {};
    const updated = await tx.clientSettings.update({
      where: { id: current.id },
      data: { ...changes, ...kdsData, settingsVersion: { increment: 1 } },
    });
    const diff = changedFields(toSettings(current), toSettings(updated));
    if (diff) {
      delete diff.before['settingsVersion'];
      delete diff.after['settingsVersion'];
      await recordAudit(tx, {
        action: 'config.settings.update',
        entity: 'client_settings',
        ...auditActor(actor),
        ...diff,
      });
    }
    return toSettings(updated);
  });
}

// ─── Sucursales ──────────────────────────────────────────────────────────────

function toBranch(b: {
  id: string;
  name: string;
  address: string;
  phone: string;
  timezone: string | null;
  folioPrefix: string;
  active: boolean;
}): Branch {
  return {
    id: toApiId(b.id),
    name: b.name,
    address: b.address,
    phone: b.phone,
    timezone: b.timezone,
    folioPrefix: b.folioPrefix,
    active: b.active,
  };
}

export async function listBranches(prisma: PrismaClient): Promise<Branch[]> {
  return (await prisma.branch.findMany({ orderBy: { name: 'asc' } })).map(toBranch);
}

/** Una sucursal nueva recibe las plantillas de ticket de la primera y su estación de cocina. */
export async function createBranch(
  prisma: PrismaClient,
  input: Omit<Branch, 'id'>,
  actor: Actor,
): Promise<Branch> {
  return prisma.$transaction(async (tx) => {
    const id = newDbId();
    const branch = await tx.branch.create({ data: { id, ...input } });
    const source = await tx.branch.findFirst({
      where: { id: { not: id } },
      include: { ticketTemplates: true },
    });
    if (source) {
      await tx.ticketTemplate.createMany({
        data: source.ticketTemplates.map((t) => ({
          id: newDbId(),
          branchId: id,
          docType: t.docType,
          header: t.header,
          footer: t.footer,
          showLogo: t.showLogo,
          paperWidth: t.paperWidth,
        })),
      });
    }
    await tx.kitchenStation.create({
      data: { id: newDbId(), branchId: id, name: 'Cocina', isDefault: true },
    });
    await recordAudit(tx, {
      action: 'config.branch.create',
      entity: 'branch',
      entityId: toApiId(id),
      ...auditActor(actor),
      after: { ...input },
    });
    return toBranch(branch);
  });
}

export async function updateBranch(
  prisma: PrismaClient,
  branchId: string,
  input: Partial<Omit<Branch, 'id'>>,
  actor: Actor,
): Promise<Branch> {
  return prisma.$transaction(async (tx) => {
    const id = toDbId(branchId);
    const current = await tx.branch.findUnique({ where: { id } });
    if (!current) throw new AppError('NOT_FOUND', 'La sucursal no existe');
    const updated = await tx.branch.update({ where: { id }, data: input });
    const diff = changedFields(toBranch(current), toBranch(updated));
    if (diff) {
      await recordAudit(tx, {
        action: 'config.branch.update',
        entity: 'branch',
        entityId: branchId,
        ...auditActor(actor),
        ...diff,
      });
    }
    return toBranch(updated);
  });
}

// ─── Plantillas de ticket ────────────────────────────────────────────────────

function toTicket(t: {
  docType: string;
  header: string;
  footer: string;
  showLogo: boolean;
  paperWidth: number;
}): TicketTemplate {
  return {
    docType: t.docType as TicketTemplate['docType'],
    header: t.header,
    footer: t.footer,
    showLogo: t.showLogo,
    paperWidth: t.paperWidth as 58 | 80,
  };
}

export async function listTicketTemplates(
  prisma: PrismaClient,
  branchId: string,
): Promise<TicketTemplate[]> {
  const rows = await prisma.ticketTemplate.findMany({
    where: { branchId: toDbId(branchId) },
    orderBy: { docType: 'asc' },
  });
  return rows.map(toTicket);
}

export async function updateTicketTemplate(
  prisma: PrismaClient,
  branchId: string,
  docType: string,
  input: Partial<Omit<TicketTemplate, 'docType'>>,
  actor: Actor,
): Promise<TicketTemplate> {
  return prisma.$transaction(async (tx) => {
    const where = { branchId_docType: { branchId: toDbId(branchId), docType } };
    const current = await tx.ticketTemplate.findUnique({ where });
    if (!current) throw new AppError('NOT_FOUND', 'La plantilla no existe');
    const updated = await tx.ticketTemplate.update({ where, data: input });
    const diff = changedFields(toTicket(current), toTicket(updated));
    if (diff) {
      await recordAudit(tx, {
        action: 'config.ticket_template.update',
        entity: 'ticket_template',
        entityId: `${branchId}/${docType}`,
        ...auditActor(actor),
        ...diff,
      });
    }
    return toTicket(updated);
  });
}

// ─── Motivos (Docs/08 §2.3) ──────────────────────────────────────────────────

/** Motivos activos, del tipo pedido o todos, en su orden (los lee cualquier usuario con sesión). */
export async function listReasons(prisma: PrismaClient, type?: ReasonType): Promise<Reason[]> {
  const rows = await prisma.reason.findMany({
    where: { active: true, ...(type ? { type } : {}) },
    orderBy: [{ type: 'asc' }, { sort: 'asc' }, { name: 'asc' }],
  });
  return rows.map((r) => ({
    id: toApiId(r.id),
    type: r.type as ReasonType,
    name: r.name,
    sort: r.sort,
  }));
}

// ─── Administración de motivos (H3 #21) ──────────────────────────────────────

type ReasonRow = { id: string; type: string; name: string; sort: number; active: boolean };
const toReasonAdmin = (r: ReasonRow): ReasonAdmin => ({
  id: toApiId(r.id),
  type: r.type as ReasonType,
  name: r.name,
  sort: r.sort,
  active: r.active,
});

/** Los de descuento también los administra quien tiene config.discounts (Docs/03: catálogo de motivos). */
export function canManageReason(permissions: string[], type: ReasonType): boolean {
  return (
    permissions.includes('config.payments') ||
    (type === 'DISCOUNT' && permissions.includes('config.discounts'))
  );
}

function assertCanManage(permissions: string[], type: ReasonType) {
  if (!canManageReason(permissions, type))
    throw new AppError(
      'AUTHORIZATION_REQUIRED',
      'No tienes permiso para administrar estos motivos',
      {
        permission: 'config.payments',
      },
    );
}

/** Todos los motivos (activos e inactivos) que el usuario puede administrar. */
export async function listAllReasons(
  prisma: PrismaClient,
  permissions: string[],
  type?: ReasonType,
): Promise<ReasonAdmin[]> {
  const rows = await prisma.reason.findMany({
    where: type ? { type } : {},
    orderBy: [{ type: 'asc' }, { sort: 'asc' }, { name: 'asc' }],
  });
  return rows.filter((r) => canManageReason(permissions, r.type as ReasonType)).map(toReasonAdmin);
}

type Tx = Prisma.TransactionClient;

async function assertReasonNameFree(tx: Tx, type: string, name: string, exceptId?: string) {
  const taken = await tx.reason.findFirst({
    where: { type, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (taken && taken.id !== exceptId)
    throw new AppError('VALIDATION_ERROR', `Ya existe el motivo "${name}"`);
}

export async function createReason(
  prisma: PrismaClient,
  input: CreateReasonRequest,
  actor: Actor,
): Promise<{ reason: ReasonAdmin; created: boolean }> {
  assertCanManage(actor.permissions, input.type);
  const id = toDbId(input.id);
  const existing = await prisma.reason.findUnique({ where: { id } });
  if (existing) return { reason: toReasonAdmin(existing), created: false };
  const row = await prisma.$transaction(async (tx) => {
    await assertReasonNameFree(tx, input.type, input.name);
    const last = await tx.reason.aggregate({ where: { type: input.type }, _max: { sort: true } });
    const created = await tx.reason.create({
      data: {
        id,
        type: input.type,
        name: input.name,
        sort: input.sort ?? (last._max.sort ?? -1) + 1,
      },
    });
    await recordAudit(tx, {
      action: 'config.reason.create',
      entity: 'reason',
      entityId: input.id,
      ...auditActor(actor),
      after: { type: created.type, name: created.name, sort: created.sort },
    });
    return created;
  });
  return { reason: toReasonAdmin(row), created: true };
}

export async function updateReason(
  prisma: PrismaClient,
  reasonId: string,
  input: UpdateReasonRequest,
  actor: Actor,
): Promise<ReasonAdmin> {
  const id = toDbId(reasonId);
  return prisma.$transaction(async (tx) => {
    const before = await tx.reason.findUnique({ where: { id } });
    if (!before) throw new AppError('NOT_FOUND', 'Motivo no encontrado');
    assertCanManage(actor.permissions, before.type as ReasonType);
    await assertReasonNameFree(tx, before.type, input.name, id);
    // Cancelar, reabrir, retirar… piden un motivo: cada tipo conserva al menos uno activo
    if (before.active && !input.active) {
      const others = await tx.reason.count({
        where: { type: before.type, active: true, id: { not: id } },
      });
      if (others === 0)
        throw new AppError(
          'VALIDATION_ERROR',
          'Es el último motivo activo de este tipo: agrega otro antes de desactivarlo',
        );
    }
    const after = await tx.reason.update({
      where: { id },
      data: { name: input.name, active: input.active, sort: input.sort },
    });
    const diff = changedFields(toReasonAdmin(before), toReasonAdmin(after));
    if (diff)
      await recordAudit(tx, {
        action: 'config.reason.update',
        entity: 'reason',
        entityId: reasonId,
        ...auditActor(actor),
        ...diff,
      });
    return toReasonAdmin(after);
  });
}
