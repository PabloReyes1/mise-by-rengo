import { newId } from '@mise/shared/domain/ids';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../core/app.js';
import { toDbId } from '../../core/ids.js';
import { resetDb } from '../../core/test-db.js';
import { createUser, prisma, setupFixture } from '../../core/test-app.js';
import { createPairingCode } from '../auth/index.js';

type Headers = Record<string, string>;
type Method = { id: string; name: string; kind: string; active: boolean; givesChange: boolean };
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

const call = (method: 'GET' | 'POST' | 'PUT', url: string, headers: Headers, payload?: object) =>
  app.inject({ method, url, headers, ...(payload ? { payload } : {}) });

const turnOff = (m: Method, sort = 0) =>
  call('PUT', `/api/payment-methods/${m.id}`, admin, {
    name: m.name,
    givesChange: m.givesChange,
    requiresReference: false,
    active: false,
    sort,
  });

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  admin = await loginAs('dev', 'desarrollo-local');
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('métodos de pago (RF-027, H3 #21)', () => {
  it('crear uno (idempotente): solo el efectivo da cambio; el mesero no administra', async () => {
    const body = { id: newId(), name: 'Vale', kind: 'OTHER', givesChange: true };
    const res = await call('POST', '/api/payment-methods', admin, body);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: 'Vale', givesChange: false, active: true });
    expect((await call('POST', '/api/payment-methods', admin, body)).statusCode).toBe(200);
    const dup = await call('POST', '/api/payment-methods', admin, {
      ...body,
      id: newId(),
      name: 'vale',
    });
    expect(dup.statusCode).toBe(400);

    await createUser('ana', 'Mesero', { password: 'clave-mesero-1' });
    const ana = await loginAs('ana', 'clave-mesero-1');
    expect((await call('GET', '/api/payment-methods?all=true', ana)).statusCode).toBe(403);
    const list: Method[] = (await call('GET', '/api/payment-methods', ana)).json();
    expect(list.some((m) => m.name === 'Vale')).toBe(true);
    const create = await call('POST', '/api/payment-methods', ana, {
      ...body,
      id: newId(),
      name: 'X',
    });
    expect(create.json().error.code).toBe('AUTHORIZATION_REQUIRED');
  });

  it('desactivar lo quita del cobro pero no de la administración; nunca el último', async () => {
    const all: Method[] = (await call('GET', '/api/payment-methods?all=true', admin)).json();
    const [first, ...rest] = all;
    expect((await turnOff(first!, 5)).json()).toMatchObject({ active: false, sort: 5 });
    const active: Method[] = (await call('GET', '/api/payment-methods', admin)).json();
    expect(active.some((m) => m.id === first!.id)).toBe(false);
    const again: Method[] = (await call('GET', '/api/payment-methods?all=true', admin)).json();
    expect(again).toHaveLength(all.length);

    for (const m of rest.slice(0, -1)) await turnOff(m);
    const lastOff = await turnOff(rest.at(-1)!);
    expect(lastOff.statusCode).toBe(400);
    expect(lastOff.json().error.message).toMatch(/único método/);
    expect(await prisma.auditLog.count({ where: { action: 'config.payment_method.update' } })).toBe(
      rest.length,
    );
  });
});
