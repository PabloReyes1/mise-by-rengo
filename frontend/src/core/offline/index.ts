// core/offline: outbox y base local (Docs/09). Dueño: Pablito.
// Los módulos encolan sus acciones con submitOperation; nunca llaman a apiFetch para cambiar estado.
import { newId } from '@mise/shared/domain/ids';
import { useSyncExternalStore } from 'react';
import { ApiError, apiFetch } from '../api/index.js';
import { sessionStore } from '../session/index.js';
import { dexieStore, requestPersistentStorage } from './db.js';
import {
  createOutbox,
  type NewOutboxOp,
  type OutboxOp,
  type OutboxSnapshot,
  type SendResult,
} from './outbox.js';

export {
  backoffMs,
  createOutbox,
  memoryStore,
  OutboxRejectedError,
  type Outbox,
  type OutboxOp,
  type OutboxSnapshot,
} from './outbox.js';

/**
 * Errores que se reintentan (bloquean la cola): sin conexión, sesión vencida (hay que volver a
 * entrar), licencia, versión, límite de intentos y errores del servidor. Los demás son de negocio.
 */
const RETRY_STATUS = new Set([0, 401, 402, 408, 426, 429]);

export function classify(error: unknown): SendResult {
  if (error instanceof ApiError) {
    const e = { code: error.code, message: error.message, details: error.details };
    const retry = RETRY_STATUS.has(error.status) || error.status >= 500;
    return { ok: false, retry, error: e };
  }
  return {
    ok: false,
    retry: true,
    error: { code: 'UNKNOWN', message: error instanceof Error ? error.message : 'Error' },
  };
}

async function sendOverRest(op: OutboxOp): Promise<SendResult> {
  try {
    const data = await apiFetch(op.path, {
      method: op.method,
      body: op.body,
      headers: { 'Idempotency-Key': op.idempotencyKey },
    });
    return { ok: true, data };
  } catch (error) {
    return classify(error);
  }
}

export const outbox = createOutbox({ store: dexieStore(), send: sendOverRest });

let started = false;

/** Arranca la cola una sola vez: envía lo que quedó de la sesión anterior y escucha la red. */
export function startOutbox(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  requestPersistentStorage();
  void outbox.flush();
  window.addEventListener('online', () => void outbox.retryNow());
  // Docs/09 §9: avisar antes de cerrar con acciones sin enviar
  window.addEventListener('beforeunload', (event) => {
    if (outbox.getSnapshot().pending.length > 0) event.preventDefault();
  });
}

/**
 * Encola una acción operativa y devuelve su resultado: se cumple cuando el servidor la aplica,
 * falla con OutboxRejectedError si la rechaza y, sin conexión, espera a que vuelva.
 */
export async function submitOperation<T>(
  input: Omit<NewOutboxOp, 'idempotencyKey' | 'userId' | 'deviceId'>,
): Promise<T> {
  startOutbox();
  const { result } = await outbox.enqueue<T>({
    ...input,
    idempotencyKey: newId(),
    userId: sessionStore.getSession()?.user.id ?? null,
    deviceId: sessionStore.getDevice()?.deviceId ?? null,
  });
  return result;
}

export type OperationOutcome<T> = { status: 'applied'; data: T } | { status: 'queued' };

/**
 * Como submitOperation, pero no se queda esperando sin conexión: devuelve `queued` en cuanto el
 * primer intento falla por la red (la acción sigue en la cola y se envía sola al volver).
 * Si el servidor la rechaza, lanza OutboxRejectedError.
 */
export async function runOperation<T>(
  input: Omit<NewOutboxOp, 'idempotencyKey' | 'userId' | 'deviceId'>,
): Promise<OperationOutcome<T>> {
  startOutbox();
  const { seq, result } = await outbox.enqueue<T>({
    ...input,
    idempotencyKey: newId(),
    userId: sessionStore.getSession()?.user.id ?? null,
    deviceId: sessionStore.getDevice()?.deviceId ?? null,
  });
  let unsubscribe = () => {};
  const queued = new Promise<OperationOutcome<T>>((resolve) => {
    const check = () => {
      const op = outbox.getSnapshot().pending.find((o) => o.seq === seq);
      if (op && op.attempts > 0) resolve({ status: 'queued' });
    };
    unsubscribe = outbox.subscribe(check);
    check();
  });
  try {
    return await Promise.race([
      result.then((data): OperationOutcome<T> => ({ status: 'applied', data })),
      queued,
    ]);
  } finally {
    unsubscribe();
  }
}

export function useOutbox(): OutboxSnapshot {
  startOutbox();
  return useSyncExternalStore(
    (listener) => outbox.subscribe(listener),
    () => outbox.getSnapshot(),
    () => outbox.getSnapshot(),
  );
}
