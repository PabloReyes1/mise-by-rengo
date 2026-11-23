// core/realtime: cliente Socket.IO (Docs/08 §3, ADR-004). Dueño: Deniscito.
// Una sola conexión por pestaña, abierta mientras hay sesión. Guarda el último seq por dispositivo
// para que al reconectar el servidor reenvíe lo perdido (o pida recargar todo con resync.required).
// Los módulos escuchan con useRealtimeEvents y deciden qué volver a leer.
import {
  REALTIME_CHANNEL,
  REALTIME_EVENTS,
  REALTIME_PATH,
  type RealtimeEnvelope,
} from '@mise/shared/contracts/realtime';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import { sessionStore } from '../session/index.js';

export { REALTIME_EVENTS };
export type { RealtimeEnvelope };

type Listener = (envelope: RealtimeEnvelope) => void;

const seqKey = (deviceId: string) => `mise.realtime.lastSeq.${deviceId}`;

function readSeq(deviceId: string): number | undefined {
  const raw = localStorage.getItem(seqKey(deviceId));
  const n = raw === null ? NaN : Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function createRealtime() {
  let socket: Socket | null = null;
  let connectedAs: string | null = null;
  let connected = false;
  const listeners = new Set<Listener>();
  const statusListeners = new Set<() => void>();
  const setConnected = (value: boolean) => {
    connected = value;
    statusListeners.forEach((l) => l());
  };

  const deliver = (envelope: RealtimeEnvelope) => {
    const deviceId = sessionStore.getDevice()?.deviceId;
    if (deviceId && envelope.event !== REALTIME_EVENTS.resyncRequired) {
      const last = readSeq(deviceId) ?? 0;
      if (envelope.seq > last) localStorage.setItem(seqKey(deviceId), String(envelope.seq));
    }
    listeners.forEach((l) => l(envelope));
  };

  const store = {
    /** Abre o cierra la conexión según haya sesión (se llama al cambiar la sesión). */
    sync() {
      const session = sessionStore.getSession();
      const device = sessionStore.getDevice();
      const who = session && device ? `${device.deviceId}:${session.user.id}` : null;
      if (who === connectedAs) return;
      socket?.close();
      socket = null;
      connectedAs = who;
      setConnected(false);
      if (!who || typeof window === 'undefined') return;

      socket = io('/', {
        path: REALTIME_PATH,
        // Se arma en cada (re)conexión: siempre con el token vigente y el último seq
        auth: (cb) => {
          const s = sessionStore.getSession();
          const d = sessionStore.getDevice();
          const lastSeq = d ? readSeq(d.deviceId) : undefined;
          cb({
            token: s?.accessToken ?? '',
            deviceId: d?.deviceId ?? '',
            ...(lastSeq ? { lastSeq } : {}),
          });
        },
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30_000,
        randomizationFactor: 0.5,
      });
      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));
      socket.on(REALTIME_CHANNEL, deliver);
      socket.on('connect_error', (error) => {
        setConnected(false);
        // Token vencido: se refresca y se vuelve a intentar (las reconexiones automáticas siguen)
        if (error.message === 'TOKEN_EXPIRED' || error.message === 'UNAUTHENTICATED') {
          void sessionStore.refresh().then((ok) => {
            if (ok) socket?.connect();
          });
        }
      });
    },
    isConnected: () => connected,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeStatus(listener: () => void) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    /** Solo pruebas */
    deliver,
  };
  return store;
}

export const realtime = createRealtime();

/** Mantiene la conexión al día con la sesión. Se usa una vez, en el marco de la app. */
export function useRealtimeConnection(): void {
  useEffect(() => {
    realtime.sync();
    const unsubscribe = sessionStore.subscribe(() => realtime.sync());
    return () => {
      unsubscribe();
    };
  }, []);
}

/** ¿Hay conexión en tiempo real ahora? */
export function useRealtimeConnected(): boolean {
  return useSyncExternalStore(
    (l) => realtime.subscribeStatus(l),
    () => realtime.isConnected(),
    () => false,
  );
}

/** Escucha los eventos; `handler` puede cambiar en cada render sin reconectar. */
export function useRealtimeEvents(handler: Listener): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const unsubscribe = realtime.subscribe((e) => ref.current(e));
    return () => {
      unsubscribe();
    };
  }, []);
}
