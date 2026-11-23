// Abrir mesa (Docs/05 paso 2): solo se piden los comensales; el mesero es quien abre.
import type { FloorTable, Occupancy } from '@mise/shared/contracts/floor';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button, Modal } from '../../../core/ui/index.js';
import { useAuthorizedAction } from '../api/authorized-action.js';
import { useOpenTable } from '../api/floor-api.js';
import { actionError } from './errors.js';
import { GuestsStepper } from './GuestsStepper.js';

export interface OpenTableDialogProps {
  table: FloorTable | null;
  onClose: () => void;
  /** Se abrió en el servidor: ir a la mesa */
  onOpened: (occupancy: Occupancy) => void;
  /** Sin conexión: quedó en la cola */
  onQueued: () => void;
}

export function OpenTableDialog({ table, onClose, onOpened, onQueued }: OpenTableDialogProps) {
  return (
    <Modal
      open={table !== null}
      onClose={onClose}
      title={table ? `Abrir mesa ${table.name}` : 'Abrir mesa'}
      description={table ? `${table.capacity} lugares` : undefined}
    >
      {/* key: cada mesa empieza con sus propios valores */}
      {table && (
        <OpenTableForm
          key={table.id}
          table={table}
          onClose={onClose}
          onOpened={onOpened}
          onQueued={onQueued}
        />
      )}
    </Modal>
  );
}

function OpenTableForm({
  table,
  onClose,
  onOpened,
  onQueued,
}: OpenTableDialogProps & { table: FloorTable }) {
  const [guests, setGuests] = useState(Math.min(table.capacity, 99));
  const open = useOpenTable();
  const authorized = useAuthorizedAction();
  const error = actionError(open.error);

  const submit = () => {
    authorized.run(
      open,
      { tableId: table.id, tableName: table.name, orderTypeCode: 'MESA', guests },
      `Abrir la mesa ${table.name}`,
      { onDone: (outcome) => (outcome.status === 'applied' ? onOpened(outcome.data) : onQueued()) },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <GuestsStepper value={guests} onChange={setGuests} />
      {error && (
        <p role="alert" className="flex items-start gap-2 text-base">
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-error" />
          <span>{error}</span>
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button size="lg" loading={open.isPending} onClick={submit}>
          Abrir mesa
        </Button>
      </div>
      {/* La ventana 🔑 se abre encima de esta (diálogos nativos apilados) */}
      {authorized.dialog}
    </div>
  );
}
