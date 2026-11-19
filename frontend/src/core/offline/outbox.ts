// Outbox: cola de acciones operativas del dispositivo (Docs/09 §4). Dueño: Pablito.
// Toda acción operativa pasa por aquí, haya o no conexión: un solo camino de código (regla 1).
// Se envían en orden por `seq` (regla 2). Un error de red bloquea las siguientes y se reintenta con
// espera exponencial (regla 3); un error de negocio marca la acción RECHAZADA y deja seguir a las
// demás, salvo las que dependen de ella (mismo entityId).
//
// H1: cada acción va a su propia ruta REST con `Idempotency-Key`. En H4 se envían en lotes por
// POST /api/sync/push (regla 4) sin cambiar a quien encola.

export type OutboxStatus = 'PENDING' | 'REJECTED';

export interface OutboxError {
  code: string;
  message: string;
  details?: unknown;
}

export interface OutboxOp {
  /** Orden del dispositivo; lo asigna el almacén al agregar */
  seq: number;
  idempotencyKey: string;
  /** Ej. 'occupancy.open', 'occupancy.move' */
  type: string;
  /** Entidad afectada: las acciones de la misma entidad dependen entre sí */
  entityId: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Ruta de la API sin /api, ej. '/occupancies' */
  path: string;
  body: unknown;
  /** Texto corto para la lista de pendientes ("Abrir mesa 5") */
  label: string;
  userId: string | null;
  deviceId: string | null;
  clientCreatedAt: string;
  attempts: number;
  status: OutboxStatus;
  lastError: OutboxError | null;
  /** No reintentar antes de esta hora (ms) */
  nextAttemptAt: number;
}

export type NewOutboxOp = Pick<
  OutboxOp,
  'type' | 'entityId' | 'method' | 'path' | 'body' | 'label' | 'idempotencyKey'
> &
  Partial<Pick<OutboxOp, 'userId' | 'deviceId'>>;

/** Dónde vive la cola: IndexedDB en la app, memoria en las pruebas. */
export interface OutboxStore {
  add(op: Omit<OutboxOp, 'seq'>): Promise<number>;
  /** Todas, ordenadas por seq */
  list(): Promise<OutboxOp[]>;
  update(seq: number, patch: Partial<OutboxOp>): Promise<void>;
  remove(seq: number): Promise<void>;
}

/** Resultado de enviar una acción. */
export type SendResult =
  | { ok: true; data: unknown }
  | { ok: false; retry: true; error: OutboxError }
  | { ok: false; retry: false; error: OutboxError };

export interface OutboxOptions {
  store: OutboxStore;
  send: (op: OutboxOp) => Promise<SendResult>;
  now?: () => number;
  random?: () => number;
  /** Programa el siguiente intento (setTimeout en la app; controlado en las pruebas) */
  schedule?: (fn: () => void, ms: number) => () => void;
}

export interface OutboxSnapshot {
  pending: OutboxOp[];
  rejected: OutboxOp[];
  /** Hay un error de red esperando el siguiente intento */
  waitingForNetwork: boolean;
}

/** Espera antes del intento n (1 s, 2 s, 4 s… máx. 60 s) con ±20 % de variación (regla 3). */
export function backoffMs(attempts: number, random: () => number = Math.random): number {
  const base = Math.min(60_000, 1000 * 2 ** Math.max(0, attempts - 1));
  return Math.round(base * (0.8 + random() * 0.4));
}

export class OutboxRejectedError extends Error {
  readonly code: string;
  readonly details: unknown;
  constructor(error: OutboxError) {
    super(error.message);
    this.name = 'OutboxRejectedError';
    this.code = error.code;
    this.details = error.details;
  }
}

