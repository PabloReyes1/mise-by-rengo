import type { RealtimeEnvelope } from '@mise/shared/contracts/realtime';
import { REALTIME_PATH } from '@mise/shared/contracts/realtime';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../core/app.js';
import { toDbId } from '../../core/ids.js';
import { resetDb } from '../../core/test-db.js';
import { prisma, setupFixture } from '../../core/test-app.js';
import { createPairingCode } from '../auth/index.js';
import { purgeOldEvents, RETENTION_MS } from './realtime.service.js';

let app: App;
let branchId: string;
let url: string;
const sockets: Socket[] = [];

interface Session {
  token: string;
  deviceId: string;
}

async function loginOn(type: 'WAITER' | 'KDS'): Promise<Session> {
  const { code } = await createPairingCode(prisma, { branchId: toDbId(branchId) });
  const device = (
    await app.inject({
      method: 'POST',
      url: '/api/devices/pair',
      payload: { code, name: type, type },
    })
  ).json<{ deviceId: string; deviceToken: string }>();
  const session = (
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-device-id': device.deviceId, 'x-device-token': device.deviceToken },
      payload: { username: 'dev', password: 'desarrollo-local' },
    })
  ).json<{ accessToken: string }>();
  return { token: session.accessToken, deviceId: device.deviceId };
}

/** Conecta y junta lo que llega por el canal "event". */
function open(auth: object) {
  const socket = connect(url, {
    path: REALTIME_PATH,
    auth,
    transports: ['websocket'],
    reconnection: false,
  });
  sockets.push(socket);
  const received: RealtimeEnvelope[] = [];
  socket.on('event', (e: RealtimeEnvelope) => received.push(e));
  const ready = new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', (e) => reject(e));
  });
  return { socket, received, ready };
}

const until = async (check: () => boolean, ms = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('No llegó a tiempo');
    await new Promise((r) => setTimeout(r, 20));
  }
};

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  await app.listen({ port: 0, host: '127.0.0.1' });
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  for (const s of sockets.splice(0)) s.close();
  await app.close();
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('tiempo real (Docs/08 §3, ADR-004)', () => {
  it('sin sesión válida no conecta', async () => {
    await expect(
      open({ token: 'x', deviceId: '01JD4K7P0000000000000000A1' }).ready,
    ).rejects.toThrow(/UNAUTHENTICATED/);
  });

  it('cada sala recibe solo lo suyo: el KDS ve los de cocina, el mesero no', async () => {
    const waiter = open(await loginOn('WAITER'));
    const kds = open(await loginOn('KDS'));
    await Promise.all([waiter.ready, kds.ready]);
    await app.realtime.publish({ branchId, event: 'order.sent', rooms: ['kds'], data: { id: 1 } });
    await app.realtime.publish({
      branchId,
      event: 'occupancy.opened',
      rooms: ['branch'],
      data: { id: 2 },
    });
    await until(() => kds.received.length === 2 && waiter.received.length === 1);
    expect(waiter.received.map((e) => e.event)).toEqual(['occupancy.opened']);
    expect(kds.received[0]).toMatchObject({ event: 'order.sent', branchId, data: { id: 1 } });
    expect(kds.received[1]!.seq).toBeGreaterThan(kds.received[0]!.seq);
  });

  it('al reconectar con lastSeq recibe lo que se perdió, solo de sus salas', async () => {
    const session = await loginOn('WAITER');
    const first = open(session);
    await first.ready;
    await app.realtime.publish({ branchId, event: 'occupancy.opened', rooms: ['branch'], data: 1 });
    await until(() => first.received.length === 1);
    const lastSeq = first.received[0]!.seq;
    first.socket.close();

    // Mientras estuvo desconectado
    await app.realtime.publish({
      branchId,
      event: 'occupancy.updated',
      rooms: ['branch'],
      data: 2,
    });
    await app.realtime.publish({ branchId, event: 'order.sent', rooms: ['kds'], data: 3 });
    await app.realtime.publish({ branchId, event: 'order.ready', rooms: [`user:x`], data: 4 });

    const again = open({ ...session, lastSeq });
    await again.ready;
    await until(() => again.received.length === 1);
    await new Promise((r) => setTimeout(r, 100));
    expect(again.received.map((e) => e.event)).toEqual(['occupancy.updated']);
  });

  it('si se borraron eventos que no vio, le pide recargar todo (resync.required)', async () => {
    const session = await loginOn('WAITER');
    await app.realtime.publish({ branchId, event: 'occupancy.opened', rooms: ['branch'], data: 1 });
    await app.realtime.publish({
      branchId,
      event: 'occupancy.updated',
      rooms: ['branch'],
      data: 2,
    });
    await app.realtime.publish({ branchId, event: 'occupancy.closed', rooms: ['branch'], data: 3 });
    const rows = await prisma.realtimeEvent.findMany({ orderBy: { seq: 'asc' } });
    // Vio el primero; el segundo venció (más de 24 h) antes de que volviera a conectar
    await prisma.realtimeEvent.updateMany({
      where: { seq: { in: [rows[0]!.seq, rows[1]!.seq] } },
      data: { at: new Date(Date.now() - RETENTION_MS - 1000) },
    });
    expect(await purgeOldEvents(prisma)).toBe(2);

    const client = open({ ...session, lastSeq: Number(rows[0]!.seq) });
    await client.ready;
    await until(() => client.received.length === 1);
    expect(client.received[0]!.event).toBe('resync.required');
  });
});
