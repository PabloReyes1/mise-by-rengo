// Sesión del dispositivo y del usuario (ADR-008, Docs/03 §6).
// - Dispositivo emparejado: dura hasta que lo revoquen.
// - Sesión del usuario: token de 15 min que se refresca solo; vence tras 12 h sin actividad.
// Se guardan en localStorage para sobrevivir a recargas (SC-13).
import type { DeviceType, PairDeviceResponse, SessionResponse } from '@mise/shared/contracts/auth';
import { useSyncExternalStore } from 'react';
import { apiFetch, configureApi } from '../api/index.js';

/** Dispositivo emparejado; el nombre se guarda solo en este equipo */
export type Device = PairDeviceResponse & { name?: string };
export type Session = SessionResponse;

const DEVICE_KEY = 'mise.device';
const SESSION_KEY = 'mise.session';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
}

function createSessionStore() {
  let device = read<Device>(DEVICE_KEY);
  let session = read<Session>(SESSION_KEY);
  let refreshing: Promise<boolean> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const store = {
    getDevice: () => device,
    getSession: () => session,

    setDevice(next: Device | null) {
      device = next;
      write(DEVICE_KEY, next);
      emit();
    },
    setSession(next: Session | null) {
      session = next;
      write(SESSION_KEY, next);
      emit();
    },
    clearSession() {
      store.setSession(null);
    },
    /** Vuelve a leer localStorage (pruebas y cambios en otra pestaña) */
    reset() {
      device = read<Device>(DEVICE_KEY);
      session = read<Session>(SESSION_KEY);
      refreshing = null;
      emit();
    },

    headers(): Record<string, string> {
      const h: Record<string, string> = {};
      if (session) h['Authorization'] = `Bearer ${session.accessToken}`;
      if (device) {
        h['X-Device-Id'] = device.deviceId;
        h['X-Device-Token'] = device.deviceToken;
        h['X-Branch-Id'] = device.branchId;
      }
      return h;
    },

    /** Un solo refresco a la vez aunque varias peticiones venzan juntas. */
    refresh(): Promise<boolean> {
      if (!session) return Promise.resolve(false);
      refreshing ??= apiFetch<Session>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: session.refreshToken },
        skipRefresh: true,
      })
        .then((next) => {
          store.setSession(next);
          return true;
        })
        .catch(() => {
          store.clearSession();
          return false;
        })
        .finally(() => {
          refreshing = null;
        });
      return refreshing;
    },

    async logout() {
      const current = session;
      store.clearSession();
      if (current) {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: { refreshToken: current.refreshToken },
          headers: { Authorization: `Bearer ${current.accessToken}` },
          skipRefresh: true,
        }).catch(() => undefined);
      }
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return store;
}

export const sessionStore = createSessionStore();

configureApi({
  getHeaders: () => sessionStore.headers(),
  onTokenExpired: () => sessionStore.refresh(),
});

export function useDevice(): Device | null {
  return useSyncExternalStore(
    (listener) => sessionStore.subscribe(listener),
    () => sessionStore.getDevice(),
    () => null,
  );
}

export function useSession(): Session | null {
  return useSyncExternalStore(
    (listener) => sessionStore.subscribe(listener),
    () => sessionStore.getSession(),
    () => null,
  );
}

export function hasPermission(session: Session | null, permission: string): boolean {
  return session?.permissions.includes(permission) ?? false;
}

/** Área inicial según el tipo de dispositivo (Docs/06 §3.4). */
export function homePathFor(type: DeviceType): string {
  return { WAITER: '/mesero', CASH: '/caja', KDS: '/kds', ADMIN: '/admin' }[type];
}
