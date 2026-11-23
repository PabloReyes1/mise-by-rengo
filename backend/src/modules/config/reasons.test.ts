import { newId } from '@mise/shared/domain/ids';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../core/app.js';
import { toDbId } from '../../core/ids.js';
import { resetDb } from '../../core/test-db.js';
import { createUser, prisma, setupFixture } from '../../core/test-app.js';
import { createPairingCode } from '../auth/index.js';

type Headers = Record<string, string>;
type Reason = { id: string; type: string; name: string; active: boolean; sort: number };
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

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  admin = await loginAs('dev', 'desarrollo-local');
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('administrar motivos (Docs/08 §2.3, H3 #21)', () => {
  it('se crea al final de su tipo; desactivarlo lo saca de la lista del mesero', async () => {
    const res = await call('POST', '/api/reasons', admin, {
      id: newId(),
      type: 'CANCEL_ITEM',
      name: 'Plato frío',
    });
    expect(res.statusCode).toBe(201);
    const all: Reason[] = (
      await call('GET', '/api/reasons?all=true&type=CANCEL_ITEM', admin)
    ).json();
    expect(all.at(-1)).toMatchObject({ name: 'Plato frío', active: true });
    const off = await call('PUT', `/api/reasons/${res.json().id}`, admin, {
      name: 'Plato frío',
      active: false,
      sort: 0,
    });
    expect(off.json().active).toBe(false);
    const forWaiter: Reason[] = (await call('GET', '/api/reasons?type=CANCEL_ITEM', admin)).json();
    expect(forWaiter.some((r) => r.name === 'Plato frío')).toBe(false);
  });

  it('cada tipo conserva al menos un motivo activo', async () => {
    const conflict: Reason[] = (
      await call('GET', '/api/reasons?all=true&type=CONFLICT', admin)
    ).json();
    const [a, b] = conflict;
    await call('PUT', `/api/reasons/${a!.id}`, admin, { name: a!.name, active: false, sort: 0 });
    const last = await call('PUT', `/api/reasons/${b!.id}`, admin, {
      name: b!.name,
      active: false,
      sort: 0,
    });
    expect(last.statusCode).toBe(400);
    expect(last.json().error.message).toMatch(/último motivo activo/);
  });

  it('el gerente (config.discounts) administra solo los motivos de descuento', async () => {
    await createUser('gina', 'Gerente', { password: 'clave-gerente-1' });
    const gina = await loginAs('gina', 'clave-gerente-1');
    const mine: Reason[] = (await call('GET', '/api/reasons?all=true', gina)).json();
    expect(new Set(mine.map((r) => r.type))).toEqual(new Set(['DISCOUNT']));
    const ok = await call('POST', '/api/reasons', gina, {
      id: newId(),
      type: 'DISCOUNT',
      name: 'Cumpleaños',
    });
    expect(ok.statusCode).toBe(201);
    const no = await call('POST', '/api/reasons', gina, {
      id: newId(),
      type: 'CASH_WITHDRAWAL',
      name: 'Propinas',
    });
    expect(no.json().error.code).toBe('AUTHORIZATION_REQUIRED');
  });
});
