// Configuración › Cajas (permiso config.restaurant, SC-64; H3 #21). Dueño: Pablito.
// Fondo fijo o variable (PA-024), conteo por denominación opcional u obligatorio (PA-025) y una
// sola caja principal por sucursal, la que recibe el efectivo de los meseros (PA-052).
import type { CashRegister } from '@mise/shared/contracts/cash';
import { newId } from '@mise/shared/domain/ids';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { useRegional } from '../../../core/config/index.js';
import { formatMoney, toMoney } from '../../../core/format/index.js';
import { Badge, Button, Modal, Select, Switch, TextInput } from '../../../core/ui/index.js';
import {
  useAllCashRegisters,
  useCreateCashRegister,
  useUpdateCashRegister,
} from '../api/payments-api.js';

type FloatMode = CashRegister['openingFloatMode'];
type CountMode = CashRegister['countByDenomination'];

function errorText(e: unknown) {
  return e instanceof ApiError ? e.message : e ? 'No se pudo guardar' : null;
}

export function CashRegistersPage() {
  const registers = useAllCashRegisters();
  const regional = useRegional();
  // id de la caja que se edita; 'new' = nueva
  const [editing, setEditing] = useState<string | null>(null);

  if (registers.isPending) return <p className="text-base text-secondary">Cargando cajas…</p>;
  if (registers.error || !registers.data)
    return <p role="alert">No se pudieron cargar las cajas.</p>;

  const current = registers.data.find((r) => r.id === editing) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">Cajas</h1>
          <p className="text-base text-secondary">
            Cada caja abre y cierra sus turnos. La principal recibe el efectivo que cobran los
            meseros.
          </p>
        </div>
        <Button icon={<Plus />} onClick={() => setEditing('new')}>
          Nueva caja
        </Button>
      </header>

      {registers.data.length === 0 ? (
        <p className="rounded-md bg-surface px-4 py-6 text-base text-secondary">
          Esta sucursal no tiene cajas. Crea la primera: será la principal.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-surface rounded-md border border-surface bg-background">
          {registers.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={r.active ? 'text-base font-semibold' : 'text-base text-secondary'}
                  >
                    {r.name}
                  </span>
                  {r.isMain && <Badge tone="success">Principal</Badge>}
                  {!r.active && <Badge tone="neutral">Inactiva</Badge>}
                  {r.openShift && <Badge tone="neutral">Turno abierto</Badge>}
                </div>
                <span className="text-sm text-secondary">
                  {r.openingFloatMode === 'FIJO'
                    ? `Fondo fijo de ${formatMoney(r.openingFloatAmount, regional)}`
                    : 'Fondo variable (lo escribe el cajero)'}
                  {r.countByDenomination === 'OBLIGATORIO'
                    ? ' · Conteo por billete obligatorio'
                    : ' · Conteo por billete opcional'}
                </span>
              </div>
              <Button
                variant="outline"
                icon={<Pencil />}
                aria-label={`Editar ${r.name}`}
                onClick={() => setEditing(r.id)}
              >
                Editar
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing && (editing === 'new' || current) && (
        <RegisterDialog
          key={editing}
          register={current}
          first={registers.data.filter((r) => r.active).length === 0}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RegisterDialog({
  register,
  first,
  onClose,
}: {
  register: CashRegister | null;
  /** No hay cajas activas: la nueva será la principal */
  first: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(register?.name ?? '');
  const [floatMode, setFloatMode] = useState<FloatMode>(register?.openingFloatMode ?? 'VARIABLE');
  const [amount, setAmount] = useState(register?.openingFloatAmount ?? '0.00');
  const [countMode, setCountMode] = useState<CountMode>(
    register?.countByDenomination ?? 'OPCIONAL',
  );
  const [isMain, setIsMain] = useState(register?.isMain ?? first);
  const [active, setActive] = useState(register?.active ?? true);
  const [id] = useState(() => register?.id ?? newId());
  const create = useCreateCashRegister();
  const update = useUpdateCashRegister();

  const amountValue = floatMode === 'FIJO' ? toMoney(amount) : (toMoney(amount) ?? '0.00');
  const amountError =
    floatMode === 'FIJO' && !amountValue ? 'Escribe un monto, ej. 500' : undefined;
  const valid = name.trim().length > 0 && !amountError;
  const error = errorText(create.error ?? update.error);
  const wasMain = register?.isMain ?? false;

  const save = () => {
    if (!valid || !amountValue) return;
    const fields = {
      name: name.trim(),
      openingFloatMode: floatMode,
      openingFloatAmount: amountValue,
      countByDenomination: countMode,
      isMain,
    };
    if (register)
      update.mutate({ id: register.id, body: { ...fields, active } }, { onSuccess: onClose });
    else create.mutate({ id, ...fields }, { onSuccess: onClose });
  };

  return (
    <Modal open onClose={onClose} title={register ? register.name : 'Nueva caja'}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <TextInput
          label="Nombre"
          hint='Ej. "Caja 1", "Caja barra"'
          value={name}
          maxLength={40}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Fondo inicial"
            value={floatMode}
            options={[
              { value: 'VARIABLE', label: 'Variable: lo escribe el cajero' },
              { value: 'FIJO', label: 'Fijo: el mismo cada turno' },
            ]}
            onChange={(e) => setFloatMode(e.target.value as FloatMode)}
          />
          {floatMode === 'FIJO' && (
            <TextInput
              label="Monto del fondo"
              inputMode="decimal"
              value={amount}
              error={amountError}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </div>
        <Select
          label="Conteo por billete y moneda en el corte"
          value={countMode}
          options={[
            { value: 'OPCIONAL', label: 'Opcional: puede escribir solo el total' },
            { value: 'OBLIGATORIO', label: 'Obligatorio' },
          ]}
          onChange={(e) => setCountMode(e.target.value as CountMode)}
        />
        <Switch
          label="Caja principal"
          hint={
            wasMain
              ? 'Siempre hay una principal: para cambiarla, marca otra caja'
              : 'Recibe el efectivo de los meseros. La principal de ahora deja de serlo'
          }
          checked={isMain}
          disabled={wasMain || (first && !register)}
          onChange={setIsMain}
        />
        {register && (
          <Switch
            label="Activa"
            hint={
              wasMain
                ? 'La principal no se desactiva'
                : register.openShift
                  ? 'Tiene un turno abierto: haz el corte antes de desactivarla'
                  : 'Inactiva ya no aparece en Caja; sus turnos viejos se conservan'
            }
            checked={active}
            disabled={wasMain || (register.openShift !== null && register.active)}
            onChange={setActive}
          />
        )}
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
          <Button type="submit" disabled={!valid} loading={create.isPending || update.isPending}>
            {register ? 'Guardar' : 'Crear caja'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
