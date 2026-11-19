import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { newDbId } from '../../core/ids.js';
import { resetDb, testPrisma } from '../../core/test-db.js';
import { changedFields, recordAudit } from './index.js';

const prisma = testPrisma();

beforeEach(async () => {
  await resetDb(prisma);
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('changedFields (Docs/07 audit_log: before/after solo con los campos cambiados)', () => {
  it('devuelve solo lo que cambió', () => {
    expect(
      changedFields(
        { name: 'Jocón', price: '58.00', sku: 'PF-002' },
        { name: 'Jocón', price: '60.00', sku: 'PF-002' },
      ),
    ).toEqual({
      before: { price: '58.00' },
      after: { price: '60.00' },
    });
  });

  it('sin cambios devuelve null', () => {
    expect(changedFields({ a: 1 }, { a: 1 })).toBeNull();
  });

  it('compara objetos por valor, no por referencia', () => {
    expect(changedFields({ m: { a: 1 } }, { m: { a: 1 } })).toBeNull();
  });
});

describe('recordAudit (RF-070, RF-255)', () => {
  it('guarda quién, qué, cuándo, desde qué dispositivo y quién autorizó', async () => {
    const userId = newDbId();
    const authorizedBy = newDbId();
    const deviceId = newDbId();
    await recordAudit(prisma, {
      action: 'bill.reopen',
      entity: 'bill',
      entityId: 'X',
      userId,
      authorizedBy,
      deviceId,
      ip: '10.0.0.5',
      before: { status: 'PAGADA' },
      after: { status: 'ABIERTA' },
    });
    const row = await prisma.auditLog.findFirstOrThrow();
    expect(row).toMatchObject({
      action: 'bill.reopen',
      userId,
      authorizedBy,
      deviceId,
      ip: '10.0.0.5',
    });
    expect(row.at).toBeInstanceOf(Date);
  });

  it('la bitácora no se puede modificar ni borrar (solo INSERT)', async () => {
    await recordAudit(prisma, { action: 'auth.login_failed' });
    await expect(prisma.auditLog.updateMany({ data: { action: 'otra' } })).rejects.toThrow();
    await expect(prisma.auditLog.deleteMany()).rejects.toThrow();
  });
});
