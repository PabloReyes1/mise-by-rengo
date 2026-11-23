// Detalle de una mesa abierta (o para llevar): comensales, pedidos, cuentas con su total y
// acciones de sala (tomar pedido, entregar, trasladar, unir, transferir).
import type { FloorTable } from '@mise/shared/contracts/floor';
import type { OrderItem } from '@mise/shared/contracts/orders';
import {
  ArrowLeft,
  ArrowRightLeft,
  CircleAlert,
  Info,
  Link2,
  NotebookPen,
  Receipt,
  UserRound,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../../core/api/index.js';
import { useRegional } from '../../../core/config/index.js';
import { formatMoney, formatTime } from '../../../core/format/index.js';
import { useOutbox } from '../../../core/offline/index.js';
import { useSession } from '../../../core/session/index.js';
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
import { useAuthorizedAction } from '../api/authorized-action.js';
import {
  useCancelItem,
  useCancelReasons,
  useDeliverOrder,
  useOccupancyBills,
  useOccupancyOrders,
} from '../api/order-api.js';
import { CancelItemDialog } from '../components/CancelItemDialog.js';
import { comandaTable, printCancellation, printOrderComanda } from '../components/comanda.js';
import { readyAlerts } from '../hooks/ready-alerts.js';
import { occupancyTitle } from '../components/occupancy-title.js';
import { OrderList } from '../components/OrderList.js';
import { actionError, QUEUED_MESSAGE } from '../components/errors.js';
import { GuestsStepper } from '../components/GuestsStepper.js';
import { TablePickerDialog } from '../components/TablePickerDialog.js';

type Dialog = 'move' | 'merge' | 'transfer' | null;

export function OccupancyPage() {
  const { id = '' } = useParams();
  const occupancy = useOccupancy(id);
  const floor = useFloor();
  const regional = useRegional();
  const [dialog, setDialog] = useState<Dialog>(null);
  const location = useLocation();
  const navigate = useNavigate();
  // Al volver de tomar el pedido: enviado o guardado sin conexión
  const sent = (location.state as { sent?: 'applied' | 'queued' } | null)?.sent;
  const [notice, setNotice] = useState<string | null>(
    sent === 'queued' ? QUEUED_MESSAGE : sent === 'applied' ? 'Pedido enviado a cocina.' : null,
  );
  const queue = useOutbox();
  const orders = useOccupancyOrders(id);
  const bills = useOccupancyBills(id);
  const deliver = useDeliverOrder(id);
  const cancelItem = useCancelItem(id);
  const reasons = useCancelReasons();
  const session = useSession();
  const [cancelling, setCancelling] = useState<OrderItem | null>(null);
  const authorized = useAuthorizedAction();

  const move = useMoveOccupancy();
  const merge = useMergeOccupancy();
  const transfer = useTransferOccupancy();
  const guests = useUpdateGuests();
  const error = actionError(
    move.error ??
      merge.error ??
      transfer.error ??
      guests.error ??
      deliver.error ??
      cancelItem.error,
  );

  const back = (
    <Link to="/mesero" className="flex min-h-12 items-center gap-2 self-start font-semibold">
      <ArrowLeft aria-hidden className="size-5" /> Mesas
    </Link>
  );

  if (occupancy.isPending) {
    // Sin conexión y sin copia en este celular: no hay nada que mostrar todavía
    if (occupancy.fetchStatus === 'paused')
      return (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
          {back}
          <p role="status" className="text-base">
            Sin conexión: esta mesa no se había abierto en este celular. Se verá al volver la
            conexión.
          </p>
        </div>
      );
    return <p className="text-base text-secondary">Cargando…</p>;
  }
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
  const title = occupancyTitle(occ, tables);
  const isOpen = occ.status === 'ABIERTA';
  const done = (outcome: { status: 'applied' | 'queued' }) => {
    setDialog(null);
    setNotice(outcome.status === 'queued' ? QUEUED_MESSAGE : null);
  };
  const reset = () => {
    for (const m of [move, merge, transfer, guests, deliver, cancelItem]) m.reset();
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

      {notice && (notice !== QUEUED_MESSAGE || queue.pending.length > 0) && (
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

      <Card className="flex flex-wrap items-center justify-between gap-4">
        {isOpen ? (
          // − y + en el mismo lugar, y el número se puede escribir (Docs/18 §6b)
          <InlineGuests
            key={occ.version}
            value={occ.guests}
            onSave={(n) =>
              authorized.run(
                guests,
                { id: occ.id, guests: n, version: occ.version },
                `Cambiar a ${n} comensales`,
                { onDone: done },
              )
            }
          />
        ) : (
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Comensales</span>
            <span className="text-2xl font-bold tabular">{occ.guests}</span>
          </div>
        )}
        {guests.isPending && <span className="text-sm text-secondary">Guardando…</span>}
      </Card>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-bold">Pedidos</h3>
        {orders.isPending && <p className="text-base text-secondary">Cargando pedidos…</p>}
        {orders.data && (
          <OrderList
            orders={orders.data}
            delivering={deliver.isPending ? (deliver.variables?.orderId ?? null) : null}
            kitchenDisplay={floor.data?.kitchenDisplay ?? true}
            onDeliver={(o) => {
              reset();
              authorized.run(
                deliver,
                { orderId: o.id, label: `Entregar ronda ${o.roundNumber} de ${title}` },
                `Entregar la ronda ${o.roundNumber} de ${title}`,
                {
                  onDone: (outcome) => {
                    // Entregado: se quita el aviso de "listo" (también sin conexión)
                    readyAlerts.remove(o.id);
                    done(outcome);
                  },
                },
              );
            }}
            onPrint={(o) =>
              printOrderComanda(o, {
                occupancy: occ,
                table: comandaTable(occ, floor.data?.zones ?? []),
                regional,
              })
            }
            onCancelItem={
              isOpen
                ? (item) => {
                    reset();
                    setCancelling(item);
                  }
                : undefined
            }
          />
        )}
      </section>
      <CancelItemDialog
        item={cancelling}
        loading={cancelItem.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={({ reasonId, note }) => {
          const item = cancelling!;
          const label = `Cancelar ${item.quantity} × ${item.productName}`;
          authorized.run(cancelItem, { itemId: item.id, label, reasonId, note }, label, {
            onDone: (outcome) => {
              setCancelling(null);
              done(outcome);
              // Comanda de cancelación (Docs/11 §4.1)
              printCancellation(
                {
                  order: orders.data?.find((o) => o.items.some((i) => i.id === item.id)),
                  item,
                  reason: reasons.data?.find((r) => r.id === reasonId)?.name ?? '—',
                  cancelledBy: session?.user.fullName ?? occ.waiterName,
                },
                { occupancy: occ, table: comandaTable(occ, floor.data?.zones ?? []), regional },
              );
            },
            onError: () => setCancelling(null),
          });
        }}
      />

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-bold">Cuentas</h3>
        <ul className="flex flex-col gap-2">
          {(bills.data ?? occ.bills).map((b) => (
            <li
              key={b.id}
              className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-accent px-4"
            >
              <span className="font-semibold">{b.name}</span>
              <span className="flex items-center gap-3">
                {'total' in b && typeof b.total === 'string' && (
                  <span className="text-base font-semibold tabular">
                    {formatMoney(b.total, regional)}
                  </span>
                )}
                <Badge>
                  {b.status === 'ABIERTA'
                    ? 'Abierta'
                    : b.status === 'PRECUENTA'
                      ? 'Pre-cuenta'
                      : b.status === 'PAGADA'
                        ? 'Pagada'
                        : b.status}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          icon={<Receipt />}
          onClick={() => void navigate(`/mesero/ocupacion/${occ.id}/cuentas`)}
        >
          Cuentas y pre-cuenta
        </Button>
      </section>

      {isOpen && (
        <section className="flex flex-col gap-3">
          <Button
            size="lg"
            fullWidth
            icon={<NotebookPen />}
            onClick={() => void navigate(`/mesero/ocupacion/${occ.id}/pedido`)}
          >
            Tomar pedido
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
            {/* Sin table.transfer_waiter, el servidor pide la 🔑 de un gerente */}
            <Button variant="outline" icon={<UserRound />} onClick={() => openDialog('transfer')}>
              Transferir
            </Button>
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
          authorized.run(
            move,
            { id: occ.id, targetTableId: t.id, tableName: t.name },
            `Trasladar a la mesa ${t.name}`,
            { onDone: done, onError: () => setDialog(null) },
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
          authorized.run(
            merge,
            { id: occ.id, sourceOccupancyId: t.occupancy!.id, tableName: t.name },
            `Unir la mesa ${t.name}`,
            { onDone: done, onError: () => setDialog(null) },
          )
        }
      />
      <TransferDialog
        open={dialog === 'transfer'}
        currentWaiterId={occ.waiterId}
        loading={transfer.isPending}
        onClose={() => setDialog(null)}
        onSave={(waiterId, waiterName) =>
          authorized.run(
            transfer,
            { id: occ.id, waiterId, waiterName },
            `Transferir a ${waiterName}`,
            { onDone: done, onError: () => setDialog(null) },
          )
        }
      />
      {authorized.dialog}
    </div>
  );
}

/** Espera a que el mesero deje de tocar + o − para mandar un solo cambio. */
const GUESTS_SAVE_MS = 800;

function InlineGuests({ value, onSave }: { value: number; onSave: (guests: number) => void }) {
  const [draft, setDraft] = useState(value);
  // onSave cambia en cada render: se lee el último desde una referencia
  const save = useRef(onSave);
  const pending = useRef<number | null>(null);
  useEffect(() => {
    save.current = onSave;
  });
  useEffect(() => {
    if (draft === value) {
      pending.current = null;
      return;
    }
    pending.current = draft;
    const timer = setTimeout(() => {
      pending.current = null;
      save.current(draft);
    }, GUESTS_SAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, value]);
  // Si sale de la pantalla antes de que pase la espera, el cambio se guarda igual
  useEffect(
    () => () => {
      if (pending.current !== null) save.current(pending.current);
    },
    [],
  );
  return <GuestsStepper value={draft} onChange={setDraft} />;
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
