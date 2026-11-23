// Configuración › Motivos (permiso config.payments; los de descuento también con config.discounts;
// H3 #21). Dueño: Deniscito; reasignado a Pablito (Docs/17 §3.1). Los motivos no se borran, se
// desactivan, y cada tipo conserva al menos uno activo (cancelar, reabrir o retirar piden uno).
import type { ReasonAdmin, ReasonType } from '@mise/shared/contracts/config';
import { newId } from '@mise/shared/domain/ids';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import {
  Badge,
  Button,
  cx,
  Modal,
  NumberInput,
  Switch,
  TextInput,
} from '../../../core/ui/index.js';
import { useAllReasons, useCreateReason, useUpdateReason } from '../api/payments-api.js';

const TYPES: { type: ReasonType; label: string; hint: string }[] = [
  { type: 'CANCEL_ITEM', label: 'Cancelar ítem', hint: 'Al cancelar algo ya enviado a cocina' },
  { type: 'DISCOUNT', label: 'Descuento', hint: 'Al aplicar un descuento' },
  { type: 'REOPEN_BILL', label: 'Reabrir cuenta', hint: 'Al reabrir una cuenta pagada' },
  { type: 'CASH_WITHDRAWAL', label: 'Retiro', hint: 'Al sacar efectivo de la caja' },
  { type: 'CASH_DEPOSIT', label: 'Depósito', hint: 'Al meter efectivo a la caja' },
  { type: 'CONFLICT', label: 'Conflicto', hint: 'Al resolver un conflicto de sincronización' },
];

function errorText(e: unknown) {
  return e instanceof ApiError ? e.message : e ? 'No se pudo guardar' : null;
}

export function ReasonsPage() {
  const reasons = useAllReasons();
  const create = useCreateReason();
  const [chosen, setChosen] = useState<ReasonType | null>(null);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<ReasonAdmin | null>(null);

  if (reasons.isPending) return <p className="text-base text-secondary">Cargando motivos…</p>;
  if (reasons.error || !reasons.data) return <p role="alert">No se pudieron cargar los motivos.</p>;

  // Solo los tipos que este usuario administra (el gerente ve solo los de descuento)
  const types = TYPES.filter((t) => reasons.data.some((r) => r.type === t.type));
  const current = types.find((t) => t.type === chosen) ?? types[0];
  if (!current) return <p className="text-base">No tienes motivos para administrar.</p>;
  const list = reasons.data.filter((r) => r.type === current.type);
  const addError = errorText(create.error);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Motivos</h1>
        <p className="text-base text-secondary">
          Las opciones que se eligen al cancelar, descontar, reabrir o mover efectivo. Quedan en la
          bitácora con cada acción.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[14rem_1fr]">
        <nav aria-label="Tipos de motivo">
          <ul className="flex flex-col gap-1">
            {types.map((t) => {
              const active = t.type === current.type;
              return (
                <li key={t.type}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => setChosen(t.type)}
                    className={cx(
                      'flex min-h-12 w-full items-center rounded-md px-3 text-left text-base font-semibold',
                      active ? 'bg-primary text-white' : 'hover:bg-surface',
                    )}
                  >
                    {t.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold">{current.label}</h2>
            <p className="text-sm text-secondary">{current.hint}</p>
          </div>
          <ul className="flex flex-col divide-y divide-surface rounded-md border border-surface bg-background">
            {list.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={r.active ? 'text-base' : 'text-base text-secondary'}>
                    {r.name}
                  </span>
                  {!r.active && <Badge tone="neutral">Inactivo</Badge>}
                </div>
                <Button
                  variant="outline"
                  icon={<Pencil />}
                  aria-label={`Editar ${r.name}`}
                  onClick={() => setEditing(r)}
                >
                  Editar
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newName.trim();
              if (!name) return;
              create.mutate(
                { id: newId(), type: current.type, name },
                { onSuccess: () => setNewName('') },
              );
            }}
          >
            <TextInput
              label="Nuevo motivo"
              value={newName}
              maxLength={80}
              className="min-w-0 flex-1"
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button
              type="submit"
              variant="outline"
              icon={<Plus />}
              disabled={!newName.trim()}
              loading={create.isPending}
            >
              Agregar
            </Button>
          </form>
          {addError && (
            <p
              role="alert"
              className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
            >
              {addError}
            </p>
          )}
        </section>
      </div>

      {editing && (
        <ReasonDialog key={editing.id} reason={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function ReasonDialog({ reason, onClose }: { reason: ReasonAdmin; onClose: () => void }) {
  const [name, setName] = useState(reason.name);
  const [active, setActive] = useState(reason.active);
  const [sort, setSort] = useState(reason.sort);
  const update = useUpdateReason();
  const error = errorText(update.error);

  return (
    <Modal open onClose={onClose} title={reason.name}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          update.mutate(
            { id: reason.id, body: { name: name.trim(), active, sort } },
            { onSuccess: onClose },
          );
        }}
      >
        <TextInput
          label="Motivo"
          value={name}
          maxLength={80}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <Switch
          label="Activo"
          hint="Inactivo ya no se puede elegir; lo que ya pasó lo conserva"
          checked={active}
          onChange={setActive}
        />
        <NumberInput
          label="Orden"
          hint="Los de número menor salen primero"
          value={sort}
          min={0}
          max={999}
          onChange={setSort}
          className="sm:max-w-48"
        />
        {error && (
          <p
            role="alert"
            className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!name.trim()} loading={update.isPending}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
