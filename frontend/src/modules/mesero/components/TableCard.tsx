// Tarjeta de una mesa en el mapa (RF-109, Docs/18 §5.1): color + ícono + texto, nunca solo color.
// Estados derivados de una mesa ocupada (service): lista, con pedido en cocina, pre-cuenta.
import type { FloorTable } from '@mise/shared/contracts/floor';
import { Armchair, BellRing, ChefHat, Link2, Lock, Receipt, Users } from 'lucide-react';
import { cx } from '../../../core/ui/index.js';

const STATE = {
  LIBRE: {
    label: 'Libre',
    Icon: Armchair,
    card: 'bg-background border-2 border-accent text-primary',
    meta: 'text-secondary',
  },
  OCUPADA: {
    label: 'Ocupada',
    Icon: Users,
    card: 'bg-secondary border-2 border-secondary text-white',
    meta: 'text-white',
  },
  UNIDA: {
    label: 'Unida',
    Icon: Link2,
    card: 'bg-surface border-2 border-dashed border-secondary text-primary',
    meta: 'text-primary',
  },
  // Docs/18 §5.1 propone texto accent; se usa primary para cumplir el contraste (SC-37)
  BLOQUEADA: {
    label: 'Bloqueada',
    Icon: Lock,
    card: 'bg-surface border-2 border-surface text-primary',
    meta: 'text-primary',
  },
} as const;

/** Docs/18 §5.1 (reasignado a Deniscito, doc 17 §3.1). Siempre con texto e ícono. */
const SERVICE = {
  EN_COCINA: {
    label: 'Con pedido en cocina',
    Icon: ChefHat,
    card: 'bg-surface border-2 border-warning text-primary',
    meta: 'text-primary',
  },
  LISTA: {
    label: 'Lista para entregar',
    Icon: BellRing,
    card: 'bg-success border-2 border-success text-white',
    meta: 'text-white',
  },
  PRECUENTA: {
    label: 'Pre-cuenta impresa',
    Icon: Receipt,
    card: 'bg-accent border-2 border-accent text-primary',
    meta: 'text-primary',
  },
} as const;

export interface TableCardProps {
  table: FloorTable;
  /** Mesa de otro mesero: se ve, pero se marca */
  isMine: boolean;
  onSelect: (table: FloorTable) => void;
}

export function TableCard({ table, isMine, onSelect }: TableCardProps) {
  const { label, Icon, card, meta } =
    table.status === 'OCUPADA' && table.service ? SERVICE[table.service] : STATE[table.status];
  const occ = table.occupancy;
  const blocked = table.status === 'BLOQUEADA';
  const detail =
    table.status === 'UNIDA' && table.joinedTo
      ? `Unida a ${table.joinedTo.tableName}`
      : occ
        ? `${occ.guests} ${occ.guests === 1 ? 'persona' : 'personas'}`
        : `${table.capacity} lugares`;

  return (
    <button
      type="button"
      disabled={blocked}
      aria-disabled={blocked || undefined}
      onClick={() => onSelect(table)}
      aria-label={`Mesa ${table.name}, ${label}. ${detail}${occ ? `. Atiende ${occ.waiterName}` : ''}`}
      className={cx(
        'flex min-h-28 w-full flex-col items-start gap-1 rounded-md p-3 text-left',
        'transition-transform duration-150 ease-out active:scale-[0.97]',
        blocked && 'cursor-not-allowed active:scale-100',
        card,
      )}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="text-2xl font-bold leading-none tabular">{table.name}</span>
        <Icon aria-hidden className="size-5 shrink-0" />
      </span>
      <span className="text-sm font-bold">{label}</span>
      <span className={cx('text-sm', meta)}>{detail}</span>
      {occ && table.status === 'OCUPADA' && (
        <span className={cx('truncate text-xs font-semibold', meta)}>
          {isMine ? 'Tuya' : occ.waiterName}
        </span>
      )}
    </button>
  );
}
