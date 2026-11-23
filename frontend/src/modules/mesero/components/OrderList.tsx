// Rondas de la mesa con su estado (Docs/05 §5.3): el estado siempre en texto, nunca solo color.
import type { Order, OrderItem } from '@mise/shared/contracts/orders';
import { HandPlatter, X } from 'lucide-react';
import { useRegional } from '../../../core/config/index.js';
import { formatMoney, formatTime } from '../../../core/format/index.js';
import { Badge, Button, Card, cx, type BadgeTone } from '../../../core/ui/index.js';

export const ORDER_STATUS: Record<Order['status'], { label: string; tone: BadgeTone }> = {
  ENVIADO: { label: 'En cola de cocina', tone: 'neutral' },
  EN_PREPARACION: { label: 'Preparando', tone: 'warning' },
  LISTO: { label: 'Listo para entregar', tone: 'success' },
  ENTREGADO: { label: 'Entregado', tone: 'neutral' },
  CANCELADO: { label: 'Cancelado', tone: 'error' },
};

export interface OrderListProps {
  orders: Order[];
  /** Entregar un pedido listo; si no viene, no se muestra el botón */
  onDeliver?: (order: Order) => void;
  delivering?: string | null;
  /** Cancelar un ítem ya enviado (con motivo; 🔑 si hace falta). Si no viene, no hay botón */
  onCancelItem?: (item: OrderItem) => void;
}

export function OrderList({ orders, onDeliver, delivering, onCancelItem }: OrderListProps) {
  const regional = useRegional();
  if (orders.length === 0) {
    return <p className="text-base text-secondary">Todavía no hay pedidos en esta mesa.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {orders.map((o) => {
        const status = ORDER_STATUS[o.status];
        return (
          <li key={o.id}>
            <Card variant="outlined" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-base font-bold">
                  Ronda {o.roundNumber}
                  <span className="font-normal text-secondary tabular">
                    {' '}
                    · {o.folio ?? o.tempFolio} · {formatTime(o.sentAt, regional)}
                  </span>
                </h4>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              <ul className="flex flex-col gap-2">
                {o.items.map((i) => {
                  const cancelled = i.status === 'CANCELADO';
                  return (
                    <li key={i.id} className="flex items-start justify-between gap-3">
                      <div className={cx('flex min-w-0 flex-col', cancelled && 'text-secondary')}>
                        <span className={cx('text-base', cancelled && 'line-through')}>
                          <span className="font-semibold tabular">{i.quantity} ×</span>{' '}
                          {i.productName}
                        </span>
                        {i.modifiers.length > 0 && (
                          <span className="text-sm text-secondary">
                            {i.modifiers.map((m) => m.name).join(', ')}
                          </span>
                        )}
                        {i.components.map((c) => (
                          <span key={`${c.comboGroupId}-${c.productId}`} className="text-sm">
                            – {c.name}
                            {c.modifiers.length > 0 &&
                              ` (${c.modifiers.map((m) => m.name).join(', ')})`}
                          </span>
                        ))}
                        {i.note && <span className="text-sm">Nota: {i.note}</span>}
                        {cancelled && <span className="text-sm font-semibold">Cancelado</span>}
                      </div>
                      <span
                        className={cx(
                          'shrink-0 text-base tabular',
                          cancelled && 'text-secondary line-through',
                        )}
                      >
                        {formatMoney(i.lineTotal, regional)}
                      </span>
                      {onCancelItem && !cancelled && (
                        <button
                          type="button"
                          onClick={() => onCancelItem(i)}
                          aria-label={`Cancelar ${i.quantity} × ${i.productName}`}
                          className="-my-2 flex size-11 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-surface"
                        >
                          <X aria-hidden className="size-5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {onDeliver && o.status === 'LISTO' && (
                <Button
                  icon={<HandPlatter />}
                  loading={delivering === o.id}
                  onClick={() => onDeliver(o)}
                >
                  Marcar entregado
                </Button>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
