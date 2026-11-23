import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/index.js';
import { classify } from './index.js';
import {
  backoffMs,
  createOutbox,
  memoryStore,
  OutboxRejectedError,
  type OutboxOp,
  type SendResult,
} from './outbox.js';

function op(entityId: string, label = entityId) {
  return {
    type: 'test',
    entityId,
    method: 'POST' as const,
    path: `/x/${entityId}`,
    body: { entityId },
    label,
    idempotencyKey: `${entityId}-${Math.random()}`,
  };
}

/** Outbox con reloj y temporizador controlados por la prueba. */
function setup(responses: (op: OutboxOp) => SendResult) {
  let clock = 1_000_000;
  const timers: { at: number; fn: () => void }[] = [];
  const sent: string[] = [];
  const store = memoryStore();
  const outbox = createOutbox({
    store,
    send: (o) => {
      sent.push(o.entityId);
      return Promise.resolve(responses(o));
    },
    now: () => clock,
    random: () => 0.5,
    schedule: (fn, ms) => {
      const t = { at: clock + ms, fn };
      timers.push(t);
      return () => timers.splice(timers.indexOf(t), 1);
    },
  });
  return {
    outbox,
    store,
    sent,
    async advance(ms: number) {
      clock += ms;
      for (const t of timers.filter((x) => x.at <= clock)) {
        timers.splice(timers.indexOf(t), 1);
        t.fn();
      }
      await outbox.flush();
    },
  };
}

const ok = (): SendResult => ({ ok: true, data: { done: true } });
const network = (): SendResult => ({
  ok: false,
  retry: true,
  error: { code: 'NETWORK_ERROR', message: 'Sin conexión' },
});
const business = (): SendResult => ({
  ok: false,
  retry: false,
  error: { code: 'TABLE_OCCUPIED', message: 'La mesa 5 ya está ocupada' },
});

describe('outbox (Docs/09 §4.2)', () => {
  it('con conexión envía de inmediato y entrega el resultado', async () => {
    const t = setup(ok);
    const { result } = await t.outbox.enqueue(op('a'));
    await expect(result).resolves.toEqual({ done: true });
    expect(await t.store.list()).toEqual([]);
  });

  it('envía en orden de seq', async () => {
    const t = setup(ok);
    await t.outbox.enqueue(op('a'));
    await t.outbox.enqueue(op('b'));
    await t.outbox.enqueue(op('c'));
    await t.outbox.flush();
    expect(t.sent).toEqual(['a', 'b', 'c']);
  });

  it('un error de red bloquea las siguientes y se reintenta con espera exponencial', async () => {
    let online = false;
    const t = setup(() => (online ? ok() : network()));
    const first = await t.outbox.enqueue(op('a'));
    await t.outbox.enqueue(op('b'));
    await t.outbox.flush();
    expect(t.sent).toEqual(['a']); // b no se intenta mientras a espera
    expect(t.outbox.getSnapshot()).toMatchObject({ waitingForNetwork: true });
    expect(t.outbox.getSnapshot().pending).toHaveLength(2);

    await t.advance(999); // antes de 1 s no reintenta
    expect(t.sent).toEqual(['a']);
    await t.advance(1); // 1 s
    expect(t.sent).toEqual(['a', 'a']);

    online = true;
    await t.advance(2000); // segundo intento a los 2 s
    await expect(first.result).resolves.toEqual({ done: true });
    expect(t.sent).toEqual(['a', 'a', 'a', 'b']);
    expect(t.outbox.getSnapshot()).toMatchObject({ pending: [], waitingForNetwork: false });
  });

  it('al volver la conexión, retryNow no espera el temporizador', async () => {
    let online = false;
    const t = setup(() => (online ? ok() : network()));
    await t.outbox.enqueue(op('a'));
    await t.outbox.flush();
    online = true;
    await t.outbox.retryNow();
    expect(t.outbox.getSnapshot().pending).toEqual([]);
  });

  it('un error de negocio rechaza esa acción y las de la misma entidad, no las demás', async () => {
    const t = setup((o) => (o.entityId === 'mesa5' && o.label === 'abrir' ? business() : ok()));
    const open = await t.outbox.enqueue(op('mesa5', 'abrir'));
    const guests = await t.outbox.enqueue(op('mesa5', 'comensales'));
    const other = await t.outbox.enqueue(op('mesa6'));
    await t.outbox.flush();

    await expect(open.result).rejects.toBeInstanceOf(OutboxRejectedError);
    await expect(open.result).rejects.toMatchObject({ code: 'TABLE_OCCUPIED' });
    await expect(guests.result).rejects.toMatchObject({ code: 'DEPENDENCY_REJECTED' });
    await expect(other.result).resolves.toBeDefined();
    expect(t.sent).toEqual(['mesa5', 'mesa6']); // la dependiente ni se envía
    expect(t.outbox.getSnapshot().rejected.map((o) => o.label)).toEqual(['abrir', 'comensales']);

    await t.outbox.dismiss(open.seq);
    expect(t.outbox.getSnapshot().rejected).toHaveLength(1);
  });

  it('avisa a quien escucha cuando cambia la cola', async () => {
    const t = setup(ok);
    const listener = vi.fn();
    t.outbox.subscribe(listener);
    await t.outbox.enqueue(op('a'));
    await t.outbox.flush();
    expect(listener).toHaveBeenCalled();
  });
});

describe('espera entre intentos', () => {
  it('1 s, 2 s, 4 s… con tope de 60 s', () => {
    const exact = () => 0.5;
    expect([1, 2, 3, 7, 20].map((n) => backoffMs(n, exact))).toEqual([
      1000, 2000, 4000, 60_000, 60_000,
    ]);
    expect(backoffMs(1, () => 0)).toBe(800);
    expect(backoffMs(1, () => 1)).toBe(1200);
  });
});

describe('qué errores se reintentan', () => {
  it('sin conexión, sesión vencida y errores del servidor se reintentan', () => {
    for (const status of [0, 401, 429, 500, 503]) {
      expect(classify(new ApiError(status, 'INTERNAL_ERROR', 'x'))).toMatchObject({ retry: true });
    }
  });

  it('los errores de negocio no', () => {
    for (const status of [400, 403, 404, 409]) {
      expect(classify(new ApiError(status, 'TABLE_OCCUPIED', 'x'))).toMatchObject({
        retry: false,
      });
    }
  });

  it('un PIN 🔑 incorrecto (401) no traba la cola: se rechaza', () => {
    expect(classify(new ApiError(401, 'PIN_INVALID', 'PIN incorrecto'))).toMatchObject({
      retry: false,
    });
    expect(classify(new ApiError(401, 'TOKEN_EXPIRED', 'x'))).toMatchObject({ retry: true });
  });
});
