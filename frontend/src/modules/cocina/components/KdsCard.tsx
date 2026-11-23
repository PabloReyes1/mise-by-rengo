// Tarjeta de un pedido en el KDS (Docs/05 pasos 5 a 7, Docs/18 §5.2): franja de color con el
// tiempo en texto grande y negrita, borde primary, ítems en grande; tocar un ítem lo marca listo.
// Los cancelados se ven tachados con "CANCELADO". El estado nunca va solo en color.
import type { KdsOrder } from '@mise/shared/contracts/kitchen';
import { Check, ChefHat, Undo2 } from 'lucide-react';
import { Button, cx } from '../../../core/ui/index.js';
import { minutesSince, urgency, URGENCY } from '../hooks/kds-timing.js';

export interface KdsCardProps {
  order: KdsOrder;
  now: number;
  busy: boolean;
  onAccept: () => void;
  onReady: () => void;
  onItemReady: (itemId: string) => void;
  onRecall: () => void;
}

export function KdsCard({
  order,
  now,
  busy,
  onAccept,
  onReady,
  onItemReady,
  onRecall,
}: KdsCardProps) {
  // El tiempo corre desde que se envió (kds_thresholds.from = SENT, Docs/07)
  const minutes = minutesSince(order.sentAt, now);
  const u = URGENCY[order.status === 'LISTO' ? 'onTime' : urgency(minutes)];
  const where = order.table
    ? `Mesa ${order.table}`
    : `PARA LLEVAR${order.customerName ? ` · ${order.customerName}` : ''}`;
  const live = order.items.filter((i) => i.status !== 'CANCELADO');

  return (
    <article
      aria-label={`${where}, orden ${order.folio ?? order.tempFolio}`}
      className="flex flex-col overflow-hidden rounded-md border-2 border-primary bg-background"
    >
      <div className={cx('flex items-center justify-between gap-2 px-3 py-2', u.bar)}>
        <span className="text-2xl font-bold tabular">{minutes} min</span>
        <span className="text-lg font-bold">{order.status === 'LISTO' ? 'Listo' : u.label}</span>
      </div>
      <div className="flex flex-col gap-1 border-b border-accent px-3 py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-bold">{where}</h3>
          <span className="text-base font-semibold tabular">#{order.folio ?? order.tempFolio}</span>
        </div>
        <p className="text-sm">
          {order.waiterName}
          {order.roundNumber >= 2 && (
            <span className="ml-2 font-bold">· ADICIONAL (ronda {order.roundNumber})</span>
          )}
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-accent">
        {order.items.map((i) => {
          const cancelled = i.status === 'CANCELADO';
          const ready = i.status === 'LISTO' || i.status === 'ENTREGADO';
          const canMark = !cancelled && !ready && order.status !== 'LISTO';
          return (
            <li key={i.id}>
              <button
                type="button"
                disabled={!canMark || busy}
                onClick={() => onItemReady(i.id)}
                aria-label={`${i.quantity} ${i.productName}${cancelled ? ', cancelado' : ready ? ', listo' : ', marcar listo'}`}
                className={cx(
                  'flex w-full items-start gap-3 px-3 py-2 text-left',
                  canMark && 'hover:bg-surface',
                  (ready || cancelled) && 'text-secondary',
                )}
              >
                <span
                  className={cx(
                    'text-xl font-bold tabular',
                    (ready || cancelled) && 'line-through',
                  )}
                >
                  {i.quantity}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cx('text-lg font-bold', (ready || cancelled) && 'line-through')}>
                    {i.productName}
                  </span>
                  {i.modifiers.map((m) => (
                    <span key={m.modifierId} className="text-base">
                      › {m.name}
                    </span>
                  ))}
                  {i.components.map((c) => (
                    <span key={`${c.comboGroupId}-${c.productId}`} className="text-base">
                      – {c.name}
                      {c.modifiers.length > 0 && ` (${c.modifiers.map((m) => m.name).join(', ')})`}
                    </span>
                  ))}
                  {i.note && (
                    <span className="mt-1 rounded-sm bg-surface px-2 py-1 text-base font-bold">
                      Nota: {i.note}
                    </span>
                  )}
                  {cancelled && <span className="text-base font-bold text-error">CANCELADO</span>}
                </span>
                {ready && <Check aria-hidden className="size-6 shrink-0 text-success" />}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col gap-2 p-3">
        {order.status === 'ENVIADO' && (
          <Button size="lg" fullWidth icon={<ChefHat />} loading={busy} onClick={onAccept}>
            Aceptar
          </Button>
        )}
        {order.status === 'EN_PREPARACION' && live.length > 0 && (
          <Button size="lg" fullWidth icon={<Check />} loading={busy} onClick={onReady}>
            Pedido listo
          </Button>
        )}
        {order.status === 'LISTO' && (
          <Button variant="outline" fullWidth icon={<Undo2 />} loading={busy} onClick={onRecall}>
            Regresar a preparación
          </Button>
        )}
      </div>
    </article>
  );
}
