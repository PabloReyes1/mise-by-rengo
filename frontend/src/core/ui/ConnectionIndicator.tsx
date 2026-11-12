// Indicador de conexión (Docs/09 §9, Docs/18 §5.3): color + ícono + texto, nunca solo color.
// warning sobre fondo claro no llega a 3:1, así que cada ícono va dentro de un círculo de su color
// (blanco sobre success/error, primary sobre warning) y el texto siempre es primary.
import { Wifi, WifiHigh, WifiOff } from 'lucide-react';
import { cx } from './cx.js';

export type ConnectionStatus = 'online' | 'unstable' | 'offline';

const STATES = {
  online: { label: 'En línea', Icon: Wifi, badge: 'bg-success text-white' },
  unstable: { label: 'Inestable', Icon: WifiHigh, badge: 'bg-warning text-primary' },
  offline: { label: 'Sin conexión', Icon: WifiOff, badge: 'bg-error text-white' },
} as const;

export interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  /** Operaciones guardadas en la outbox que faltan por enviar (Docs/09) */
  pending?: number;
  className?: string;
}

export function ConnectionIndicator({ status, pending = 0, className }: ConnectionIndicatorProps) {
  const { label, Icon, badge } = STATES[status];
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx('inline-flex items-center gap-2 text-sm font-semibold text-primary', className)}
    >
      <span
        aria-hidden
        className={cx('flex size-6 items-center justify-center rounded-full', badge)}
      >
        <Icon className="size-4" strokeWidth={2.5} />
      </span>
      <span>{label}</span>
      {pending > 0 && (
        <span className="rounded-full bg-accent px-2 text-xs font-bold leading-5 tabular">
          {pending} pendiente{pending === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}
