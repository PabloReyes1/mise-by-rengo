import { PERMISSION_CODES } from '@mise/shared/contracts/auth';
import { newId } from '@mise/shared/domain/ids';
import { resolve } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../core/app.js';
import { toDbId } from '../../core/ids.js';
import { loadTemplate } from '../../core/templates.js';
import { resetDb } from '../../core/test-db.js';
import { createUser, prisma, setupFixture } from '../../core/test-app.js';
import { createPairingCode } from './index.js';

type Headers = Record<string, string>;
type RoleBody = { id: string; name: string; permissions: string[]; userCount: number };
let app: App;
let branchId: string;
let admin: Headers;

async function loginAs(username: string, password: string): Promise<Headers> {
  const { code } = await createPairingCode(prisma, { branchId: toDbId(branchId) });
  const device = (
    await app.inject({
      method: 'POST',
      url: '/api/devices/pair',
      payload: { code, name: 'Tablet', type: 'ADMIN' },
    })
  ).json<{ deviceId: string; deviceToken: string }>();
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'x-device-id': device.deviceId, 'x-device-token': device.deviceToken },
    payload: { username, password },
  });
  return { authorization: `Bearer ${res.json().accessToken}`, 'x-device-id': device.deviceId };
}

const call = (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  headers: Headers,
  payload?: object,
) => app.inject({ method, url, headers, ...(payload ? { payload } : {}) });

const roles = async (): Promise<RoleBody[]> => (await call('GET', '/api/roles', admin)).json();
const role = async (name: string) => (await roles()).find((r) => r.name === name)!;

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  admin = await loginAs('dev', 'desarrollo-local');
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('roles y permisos (Docs/03, H3 #21)', () => {
  it('el catálogo de shared es el mismo de templates/seed/permissions.json', async () => {
    const t = loadTemplate(
      resolve(import.meta.dirname, '../../../../templates'),
      'restaurante-basico',
    );
    expect([...PERMISSION_CODES]).toEqual(t.seed.permissions.map((p) => p.code));
    const res = await call('GET', '/api/permissions', admin);
    expect(res.json()).toHaveLength(PERMISSION_CODES.length);
  });

  it('crear un rol (idempotente), con nombre único y solo permisos del catálogo', async () => {
    const body = { id: newId(), name: 'Bartender', permissions: ['order.create', 'table.open'] };
    const res = await call('POST', '/api/roles', admin, body);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      name: 'Bartender',
      isSystem: false,
      permissions: ['order.create', 'table.open'],
      maxDiscountPct: null,
      userCount: 0,
    });
    expect((await call('POST', '/api/roles', admin, body)).statusCode).toBe(200);
    const dup = await call('POST', '/api/roles', admin, {
      ...body,
      id: newId(),
      name: 'bartender',
    });
    expect(dup.json().error.code).toBe('ROLE_NAME_TAKEN');
    const bad = await call('POST', '/api/roles', admin, {
      ...body,
      id: newId(),
      name: 'Otro',
      permissions: ['volar'],
    });
    expect(bad.statusCode).toBe(400);
    expect(await prisma.auditLog.count({ where: { action: 'role.create' } })).toBe(1);
  });

  it('editar los permisos aplica al renovar la sesión', async () => {
    await createUser('ana', 'Mesero', { password: 'clave-mesero-1' });
    const mesero = await role('Mesero');
    const put = await call('PUT', `/api/roles/${mesero.id}`, admin, {
      name: 'Mesero',
      permissions: [...mesero.permissions, 'reports.view'],
    });
    expect(put.json().permissions).toContain('reports.view');
    const ana = await loginAs('ana', 'clave-mesero-1');
    expect((await call('GET', '/api/roles', ana)).statusCode).toBe(403);
  });

  it('el rol de sistema no se renombra ni se borra; no se borra un rol con usuarios', async () => {
    const adminRole = await role('Administrador');
    const rename = await call('PUT', `/api/roles/${adminRole.id}`, admin, {
      name: 'Jefe',
      permissions: adminRole.permissions,
    });
    expect(rename.statusCode).toBe(400);
    expect((await call('DELETE', `/api/roles/${adminRole.id}`, admin)).statusCode).toBe(400);

    await createUser('ana', 'Mesero', { password: 'clave-mesero-1' });
    const inUse = await call('DELETE', `/api/roles/${(await role('Mesero')).id}`, admin);
    expect(inUse.json().error.code).toBe('ROLE_IN_USE');

    const cocina = await role('Cocina');
    expect(cocina.userCount).toBe(0);
    expect((await call('DELETE', `/api/roles/${cocina.id}`, admin)).statusCode).toBe(204);
    expect((await roles()).some((r) => r.name === 'Cocina')).toBe(false);
  });

  it('quitar config.roles a todos los que lo tienen da 409 LAST_ADMIN', async () => {
    const adminRole = await role('Administrador');
    const res = await call('PUT', `/api/roles/${adminRole.id}`, admin, {
      name: 'Administrador',
      permissions: adminRole.permissions.filter((p) => p !== 'config.roles'),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatchObject({
      code: 'LAST_ADMIN',
      details: { permission: 'config.roles' },
    });
  });

  it('el gerente fija los topes de descuento (config.discounts) pero no edita roles', async () => {
    await createUser('gina', 'Gerente', { password: 'clave-gerente-1' });
    const gina = await loginAs('gina', 'clave-gerente-1');
    const cajero = await role('Cajero');
    const limits = await call('PUT', `/api/roles/${cajero.id}/discount-limits`, gina, {
      maxDiscountPct: '10.00',
      maxDiscountAmount: null,
    });
    expect(limits.json()).toMatchObject({ maxDiscountPct: '10.00', maxDiscountAmount: null });
    const over = await call('PUT', `/api/roles/${cajero.id}/discount-limits`, gina, {
      maxDiscountPct: '150.00',
      maxDiscountAmount: null,
    });
    expect(over.statusCode).toBe(400);
    const edit = await call('PUT', `/api/roles/${cajero.id}`, gina, {
      name: 'Cajero',
      permissions: cajero.permissions,
    });
    expect(edit.json().error.code).toBe('AUTHORIZATION_REQUIRED');
    expect((await call('GET', '/api/permissions', gina)).statusCode).toBe(200);
  });
});
