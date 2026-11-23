// Impresoras de este dispositivo. Hasta que exista la administración de impresoras y rutas
// (H3: /api/printers y /api/devices/:id/printer-routes) se guardan solo aquí, en localStorage (SC-43).
import { useSyncExternalStore } from 'react';
import type { PrinterConfig } from './types.js';

const KEY = 'mise.printers';

function read(): PrinterConfig[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PrinterConfig[]) : [];
  } catch {
    return [];
  }
}

function createPrinterStore() {
  let printers = read();
  const listeners = new Set<() => void>();
  const write = (next: PrinterConfig[]) => {
    printers = next;
    localStorage.setItem(KEY, JSON.stringify(next));
    listeners.forEach((l) => l());
  };
  return {
    list: () => printers,
    save(printer: PrinterConfig) {
      const exists = printers.some((p) => p.id === printer.id);
      write(
        exists ? printers.map((p) => (p.id === printer.id ? printer : p)) : [...printers, printer],
      );
    },
    remove(id: string) {
      write(printers.filter((p) => p.id !== id));
    },
    /** Vuelve a leer localStorage (pruebas) */
    reset() {
      printers = read();
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const printerStore = createPrinterStore();

export function usePrinters(): PrinterConfig[] {
  return useSyncExternalStore(
    (l) => printerStore.subscribe(l),
    () => printerStore.list(),
    () => [],
  );
}
