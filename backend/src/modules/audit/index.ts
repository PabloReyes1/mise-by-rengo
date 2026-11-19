// Módulo audit: bitácora de solo INSERT (Docs/07 §4.7, RF-070, RF-255). Dueño: Deniscito.
// Cada módulo la usa desde su primera acción sensible. Consulta y exportación: reportes (H4).
import { isDeepStrictEqual } from 'node:util';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';

type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditEntry {
  /** Ej. `bill.reopen`, `item.cancel`, `config.menu.update`, `auth.login_failed` */
  action: string;
  entity?: string;
  entityId?: string;
  /** uuid de la base */
  userId?: string | null;
  /** Quien autorizó con su PIN (🔑) */
  authorizedBy?: string | null;
  deviceId?: string | null;
  branchId?: string | null;
  ip?: string | null;
  /** Hora del dispositivo, si la acción se hizo sin conexión */
  clientAt?: Date;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reasonId?: string | null;
  note?: string | null;
}

/** Guarda una entrada. Se llama dentro de la misma transacción que la acción cuando la hay. */
export async function recordAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      action: entry.action,
      entity: entry.entity ?? null,
      entityId: entry.entityId ?? null,
      userId: entry.userId ?? null,
      authorizedBy: entry.authorizedBy ?? null,
      deviceId: entry.deviceId ?? null,
      branchId: entry.branchId ?? null,
      ip: entry.ip ?? null,
      clientAt: entry.clientAt ?? null,
      before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
      reasonId: entry.reasonId ?? null,
      note: entry.note ?? null,
    },
  });
}

/** Solo los campos que cambiaron (Docs/07: before/after con los campos cambiados). */
export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!isDeepStrictEqual(before[key], after[key])) {
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return Object.keys(a).length === 0 ? null : { before: b, after: a };
}
