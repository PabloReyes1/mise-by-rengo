// Tiempo real en el mesero (Docs/08 §3.1). Reasignado a Deniscito (doc 17 §3.1).
// Cada evento de mesas, pedidos o cuentas vuelve a leer lo que cambió. El sondeo queda solo de
// respaldo: cada 60 s con tiempo real y cada 10 s sin él (SC-39).
import { useQueryClient } from '@tanstack/react-query';
import { realtime, REALTIME_EVENTS, useRealtimeEvents } from '../../../core/realtime/index.js';

/** Intervalo de sondeo según haya o no tiempo real. */
export const pollInterval = () => (realtime.isConnected() ? 60_000 : 10_000);

export function useMeseroRealtime(): void {
  const qc = useQueryClient();
  useRealtimeEvents((e) => {
    if (e.event === REALTIME_EVENTS.resyncRequired) {
      void qc.invalidateQueries();
      return;
    }
    const [area] = e.event.split('.');
    if (area === 'occupancy' || area === 'order' || area === 'bill') {
      void qc.invalidateQueries({ queryKey: ['floor'] });
      void qc.invalidateQueries({ queryKey: ['occupancies'] });
      // Detalle de la mesa, sus pedidos y sus cuentas
      void qc.invalidateQueries({ queryKey: ['occupancy'] });
    }
    if (area === 'menu') void qc.invalidateQueries({ queryKey: ['menu'] });
  });
}
