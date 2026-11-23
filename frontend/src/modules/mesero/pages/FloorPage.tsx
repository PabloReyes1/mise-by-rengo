// Mesas del mesero (Docs/05 paso 2, RF-020, RF-109): zonas, mesas con su estado, abrir mesa y
// para llevar. Mobile first a 360 px (RNF-060).
import type { FloorTable } from '@mise/shared/contracts/floor';
import { CircleAlert, Info, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useRegional } from '../../../core/config/index.js';
import { formatTime } from '../../../core/format/index.js';
import { outbox, useOutbox } from '../../../core/offline/index.js';
import { useSession } from '../../../core/session/index.js';
import { Button, Card, cx } from '../../../core/ui/index.js';
import { useFloor, useOpenOccupancies } from '../api/floor-api.js';
import { useMenu } from '../api/order-api.js';
import { QUEUED_MESSAGE } from '../components/errors.js';
import { OpenTableDialog } from '../components/OpenTableDialog.js';
import { TableCard } from '../components/TableCard.js';
import { TakeawayDialog } from '../components/TakeawayDialog.js';

export function FloorPage() {
  const floor = useFloor();
  // El menú se descarga con conexión para poder tomar pedidos después sin internet (Docs/09 §8)
  useMenu();
  const open = useOpenOccupancies();
  const session = useSession();
  const regional = useRegional();
  const navigate = useNavigate();
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [opening, setOpening] = useState<FloorTable | null>(null);
  const [takeaway, setTakeaway] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const queue = useOutbox();

  const zones = floor.data?.zones ?? [];
  const zone = zones.find((z) => z.id === zoneId) ?? zones[0];
  const takeaways = (open.data ?? []).filter((o) => o.tableId === null);
  const goTo = (occupancyId: string) => navigate(`/mesero/ocupacion/${occupancyId}`);
  const queued = () => {
    setOpening(null);
    setTakeaway(false);
    setNotice(QUEUED_MESSAGE);
  };

  const select = (table: FloorTable) => {
    setNotice(null);
    if (table.status === 'LIBRE') setOpening(table);
    else if (table.occupancy) void goTo(table.occupancy.id);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Mesas</h2>
        <Button variant="secondary" icon={<ShoppingBag />} onClick={() => setTakeaway(true)}>
          Para llevar
        </Button>
      </header>

      {notice && queue.pending.length > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-md bg-surface p-3 text-base">
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-secondary" />
          <span>{notice}</span>
        </p>
      )}

      {/* Acciones que se guardaron sin conexión y el servidor rechazó al enviarlas (Docs/09 §4) */}
      {queue.rejected.map((op) => (
        <div
          key={op.seq}
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-md border-2 border-error bg-background p-3"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-error" />
          <p className="min-w-0 flex-1 text-base">
            <span className="font-bold">No se pudo: {op.label}.</span>{' '}
            {op.lastError?.message ?? 'El servidor rechazó la acción.'}
          </p>
          <Button variant="outline" onClick={() => void outbox.dismiss(op.seq)}>
            Entendido
          </Button>
        </div>
      ))}

      {floor.isPending && <p className="text-base text-secondary">Cargando mesas…</p>}
      {floor.isError && (
        <p role="alert" className="text-base">
          No se pudieron cargar las mesas. Revisa la conexión.
        </p>
      )}
      {floor.data && zones.length === 0 && (
        <Card className="flex flex-col gap-1">
          <p className="text-base font-semibold">Todavía no hay mesas.</p>
          <p className="text-base">El administrador las crea en Administración › Mesas.</p>
        </Card>
      )}

      {zones.length > 1 && (
        <nav aria-label="Zonas" className="-mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2">
            {zones.map((z) => {
              const active = z.id === zone?.id;
              const busy = z.tables.filter((t) => t.status === 'OCUPADA').length;
              return (
                <li key={z.id}>
                  <button
                    type="button"
                    aria-current={active || undefined}
                    onClick={() => setZoneId(z.id)}
                    className={cx(
                      'flex min-h-12 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-base font-semibold',
                      active
                        ? 'border-primary bg-primary text-white'
                        : 'border-secondary bg-background text-secondary hover:bg-surface',
                    )}
                  >
                    {z.name}
                    <span className="text-sm font-normal tabular">
                      {busy}/{z.tables.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {zone && (
        <section aria-label={`Mesas de ${zone.name}`}>
          <ul className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 md:grid-cols-4">
            {zone.tables.map((t) => (
              <li key={t.id}>
                <TableCard
                  table={t}
                  isMine={t.occupancy?.waiterId === session?.user.id}
                  onSelect={select}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {takeaways.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-bold">Para llevar</h3>
          <ul className="flex flex-col gap-2">
            {takeaways.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => void goTo(o.id)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 rounded-md border border-accent bg-background px-4 text-left hover:bg-surface"
                >
                  <span className="font-semibold">{o.customerName ?? 'Sin nombre'}</span>
                  <span className="text-sm text-secondary tabular">
                    {formatTime(o.openedAt, regional)} · {o.waiterName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <OpenTableDialog
        table={opening}
        onClose={() => setOpening(null)}
        onOpened={(occ) => void goTo(occ.id)}
        onQueued={queued}
      />
      <TakeawayDialog
        open={takeaway}
        onClose={() => setTakeaway(false)}
        onOpened={(occ) => void goTo(occ.id)}
        onQueued={queued}
      />
    </div>
  );
}
