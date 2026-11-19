import { newId } from '@mise/shared/domain/ids';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../core/app.js';
import { toDbId } from '../../core/ids.js';
import { resetDb } from '../../core/test-db.js';
import { prisma, setupFixture } from '../../core/test-app.js';
import { createPairingCode } from '../auth/index.js';

type Headers = Record<string, string>;

let app: App;
let admin: Headers;
let tableId: string;

async function login(): Promise<Headers> {
  const branch = await prisma.branch.findFirstOrThrow();
  const { code } = await createPairingCode(prisma, { branchId: branch.id });
  const device = (
    await app.inject({
      method: 'POST',
      url: '/api/devices/pair',
      payload: { code, name: 'D', type: 'ADMIN' },
    })
  ).json();
  const session = (
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-device-id': device.deviceId, 'x-device-token': device.deviceToken },
      payload: { username: 'dev', password: 'desarrollo-local' },
    })
  ).json();
  return { authorization: `Bearer ${session.accessToken}`, 'x-device-id': device.deviceId };
}

function rename(name: string, key?: string, headers: Headers = admin) {
  return app.inject({
    method: 'PUT',
    url: `/api/tables/${tableId}`,
    headers: key ? { ...headers, 'idempotency-key': key } : headers,
    payload: { name, version: 0 },
  });
}

beforeEach(async () => {
  ({ app } = await setupFixture({ rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 } }));
  admin = await login();
  const zone = (
    await app.inject({ method: 'POST', url: '/api/zones', headers: admin, payload: { name: 'Z' } })
  ).json();
  tableId = (
    await app.inject({
      method: 'POST',
      url: '/api/tables',
      headers: admin,
      payload: { zoneId: zone.id, name: '1', capacity: 4 },
    })
  ).json().id;
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('Idempotency-Key (Docs/08 §1, Docs/09 §4.2)', () => {
  it('la misma clave repite la primera respuesta sin repetir la acción', async () => {
    const key = newId();
    const first = await rename('A', key);
    expect(first.statusCode).toBe(200);
    // Sin la clave, repetir con version 0 sería STALE_VERSION; con la clave es la misma respuesta
    const again = await rename('A', key);
    expect(again.statusCode).toBe(200);
    expect(again.headers['idempotent-replay']).toBe('true');
    expect(again.json()).toEqual(first.json());
    expect(await prisma.syncOperation.count()).toBe(1);
    const op = await prisma.syncOperation.findUniqueOrThrow({ where: { idempotencyKey: key } });
    expect(op).toMatchObject({
      opType: 'PUT /api/tables/:id',
      entityId: tableId,
      status: 'APLICADA',
    });
    expect(op.deviceId).toBe(toDbId(admin['x-device-id']!));
  });

  it('otra clave es otra acción', async () => {
    await rename('A', newId());
    const second = await rename('B', newId());
    expect(second.json().error.code).toBe('STALE_VERSION');
  });

  it('un error de negocio también se repite igual (RECHAZADA)', async () => {
    await rename('A');
    const key = newId();
    const rejected = await rename('B', key);
    expect(rejected.statusCode).toBe(409);
    const again = await rename('B', key);
    expect(again.statusCode).toBe(409);
    expect(again.headers['idempotent-replay']).toBe('true');
    const op = await prisma.syncOperation.findUniqueOrThrow({ where: { idempotencyKey: key } });
    expect(op.status).toBe('RECHAZADA');
  });

  it('una clave usada en otra ruta se rechaza', async () => {
    const key = newId();
    await rename('A', key);
    const res = await app.inject({
      method: 'POST',
      url: '/api/zones',
      headers: { ...admin, 'idempotency-key': key },
      payload: { name: 'Terraza' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('otro dispositivo no puede reutilizar la clave', async () => {
    const key = newId();
    await rename('A', key);
    const other = await login();
    expect((await rename('A', key, other)).statusCode).toBe(400);
  });

  it('una clave con formato inválido se rechaza', async () => {
    expect((await rename('A', 'x')).statusCode).toBe(400);
  });

  it('sin sesión la clave no cambia nada: responde 401', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/tables/${tableId}`,
      headers: { 'idempotency-key': newId() },
      payload: { name: 'A', version: 0 },
    });
    expect(res.statusCode).toBe(401);
    expect(await prisma.syncOperation.count()).toBe(0);
  });
});
