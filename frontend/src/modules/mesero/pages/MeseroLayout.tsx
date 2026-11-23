// Marco del mesero: escucha el tiempo real una sola vez y muestra el aviso persistente de pedidos
// listos sobre cualquier pantalla (Docs/05 paso 8, #16). Reasignado a Deniscito (doc 17 §3.1).
import type { KdsOrder } from '@mise/shared/contracts/kitchen';
import { BellRing } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { REALTIME_EVENTS, useRealtimeEvents } from '../../../core/realtime/index.js';
import { useSession } from '../../../core/session/index.js';
import { useMeseroRealtime } from '../api/realtime-sync.js';
import { notifyReady, readyAlerts, useReadyAlerts } from '../hooks/ready-alerts.js';

export function MeseroLayout() {
  useMeseroRealtime();
  const session = useSession();
  const alerts = useReadyAlerts();

  useRealtimeEvents((e) => {
    const order = e.data as Partial<KdsOrder> | null;
    if (!order?.id) return;
    if (e.event === REALTIME_EVENTS.orderReady && order.waiterId === session?.user.id) {
      if (readyAlerts.add(order as KdsOrder)) notifyReady();
    }
    if (e.event === REALTIME_EVENTS.orderDelivered || e.event === REALTIME_EVENTS.orderRecalled)
      readyAlerts.remove(order.id);
  });

  return (
    <div className="flex w-full flex-col gap-4">
      {alerts.length > 0 && (
        <section
          role="alert"
          aria-label="Pedidos listos"
          className="sticky top-0 z-20 mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-md bg-success p-3 text-white shadow-overlay"
        >
          {alerts.map((a) => (
            <Link
              key={a.orderId}
              to={`/mesero/ocupacion/${a.occupancyId}`}
              className="flex min-h-12 items-center gap-3 rounded-sm px-2 text-lg font-bold text-white no-underline hover:bg-white/10"
            >
              <BellRing aria-hidden className="size-6 shrink-0" />
              <span className="min-w-0 flex-1">
                Listo para entregar: {a.where}
                {a.roundNumber >= 2 ? ` (ronda ${a.roundNumber})` : ''}
              </span>
              <span className="shrink-0 text-base underline underline-offset-4">Ver</span>
            </Link>
          ))}
        </section>
      )}
      <Outlet />
    </div>
  );
}
