// Detalle de una mesa abierta (o para llevar): comensales, cuentas y acciones de sala
// (trasladar, unir, transferir). Tomar el pedido llega en H2 con orders.
import type { FloorTable } from '@mise/shared/contracts/floor';
import { ArrowLeft, ArrowRightLeft, CircleAlert, Info, Link2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../../core/api/index.js';
import { useRegional } from '../../../core/config/index.js';
import { formatTime } from '../../../core/format/index.js';
import { useOutbox } from '../../../core/offline/index.js';
import { hasPermission, useSession } from '../../../core/session/index.js';
import { Badge, Button, Card, Modal, Select } from '../../../core/ui/index.js';
import {
  useBranchUsers,
  useFloor,
  useMergeOccupancy,
  useMoveOccupancy,
  useOccupancy,
  useTransferOccupancy,
  useUpdateGuests,
} from '../api/floor-api.js';
import { actionError, QUEUED_MESSAGE } from '../components/errors.js';
import { GuestsStepper } from '../components/GuestsStepper.js';
import { TablePickerDialog } from '../components/TablePickerDialog.js';

type Dialog = 'move' | 'merge' | 'transfer' | 'guests' | null;

export function OccupancyPage() {
  const { id = '' } = useParams();
  const occupancy = useOccupancy(id);
  const floor = useFloor();
  const session = useSession();
  const regional = useRegional();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const queue = useOutbox();

  const move = useMoveOccupancy();
  const merge = useMergeOccupancy();
  const transfer = useTransferOccupancy();
  const guests = useUpdateGuests();
  const error = actionError(move.error ?? merge.error ?? transfer.error ?? guests.error);

  const back = (
    <Link to="/mesero" className="flex min-h-12 items-center gap-2 self-start font-semibold">
      <ArrowLeft aria-hidden className="size-5" /> Mesas
    </Link>
  );

  if (occupancy.isPending) return <p className="text-base text-secondary">Cargando…</p>;
  if (occupancy.isError) {
    const forbidden =
      occupancy.error instanceof ApiError && occupancy.error.code === 'AUTHORIZATION_REQUIRED';
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        {back}
        <p role="alert" className="text-base">
          {forbidden ? 'Esta mesa la atiende otro mesero.' : 'No se pudo cargar la mesa.'}
        </p>
      </div>
    );
  }

  const occ = occupancy.data;
  const tables = floor.data?.zones.flatMap((z) => z.tables) ?? [];
  const table = tables.find((t) => t.id === occ.tableId);
  const title = table
    ? ['Mesa', [table.name, ...occ.mergedTables.map((t) => t.name)].join(' + ')].join(' ')
    : `Para llevar${occ.customerName ? `: ${occ.customerName}` : ''}`;
  const isOpen = occ.status === 'ABIERTA';
  const done = (outcome: { status: 'applied' | 'queued' }) => {
    setDialog(null);
    setNotice(outcome.status === 'queued' ? QUEUED_MESSAGE : null);
  };
  const reset = () => {
    for (const m of [move, merge, transfer, guests]) m.reset();
    setNotice(null);
  };
  const openDialog = (d: Dialog) => {
    reset();
    setDialog(d);
  };

  const freeTables = tables.filter((t) => t.status === 'LIBRE');
  const mergeable = tables.filter(
    (t): t is FloorTable & { occupancy: NonNullable<FloorTable['occupancy']> } =>
      t.status === 'OCUPADA' && t.occupancy !== null && t.occupancy.id !== occ.id,
  );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      {back}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold">{title}</h2>
          {!isOpen && <Badge>{occ.status === 'FUSIONADA' ? 'Unida a otra mesa' : 'Cerrada'}</Badge>}
        </div>
        <p className="text-base text-secondary tabular">
          Abierta a las {formatTime(occ.openedAt, regional)} · Atiende {occ.waiterName}
          {occ.customerPhone ? ` · Tel. ${occ.customerPhone}` : ''}
        </p>
      </header>

      {notice && queue.pending.length > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-md bg-surface p-3 text-base">
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-secondary" />
          <span>{notice}</span>
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-2 text-base">
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-error" />
          <span>{error}</span>
        </p>
      )}

      <Card className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Comensales</span>
          <span className="text-2xl font-bold tabular">{occ.guests}</span>
        </div>
        {isOpen && (
          <Button variant="outline" onClick={() => openDialog('guests')}>
            Cambiar
          </Button>
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-bold">Cuentas</h3>
        <ul className="flex flex-col gap-2">
          {occ.bills.map((b) => (
            <li
              key={b.id}
              className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-accent px-4"
            >
              <span className="font-semibold">{b.name}</span>
              <Badge>{b.status === 'ABIERTA' ? 'Abierta' : b.status}</Badge>
            </li>
          ))}
        </ul>
      </section>

      {isOpen && (
        <section className="flex flex-col gap-3">
          <Button size="lg" disabled fullWidth>
            Tomar pedido (llega en H2)
          </Button>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            {occ.tableId && (
              <Button
                variant="outline"
                icon={<ArrowRightLeft />}
                onClick={() => openDialog('move')}
              >
                Trasladar
              </Button>
            )}
            {occ.tableId && (
              <Button variant="outline" icon={<Link2 />} onClick={() => openDialog('merge')}>
                Unir otra mesa
              </Button>
            )}
            {hasPermission(session, 'table.transfer_waiter') && (
              <Button variant="outline" icon={<UserRound />} onClick={() => openDialog('transfer')}>
                Transferir
              </Button>
            )}
          </div>
        </section>
      )}

      <TablePickerDialog
        open={dialog === 'move'}
        title="Trasladar a otra mesa"
        description="Elige una mesa libre. La actual queda libre."
        tables={freeTables}
        emptyText="No hay mesas libres."
        onClose={() => setDialog(null)}
        onPick={(t) =>
          move.mutate(
            { id: occ.id, targetTableId: t.id, tableName: t.name },
            { onSuccess: done, onError: () => setDialog(null) },
          )
        }
      />
      <TablePickerDialog
        open={dialog === 'merge'}
        title="Unir otra mesa"
        description="Sus cuentas y comensales pasan a esta mesa."
        tables={mergeable}
        emptyText="No hay otras mesas ocupadas."
        onClose={() => setDialog(null)}
        onPick={(t) =>
          merge.mutate(
            { id: occ.id, sourceOccupancyId: t.occupancy!.id, tableName: t.name },
            { onSuccess: done, onError: () => setDialog(null) },
          )
        }
      />
      <GuestsDialog
        key={`${occ.version}-${dialog === 'guests'}`}
        open={dialog === 'guests'}
        initial={occ.guests}
        loading={guests.isPending}
        onClose={() => setDialog(null)}
        onSave={(n) =>
          guests.mutate(
            { id: occ.id, guests: n, version: occ.version },
            { onSuccess: done, onError: () => setDialog(null) },
          )
        }
      />
      <TransferDialog
        open={dialog === 'transfer'}
        currentWaiterId={occ.waiterId}
        loading={transfer.isPending}
        onClose={() => setDialog(null)}
        onSave={(waiterId, waiterName) =>
          transfer.mutate(
            { id: occ.id, waiterId, waiterName },
            { onSuccess: done, onError: () => setDialog(null) },
          )
        }
      />
    </div>
  );
}

