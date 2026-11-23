import { newId } from '@mise/shared/domain/ids';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../core/app.js';
import { toDbId } from '../../core/ids.js';
import { resetDb } from '../../core/test-db.js';
import { createUser as createTestUser, prisma, setupFixture } from '../../core/test-app.js';
import { createPairingCode } from './index.js';

type Headers = Record<string, string>;
let app: App;
let branchId: string;
let admin: Headers;
let roles: { id: string; name: string }[];

async function pairDevice() {
  const { code } = await createPairingCode(prisma, { branchId: toDbId(branchId) });
  return (
    await app.inject({
      method: 'POST',
      url: '/api/devices/pair',
      payload: { code, name: 'Tablet', type: 'ADMIN' },
    })
  ).json<{ deviceId: string; deviceToken: string }>();
}

async function loginWith(username: string, password: string) {
  const device = await pairDevice();
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'x-device-id': device.deviceId, 'x-device-token': device.deviceToken },
    payload: { username, password },
  });
  return { res, device };
}

const login = async (username: string, password: string) =>
  (await loginWith(username, password)).res;

async function loginAs(username: string, password: string): Promise<Headers> {
  const { res, device } = await loginWith(username, password);
  return { authorization: `Bearer ${res.json().accessToken}`, 'x-device-id': device.deviceId };
}

const roleId = (name: string) => roles.find((r) => r.name === name)!.id;
const call = (method: 'GET' | 'POST' | 'PUT', url: string, headers: Headers, payload?: object) =>
  app.inject({ method, url, headers, ...(payload ? { payload } : {}) });

