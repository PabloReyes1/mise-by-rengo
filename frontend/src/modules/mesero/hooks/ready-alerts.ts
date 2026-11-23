// Avisos de "pedido listo" para el mesero (Docs/05 paso 8, #16 del plan). Reasignado a Deniscito.
// Llegan por tiempo real a la sala del mesero (order.ready); se guardan en el dispositivo para que
// sigan visibles al recargar, y se quitan al entregar o si cocina lo regresa (recall).
import type { KdsOrder } from '@mise/shared/contracts/kitchen';
import { useSyncExternalStore } from 'react';

export interface ReadyAlert {
  orderId: string;
  occupancyId: string;
  /** "Mesa 9 · Salón" o "Para llevar · Luis" */
  where: string;
  roundNumber: number;
  readyAt: string;
}

const KEY = 'mise.mesero.readyAlerts';

function read(): ReadyAlert[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as ReadyAlert[];
  } catch {
    return [];
  }
}

function createStore() {
  let alerts = read();
  const listeners = new Set<() => void>();
  const write = (next: ReadyAlert[]) => {
    alerts = next;
    localStorage.setItem(KEY, JSON.stringify(next));
    listeners.forEach((l) => l());
  };
  return {
    list: () => alerts,
    add(order: KdsOrder) {
      if (alerts.some((a) => a.orderId === order.id)) return false;
      write([
        ...alerts,
        {
          orderId: order.id,
          occupancyId: order.occupancyId,
          where: order.table
            ? `Mesa ${order.table}`
            : `Para llevar${order.customerName ? ` · ${order.customerName}` : ''}`,
          roundNumber: order.roundNumber,
          readyAt: order.readyAt ?? new Date().toISOString(),
        },
      ]);
      return true;
    },
    remove(orderId: string) {
      if (alerts.some((a) => a.orderId === orderId))
        write(alerts.filter((a) => a.orderId !== orderId));
    },
    clear: () => write([]),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const readyAlerts = createStore();

export function useReadyAlerts(): ReadyAlert[] {
  return useSyncExternalStore(
    (l) => readyAlerts.subscribe(l),
    () => readyAlerts.list(),
    () => [],
  );
}

/** Sonido corto + vibración (navigator.vibrate no existe en iPhone: ahí solo suena). */
export function notifyReady(): void {
  try {
    navigator.vibrate?.([200, 100, 200, 100, 300]);
  } catch {
    // sin vibración
  }
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 988;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
    osc.onended = () => void ctx.close();
  } catch {
    // el navegador no dejó sonar
  }
}