function GuestsDialog({
  open,
  initial,
  loading,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: number;
  loading: boolean;
  onClose: () => void;
  onSave: (guests: number) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cambiar comensales"
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={loading} onClick={() => onSave(value)}>
            Guardar
          </Button>
        </>
      }
    >
      {open && <GuestsStepper value={value} onChange={setValue} />}
    </Modal>
  );
}

function TransferDialog({
  open,
  currentWaiterId,
  loading,
  onClose,
  onSave,
}: {
  open: boolean;
  currentWaiterId: string;
  loading: boolean;
  onClose: () => void;
  onSave: (waiterId: string, waiterName: string) => void;
}) {
  const users = useBranchUsers();
  const options = (users.data ?? []).filter((u) => u.id !== currentWaiterId);
  const [waiterId, setWaiterId] = useState('');
  const chosen = options.find((u) => u.id === waiterId);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transferir a otro mesero"
      description="El nuevo mesero recibe los avisos de esta mesa."
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={loading}
            disabled={!chosen}
            onClick={() => chosen && onSave(chosen.id, chosen.fullName)}
          >
            Transferir
          </Button>
        </>
      }
    >
      {options.length === 0 ? (
        <p className="text-base">No hay otros meseros con PIN en esta sucursal.</p>
      ) : (
        <Select
          label="Mesero"
          value={waiterId}
          onChange={(e) => setWaiterId(e.target.value)}
          options={[
            { value: '', label: 'Elige un mesero' },
            ...options.map((u) => ({ value: u.id, label: u.fullName })),
          ]}
        />
      )}
    </Modal>
  );
}
