// Configuración › Métodos de pago (RF-027, permiso config.payments; H3 #21). Dueño: Pablito.
// Solo el efectivo da cambio. El tipo no cambia después de crearlo; los métodos no se borran,
// se desactivan (los cobros viejos los usan).
import type { PaymentMethodAdmin } from '@mise/shared/contracts/billing';
import { newId } from '@mise/shared/domain/ids';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import {
  Badge,
  Button,
  Modal,
  NumberInput,
  Select,
  Switch,
  TextInput,
} from '../../../core/ui/index.js';
import {
  useAllPaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
} from '../api/payments-api.js';

type Kind = PaymentMethodAdmin['kind'];
const KIND_LABEL: Record<Kind, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

function errorText(e: unknown) {
  return e instanceof ApiError ? e.message : e ? 'No se pudo guardar' : null;
}

export function PaymentMethodsPage() {
  const methods = useAllPaymentMethods();
  // id del método que se edita; 'new' = nuevo
  const [editing, setEditing] = useState<string | null>(null);

  if (methods.isPending) return <p className="text-base text-secondary">Cargando métodos…</p>;
  if (methods.error || !methods.data)
    return <p role="alert">No se pudieron cargar los métodos de pago.</p>;

  const current = methods.data.find((m) => m.id === editing) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">Métodos de pago</h1>
          <p className="text-base text-secondary">
            Con qué se puede cobrar. Solo el efectivo da cambio y cuenta en el corte de caja.
          </p>
        </div>
        <Button icon={<Plus />} onClick={() => setEditing('new')}>
          Nuevo método
        </Button>
      </header>

      <ul className="flex flex-col divide-y divide-surface rounded-md border border-surface bg-background">
        {methods.data.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={m.active ? 'text-base font-semibold' : 'text-base text-secondary'}>
                  {m.name}
                </span>
                {!m.active && <Badge tone="neutral">Inactivo</Badge>}
              </div>
              <span className="text-sm text-secondary">
                {KIND_LABEL[m.kind]}
                {m.givesChange && ' · Da cambio'}
                {m.requiresReference && ' · Pide referencia'}
              </span>
            </div>
            <Button
              variant="outline"
              icon={<Pencil />}
              aria-label={`Editar ${m.name}`}
              onClick={() => setEditing(m.id)}
            >
              Editar
            </Button>
          </li>
        ))}
      </ul>

      {editing && (editing === 'new' || current) && (
        <MethodDialog key={editing} method={current} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function MethodDialog({
  method,
  onClose,
}: {
  method: PaymentMethodAdmin | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(method?.name ?? '');
  const [kind, setKind] = useState<Kind>(method?.kind ?? 'CARD');
  const [givesChange, setGivesChange] = useState(method?.givesChange ?? false);
  const [requiresReference, setRequiresReference] = useState(method?.requiresReference ?? false);
  const [active, setActive] = useState(method?.active ?? true);
  const [sort, setSort] = useState(method?.sort ?? 0);
  const [id] = useState(() => method?.id ?? newId());
  const create = useCreatePaymentMethod();
  const update = useUpdatePaymentMethod();
  const valid = name.trim().length > 0;
  const error = errorText(create.error ?? update.error);
  const isCash = kind === 'CASH';

  const save = () => {
    if (!valid) return;
    const fields = {
      name: name.trim(),
      givesChange: isCash && givesChange,
      requiresReference,
    };
    if (method)
      update.mutate({ id: method.id, body: { ...fields, active, sort } }, { onSuccess: onClose });
    else create.mutate({ id, kind, ...fields }, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={method ? method.name : 'Nuevo método de pago'}
      description={method ? `Tipo: ${KIND_LABEL[method.kind]}` : undefined}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <TextInput
          label="Nombre"
          hint="Como sale en la ventana de cobro y en el recibo"
          value={name}
          maxLength={40}
          required
          onChange={(e) => setName(e.target.value)}
        />
        {!method && (
          <Select
            label="Tipo"
            hint="No se cambia después: los cobros y el corte de caja lo usan"
            value={kind}
            options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))}
            onChange={(e) => setKind(e.target.value as Kind)}
          />
        )}
        {isCash && (
          <Switch
            label="Da cambio"
            hint="Al cobrar, calcula el cambio si pagan con más"
            checked={givesChange}
            onChange={setGivesChange}
          />
        )}
        <Switch
          label="Pide referencia"
          hint="Al cobrar hay que escribir el número de la transacción o del voucher"
          checked={requiresReference}
          onChange={setRequiresReference}
        />
        {method && (
          <>
            <Switch
              label="Activo"
              hint="Inactivo ya no aparece al cobrar; los cobros viejos lo conservan"
              checked={active}
              onChange={setActive}
            />
            <NumberInput
              label="Orden"
              hint="Los de número menor salen primero al cobrar"
              value={sort}
              min={0}
              max={999}
              onChange={setSort}
              className="sm:max-w-48"
            />
          </>
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
            {method ? 'Guardar' : 'Crear método'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