const newWaiter = (over: object = {}) => ({
  id: newId(),
  fullName: 'Luis Pérez',
  username: 'Luis.Perez',
  password: 'clave-mesero-123',
  pin: '2468',
  roleIds: [roleId('Mesero')],
  branchIds: [branchId],
  ...over,
});

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  admin = await loginAs('dev', 'desarrollo-local');
  roles = (await call('GET', '/api/roles', admin)).json();
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('usuarios (RF-030, H3 #21)', () => {
  it('el administrador crea un usuario que entra con contraseña; repetir el id no duplica', async () => {
    const body = newWaiter();
    const res = await call('POST', '/api/users', admin, body);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      username: 'luis.perez',
      active: true,
      hasPin: true,
      locked: false,
      roleIds: [roleId('Mesero')],
      branchIds: [branchId],
    });
    expect(JSON.stringify(res.json())).not.toMatch(/hash|clave/i);
    expect((await call('POST', '/api/users', admin, body)).statusCode).toBe(200);
    expect((await login('luis.perez', 'clave-mesero-123')).statusCode).toBe(200);
    const audit = await prisma.auditLog.findFirst({ where: { action: 'user.create' } });
    expect(JSON.stringify(audit?.after)).not.toContain('2468');
  });

  it('usuario repetido da 409 USERNAME_TAKEN; contraseña corta o sin rol da 400', async () => {
    await call('POST', '/api/users', admin, newWaiter());
    const dup = await call('POST', '/api/users', admin, newWaiter({ username: 'LUIS.PEREZ' }));
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('USERNAME_TAKEN');
    expect(
      (await call('POST', '/api/users', admin, newWaiter({ username: 'x1x', password: 'corta' })))
        .statusCode,
    ).toBe(400);
    expect(
      (await call('POST', '/api/users', admin, newWaiter({ username: 'x2x', roleIds: [] })))
        .statusCode,
    ).toBe(400);
  });

  it('el mesero no administra usuarios ni ve los roles', async () => {
    await createTestUser('ana', 'Mesero', { password: 'clave-mesero-1' });
    const ana = await loginAs('ana', 'clave-mesero-1');
    expect((await call('GET', '/api/users', ana)).json().error.code).toBe('AUTHORIZATION_REQUIRED');
    expect((await call('GET', '/api/roles', ana)).statusCode).toBe(403);
  });

  it('desactivar cierra sus sesiones y ya no entra; no puedes desactivarte a ti', async () => {
    const user = (await call('POST', '/api/users', admin, newWaiter())).json();
    const session = (await login('luis.perez', 'clave-mesero-123')).json();
    const off = await call('PUT', `/api/users/${user.id}`, admin, {
      fullName: 'Luis Pérez',
      active: false,
      roleIds: user.roleIds,
      branchIds: user.branchIds,
    });
    expect(off.json().active).toBe(false);
    const refresh = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: session.refreshToken },
    });
    expect(refresh.statusCode).toBe(401);
    expect((await login('luis.perez', 'clave-mesero-123')).statusCode).toBe(401);

    const me = (await call('GET', '/api/users', admin))
      .json()
      .find((u: { username: string }) => u.username === 'dev');
    const self = await call('PUT', `/api/users/${me.id}`, admin, { ...me, active: false });
    expect(self.statusCode).toBe(400);
  });

  it('siempre queda alguien que administra usuarios (409 LAST_ADMIN)', async () => {
    const users = (await call('GET', '/api/users', admin)).json();
    const other = users.find((u: { username: string }) => u.username === 'admin');
    const me = users.find((u: { username: string }) => u.username === 'dev');
    const off = await call('PUT', `/api/users/${other.id}`, admin, { ...other, active: false });
    expect(off.statusCode).toBe(200);
    const last = await call('PUT', `/api/users/${me.id}`, admin, {
      ...me,
      roleIds: [roleId('Mesero')],
    });
    expect(last.statusCode).toBe(409);
    expect(last.json().error.code).toBe('LAST_ADMIN');
  });

  it('cambiar la contraseña desbloquea; el PIN se pone y se quita', async () => {
    const user = (await call('POST', '/api/users', admin, newWaiter({ pin: undefined }))).json();
    expect(user.hasPin).toBe(false);
    await prisma.user.update({
      where: { id: toDbId(user.id) },
      data: { failedAttempts: 5, lockedUntil: new Date(Date.now() + 60_000) },
    });
    expect(
      (await call('GET', '/api/users', admin)).json().find((u: { id: string }) => u.id === user.id)
        .locked,
    ).toBe(true);
    const reset = await call('PUT', `/api/users/${user.id}`, admin, {
      fullName: user.fullName,
      active: true,
      roleIds: user.roleIds,
      branchIds: user.branchIds,
      password: 'otra-clave-segura',
    });
    expect(reset.json().locked).toBe(false);
    expect((await login('luis.perez', 'otra-clave-segura')).statusCode).toBe(200);

    const withPin = await call('POST', `/api/users/${user.id}/pin`, admin, { pin: '1357' });
    expect(withPin.json().hasPin).toBe(true);
    expect((await call('POST', `/api/users/${user.id}/pin`, admin, { pin: '12' })).statusCode).toBe(
      400,
    );
    const without = await call('POST', `/api/users/${user.id}/pin`, admin, { pin: null });
    expect(without.json().hasPin).toBe(false);
  });

  it('los roles traen sus permisos, topes de descuento y cuántos usuarios tienen', () => {
    const mesero = roles.find((r) => r.name === 'Mesero') as unknown as {
      permissions: string[];
      isSystem: boolean;
      userCount: number;
    };
    expect(mesero.permissions).toContain('order.create');
    expect(typeof mesero.isSystem).toBe('boolean');
    expect(mesero.userCount).toBeGreaterThanOrEqual(0);
  });
  it('el gerente no crea administradores ni toca al administrador (SC-61)', async () => {
    await createTestUser('gina', 'Gerente', { password: 'clave-gerente-1' });
    const gina = await loginAs('gina', 'clave-gerente-1');
    const boss = await call(
      'POST',
      '/api/users',
      gina,
      newWaiter({ roleIds: [roleId('Administrador')] }),
    );
    expect(boss.statusCode).toBe(403);
    expect(boss.json().error.details.missing).toContain('config.roles');
    expect((await call('POST', '/api/users', gina, newWaiter())).statusCode).toBe(201);
    const dev = (await call('GET', '/api/users', admin))
      .json()
      .find((u: { username: string }) => u.username === 'dev');
    const takeover = await call('PUT', `/api/users/${dev.id}`, gina, {
      ...dev,
      password: 'me-quedo-con-todo',
    });
    expect(takeover.statusCode).toBe(403);
    expect((await call('POST', `/api/users/${dev.id}/pin`, gina, { pin: '1234' })).statusCode).toBe(
      403,
    );
  });
});
