// KDS (Docs/05 pasos 5 a 7, RF-050 a RF-058): columnas Nuevos / En preparación / Listos, en
// orden de llegada. Se actualiza por tiempo real y suena con cada pedido nuevo. Dueño: Deniscito.
import type { KdsOrder } from '@mise/shared/contracts/kitchen';
import { useQueryClient } from '@tanstack/react-query';
import { Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import {
  REALTIME_EVENTS,
  useRealtimeConnected,
  useRealtimeEvents,
} from '../../../core/realtime/index.js';
import { Button } from '../../../core/ui/index.js';
import {
  KDS_KEY,
  useAccept,
  useItemReady,
  useKdsOrders,
  useOrderReady,
  useRecall,
} from '../api/kds-api.js';
import { KdsCard } from '../components/KdsCard.js';
import { useKdsTiming } from '../hooks/kds-timing.js';
import { useKdsSound } from '../hooks/useKdsSound.js';

const COLUMNS: { status: KdsOrder['status']; title: string }[] = [
  { status: 'ENVIADO', title: 'Nuevos' },
  { status: 'EN_PREPARACION', title: 'En preparación' },
  { status: 'LISTO', title: 'Listos' },
];

/** Reloj de la pantalla: los minutos de cada tarjeta se actualizan cada 15 s. */
function useNow(stepMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(id);
  }, [stepMs]);
  return now;
}

export function KdsPage() {
  const qc = useQueryClient();
  const orders = useKdsOrders();
  const now = useNow();
  const connected = useRealtimeConnected();
  const accept = useAccept();
  const ready = useOrderReady();
  const itemReady = useItemReady();
  const recall = useRecall();
  const list = orders.data ?? [];
  const timing = useKdsTiming();
  const sound = useKdsSound(list, timing);

  useRealtimeEvents((e) => {
    if (e.event === REALTIME_EVENTS.resyncRequired || e.event.startsWith('order.')) {
      void qc.invalidateQueries({ queryKey: KDS_KEY });
    }
    // Pedido nuevo: suena una vez
    if (e.event === REALTIME_EVENTS.orderSent) sound.play('new');
  });

  const busyId =
    (accept.isPending && accept.variables) ||
    (ready.isPending && ready.variables) ||
    (recall.isPending && recall.variables) ||
    null;
  const error = [accept, ready, itemReady, recall].map((m) => m.error).find(Boolean);

  return (
    <div className="flex w-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Cocina</h2>
        <div className="flex flex-wrap items-center gap-3">
          {!connected && (
            <span
              role="status"
              className="rounded-md bg-warning px-3 py-2 text-base font-bold text-primary"
            >
              Sin tiempo real: se actualiza cada 10 s
            </span>
          )}
          {!sound.enabled && (
            <Button variant="secondary" icon={<Volume2 />} onClick={sound.enable}>
              Activar sonido
            </Button>
          )}
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
        >
          {error instanceof ApiError ? error.message : 'No se pudo completar la acción'}
        </p>
      )}
      {orders.isPending && <p className="text-base text-secondary">Cargando pedidos…</p>}
      {orders.isError && (
        <p role="alert" className="text-base">
          No se pudo cargar la cola de cocina.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const cards = list.filter((o) => o.status === col.status);
          return (
            <section key={col.status} aria-label={col.title} className="flex flex-col gap-3">
              <h3 className="text-lg font-bold">
                {col.title} <span className="tabular text-secondary">({cards.length})</span>
              </h3>
              {cards.length === 0 && (
                <p className="rounded-md bg-surface px-4 py-6 text-base text-secondary">
                  Nada aquí.
                </p>
              )}
              {cards.map((o) => (
                <KdsCard
                  key={o.id}
                  order={o}
                  now={now}
                  timing={timing}
                  busy={busyId === o.id}
                  onAccept={() => accept.mutate(o.id)}
                  onReady={() => ready.mutate(o.id)}
                  onItemReady={(itemId) => itemReady.mutate(itemId)}
                  onRecall={() => recall.mutate(o.id)}
                />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