export function createOutbox(options: OutboxOptions) {
  const { store, send } = options;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const schedule =
    options.schedule ??
    ((fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    });

  const waiters = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  const listeners = new Set<() => void>();
  let snapshot: OutboxSnapshot = { pending: [], rejected: [], waitingForNetwork: false };
  let running: Promise<void> | null = null;
  let again = false;
  let cancelTimer: (() => void) | null = null;

  async function refresh(waitingForNetwork: boolean) {
    const all = await store.list();
    snapshot = {
      pending: all.filter((o) => o.status === 'PENDING'),
      rejected: all.filter((o) => o.status === 'REJECTED'),
      waitingForNetwork,
    };
    listeners.forEach((l) => l());
  }

  async function reject(op: OutboxOp, error: OutboxError) {
    await store.update(op.seq, { status: 'REJECTED', lastError: error });
    waiters.get(op.seq)?.reject(new OutboxRejectedError(error));
    waiters.delete(op.seq);
  }

  /** Una pasada por la cola, en orden. Devuelve si quedó esperando la red. */
  async function pass(): Promise<boolean> {
    const rejectedEntities = new Set<string>();
    for (const op of await store.list()) {
      if (op.status === 'REJECTED') {
        rejectedEntities.add(op.entityId);
        continue;
      }
      if (rejectedEntities.has(op.entityId)) {
        await reject(op, {
          code: 'DEPENDENCY_REJECTED',
          message: 'No se envió porque una acción anterior sobre lo mismo fue rechazada',
        });
        continue;
      }
      if (op.nextAttemptAt > now()) {
        armTimer(op.nextAttemptAt - now());
        return true;
      }
      const result = await send(op);
      if (result.ok) {
        await store.remove(op.seq);
        waiters.get(op.seq)?.resolve(result.data);
        waiters.delete(op.seq);
      } else if (result.retry) {
        const attempts = op.attempts + 1;
        const wait = backoffMs(attempts, random);
        await store.update(op.seq, {
          attempts,
          lastError: result.error,
          nextAttemptAt: now() + wait,
        });
        armTimer(wait);
        return true; // bloquea las siguientes (regla 2)
      } else {
        rejectedEntities.add(op.entityId);
        await reject(op, result.error);
      }
    }
    return false;
  }

  function armTimer(ms: number) {
    cancelTimer?.();
    cancelTimer = schedule(() => {
      cancelTimer = null;
      void outbox.flush();
    }, ms);
  }

  const outbox = {
    /**
     * Encola una acción y la intenta enviar ya. `result` se cumple cuando el servidor la aplica y
     * falla con OutboxRejectedError si la rechaza; sin conexión queda pendiente hasta que vuelva.
     */
    async enqueue<T>(input: NewOutboxOp): Promise<{ seq: number; result: Promise<T> }> {
      const seq = await store.add({
        ...input,
        userId: input.userId ?? null,
        deviceId: input.deviceId ?? null,
        clientCreatedAt: new Date(now()).toISOString(),
        attempts: 0,
        status: 'PENDING',
        lastError: null,
        nextAttemptAt: 0,
      });
      const result = new Promise<T>((resolve, reject) => {
        waiters.set(seq, { resolve: resolve as (v: unknown) => void, reject });
      });
      // Evita "unhandled rejection" si quien encola no espera el resultado
      result.catch(() => undefined);
      void outbox.flush();
      return { seq, result };
    },

    /** Envía lo pendiente; si ya está enviando, vuelve a pasar al terminar. */
    flush(): Promise<void> {
      if (running) {
        again = true;
        return running;
      }
      running = (async () => {
        let waiting: boolean;
        do {
          again = false;
          waiting = await pass();
        } while (again && !waiting);
        await refresh(waiting);
      })().finally(() => {
        running = null;
      });
      return running;
    },

    /** Reintenta ya lo que espera la red (al volver la conexión). */
    async retryNow(): Promise<void> {
      for (const op of await store.list()) {
        if (op.status === 'PENDING' && op.nextAttemptAt > 0) {
          await store.update(op.seq, { nextAttemptAt: 0 });
        }
      }
      cancelTimer?.();
      cancelTimer = null;
      await outbox.flush();
    },

    /** Quita de la lista una acción rechazada, después de que el usuario la vio. */
    async dismiss(seq: number): Promise<void> {
      await store.remove(seq);
      await refresh(snapshot.waitingForNetwork);
    },

    getSnapshot: (): OutboxSnapshot => snapshot,

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return outbox;
}

export type Outbox = ReturnType<typeof createOutbox>;

/** Almacén en memoria (pruebas). */
export function memoryStore(): OutboxStore {
  const ops = new Map<number, OutboxOp>();
  let next = 1;
  return {
    add(op) {
      const seq = next++;
      ops.set(seq, { ...op, seq });
      return Promise.resolve(seq);
    },
    list: () => Promise.resolve([...ops.values()].sort((a, b) => a.seq - b.seq)),
    update(seq, patch) {
      const op = ops.get(seq);
      if (op) ops.set(seq, { ...op, ...patch });
      return Promise.resolve();
    },
    remove(seq) {
      ops.delete(seq);
      return Promise.resolve();
    },
  };
}
