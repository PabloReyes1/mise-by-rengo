// Configuración › Mesas (RF-020, permiso config.tables): zonas a la izquierda, sus mesas a la derecha.
// Las mesas se crean en lista; el editor visual del mapa es de Fase 2 (RF-021).
// Nada se borra: zonas y mesas se desactivan o se dan de baja (las ocupaciones viejas las usan).
import type { DiningTable, FloorTable, TableStatus, Zone } from '@mise/shared/contracts/floor';
import { Lock, LockOpen, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { Badge, Button, cx, Modal, TextInput, type BadgeTone } from '../../../core/ui/index.js';
import { useFloorTables, useSaveZone, useUpdateTable, useZones } from '../api/tables-api.js';
import { SHAPE_LABEL, TableDialog } from '../components/TableDialog.js';

const STATUS: Record<TableStatus, { label: string; tone: BadgeTone }> = {
  LIBRE: { label: 'Libre', tone: 'success' },
  OCUPADA: { label: 'Ocupada', tone: 'neutral' },
  UNIDA: { label: 'Unida', tone: 'neutral' },
  BLOQUEADA: { label: 'Bloqueada', tone: 'warning' },
};

function errorText(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : e ? fallback : null;
}

type Editing = { kind: 'table'; table: DiningTable | null } | { kind: 'zone'; zone: Zone } | null;

export function TablesPage() {
  const zones = useZones();
  const floor = useFloorTables();
  const saveZone = useSaveZone();
  const updateTable = useUpdateTable();
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [newZone, setNewZone] = useState('');
  const [editing, setEditing] = useState<Editing>(null);

  if (zones.isPending || floor.isPending)
    return <p className="text-base text-secondary">Cargando mesas…</p>;
  if (zones.error || floor.error || !zones.data || !floor.data)
    return <p role="alert">No se pudieron cargar las zonas y mesas.</p>;

  const allZones = zones.data;
  const current = allZones.find((z) => z.id === zoneId) ?? allZones[0] ?? null;
  const tables: FloorTable[] = floor.data.zones.find((z) => z.id === current?.id)?.tables ?? [];
  const actionError =
    errorText(saveZone.error, 'No se pudo guardar la zona') ??
    errorText(updateTable.error, 'No se pudo cambiar la mesa');

  const toggleBlocked = (t: FloorTable) =>
    updateTable.mutate({
      id: t.id,
      body: { blocked: t.status !== 'BLOQUEADA', version: t.version },
    });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Mesas</h1>
        <p className="text-base text-secondary">
          Las zonas agrupan las mesas en el mapa del mesero (Salón, Terraza, Barra).
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[15rem_1fr]">
        <aside className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-secondary">Zonas</h2>
          {allZones.length > 0 && (
            <ul className="flex gap-1 overflow-x-auto md:flex-col">
              {allZones.map((z) => (
                <li key={z.id} className="shrink-0">
                  <button
                    type="button"
                    aria-current={z.id === current?.id || undefined}
                    onClick={() => setZoneId(z.id)}
                    className={cx(
                      'flex min-h-12 w-full items-center justify-between gap-2 rounded-md px-3 text-left text-base',
                      z.id === current?.id
                        ? 'bg-primary font-semibold text-white'
                        : 'hover:bg-surface',
                    )}
                  >
                    <span>{z.name}</span>
                    {!z.active && <Badge>Inactiva</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newZone.trim();
              if (name)
                saveZone.mutate(
                  { body: { name } },
                  {
                    onSuccess: (z) => {
                      setNewZone('');
                      setZoneId(z.id);
                    },
                  },
                );
            }}
          >
            <TextInput
              label="Nueva zona"
              value={newZone}
              maxLength={60}
              onChange={(e) => setNewZone(e.target.value)}
            />
            <Button
              type="submit"
              variant="outline"
              aria-label="Agregar zona"
              icon={<Plus />}
              disabled={!newZone.trim()}
              loading={saveZone.isPending && !editing}
            >
              Agregar
            </Button>
          </form>
        </aside>

        <section className="flex min-w-0 flex-col gap-4">
          {!current ? (
            <p className="rounded-md bg-surface px-4 py-6 text-base text-secondary">
              Todavía no hay zonas. Crea la primera (por ejemplo, “Salón”) para empezar a agregar
              mesas.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">{current.name}</h2>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    icon={<Pencil />}
                    onClick={() => setEditing({ kind: 'zone', zone: current })}
                  >
                    Renombrar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      saveZone.mutate({
                        id: current.id,
                        body: { name: current.name, active: !current.active },
                      })
                    }
                  >
                    {current.active ? 'Desactivar zona' : 'Activar zona'}
                  </Button>
                  <Button
                    icon={<Plus />}
                    disabled={!current.active}
                    onClick={() => setEditing({ kind: 'table', table: null })}
                  >
                    Nueva mesa
                  </Button>
                </div>
              </div>

              {actionError && (
                <p
                  role="alert"
                  className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
                >
                  {actionError}
                </p>
              )}

              {!current.active ? (
                <p className="rounded-md bg-surface px-4 py-6 text-base">
                  Esta zona está inactiva: sus mesas no aparecen en el mapa del mesero. Actívala
                  para verlas y editarlas.
                </p>
              ) : tables.length === 0 ? (
                <p className="rounded-md bg-surface px-4 py-6 text-base text-secondary">
                  Esta zona no tiene mesas. Usa “Nueva mesa” para agregar la primera.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-accent border-y border-accent">
                  {tables.map((t) => {
                    const inUse = t.status === 'OCUPADA' || t.status === 'UNIDA';
                    const blocked = t.status === 'BLOQUEADA';
                    return (
                      <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-base font-semibold">Mesa {t.name}</span>
                          <span className="text-sm text-secondary">
                            <span className="tabular">{t.capacity}</span>{' '}
                            {t.capacity === 1 ? 'lugar' : 'lugares'} · {SHAPE_LABEL[t.shape]}
                          </span>
                        </div>
                        <span className="w-24">
                          <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            icon={blocked ? <LockOpen /> : <Lock />}
                            disabled={inUse}
                            aria-label={`${blocked ? 'Desbloquear' : 'Bloquear'} la mesa ${t.name}`}
                            title={inUse ? 'Primero hay que liberar la mesa' : undefined}
                            onClick={() => toggleBlocked(t)}
                          >
                            {blocked ? 'Desbloquear' : 'Bloquear'}
                          </Button>
                          <Button
                            variant="secondary"
                            icon={<Pencil />}
                            aria-label={`Editar la mesa ${t.name}`}
                            onClick={() => setEditing({ kind: 'table', table: t })}
                          >
                            Editar
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      {editing?.kind === 'table' && current && (
        <TableDialog
          table={editing.table}
          zoneId={current.id}
          zones={allZones}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'zone' && (
        <ZoneDialog zone={editing.zone} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function ZoneDialog({ zone, onClose }: { zone: Zone; onClose: () => void }) {
  const [name, setName] = useState(zone.name);
  const save = useSaveZone();
  return (
    <Modal open onClose={onClose} title={`Renombrar ${zone.name}`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim())
            save.mutate({ id: zone.id, body: { name: name.trim() } }, { onSuccess: onClose });
        }}
      >
        <TextInput
          label="Nombre de la zona"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        {save.error && (
          <p
            role="alert"
            className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
          >
            {errorText(save.error, 'No se pudo guardar la zona')}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!name.trim()} loading={save.isPending}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
