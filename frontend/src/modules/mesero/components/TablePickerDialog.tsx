// Elegir una mesa: libre para trasladar (RF-106) u ocupada para unir (RF-105).
import type { FloorTable } from '@mise/shared/contracts/floor';
import { Modal } from '../../../core/ui/index.js';

export interface TablePickerDialogProps {
  open: boolean;
  title: string;
  description: string;
  tables: FloorTable[];
  emptyText: string;
  onPick: (table: FloorTable) => void;
  onClose: () => void;
}

export function TablePickerDialog({
  open,
  title,
  description,
  tables,
  emptyText,
  onPick,
  onClose,
}: TablePickerDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      {tables.length === 0 ? (
        <p className="text-base">{emptyText}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {tables.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPick(t)}
                className="flex min-h-16 w-full flex-col items-center justify-center rounded-md border border-secondary bg-background px-2 py-2 hover:bg-surface"
              >
                <span className="text-xl font-bold tabular">{t.name}</span>
                <span className="text-xs text-secondary">
                  {t.occupancy ? `${t.occupancy.guests} pers.` : `${t.capacity} lugares`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
