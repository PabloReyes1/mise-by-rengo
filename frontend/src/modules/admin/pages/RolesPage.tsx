// Configuración › Roles (Docs/03; H3 #21). Dueño: Deniscito; reasignado a Pablito (Docs/17 §3.1).
// Con config.roles se crean, editan y borran roles; con config.discounts se fijan los topes de
// descuento de cada rol (S-05). Los permisos son el catálogo del producto, agrupados por área.
import type { Role } from '@mise/shared/contracts/auth';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { toMoney } from '../../../core/format/index.js';
import { hasPermission, useSession } from '../../../core/session/index.js';
import { Badge, Button, cx, TextInput } from '../../../core/ui/index.js';
import {
  useCreateRole,
  useDeleteRole,
  usePermissions,
  useRoles,
  useSetDiscountLimits,
  useUpdateRole,
} from '../api/users-api.js';
import { newId } from '@mise/shared/domain/ids';

/** Áreas del catálogo por el prefijo del código (Docs/03 §3). */
const AREAS: Record<string, string> = {
  config: 'Configuración',
  menu: 'Menú',
  cash: 'Caja',
  table: 'Mesas',
  order: 'Pedidos',
  bill: 'Cuentas',
  discount: 'Descuentos',
  tip: 'Propina',
  payment: 'Cobro',
  kds: 'Cocina',
  sync: 'Sincronización',
  dashboard: 'Tablero',
  reports: 'Reportes',
  ai: 'Asistente',
  branch: 'Sucursales',
};

function errorText(e: unknown, fallback = 'No se pudo guardar') {
  return e instanceof ApiError ? e.message : e ? fallback : null;
}

function ErrorBox({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-md border-2 border-error bg-background px-4 py-3 text-base">
      {text}
    </p>
  );
}

export function RolesPage() {
  const session = useSession();
  const roles = useRoles();
  const permissions = usePermissions();
  const [selected, setSelected] = useState<string | null>(null);
  const canEditRoles = hasPermission(session, 'config.roles');
  const canEditLimits = hasPermission(session, 'config.discounts');

  if (roles.isPending || permissions.isPending)
    return <p className="text-base text-secondary">Cargando roles…</p>;
  if (roles.error || permissions.error || !roles.data || !permissions.data)
    return <p role="alert">No se pudieron cargar los roles.</p>;

  const current =
    selected === 'new'
      ? null
      : (roles.data.find((r) => r.id === selected) ?? roles.data[0] ?? null);
  const isNew = selected === 'new';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Roles</h1>
        <p className="text-base text-secondary">
          Cada rol junta permisos. Un usuario con varios roles tiene la suma de sus permisos. Los
          cambios se aplican en unos minutos, cuando su sesión se renueva.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_1fr]">
        <aside className="flex flex-col gap-3">
          <ul className="flex flex-col gap-1">
            {roles.data.map((r) => {
              const active = !isNew && current?.id === r.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => setSelected(r.id)}
                    className={cx(
                      'flex min-h-12 w-full items-center justify-between gap-2 rounded-md px-3 text-left text-base',
                      active ? 'bg-primary text-white' : 'hover:bg-surface',
                    )}
                  >
                    <span className="font-semibold">{r.name}</span>
                    <span className={cx('text-sm', active ? 'text-white' : 'text-secondary')}>
                      {r.userCount} {r.userCount === 1 ? 'usuario' : 'usuarios'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {canEditRoles && (
            <Button variant="outline" icon={<Plus />} onClick={() => setSelected('new')}>
              Nuevo rol
            </Button>
          )}
        </aside>

        <section className="flex min-w-0 flex-col gap-6">
          {isNew ? (
            <RoleForm
              key="new"
              role={null}
              catalog={permissions.data}
              editable
              onSaved={(id) => setSelected(id)}
              onDeleted={() => setSelected(null)}
            />
          ) : current ? (
            <>
              <RoleForm
                key={current.id}
                role={current}
                catalog={permissions.data}
                editable={canEditRoles}
                onSaved={(id) => setSelected(id)}
                onDeleted={() => setSelected(null)}
              />
              {canEditLimits && <DiscountLimits key={`limits-${current.id}`} role={current} />}
            </>
          ) : (
            <p className="rounded-md bg-surface px-4 py-6 text-base text-secondary">
              Todavía no hay roles.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

interface RoleFormProps {
  role: Role | null;
  catalog: { code: string; description: string }[];
  editable: boolean;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}

function RoleForm({ role, catalog, editable, onSaved, onDeleted }: RoleFormProps) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [codes, setCodes] = useState<string[]>(role?.permissions ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(false);
  const [id] = useState(() => role?.id ?? newId());
  const create = useCreateRole();
  const update = useUpdateRole();
  const remove = useDeleteRole();

  const groups = new Map<string, { code: string; description: string }[]>();
  for (const p of catalog) {
    const area = p.code.split('.')[0]!;
    groups.set(area, [...(groups.get(area) ?? []), p]);
  }
  const valid = name.trim().length > 0 && codes.length > 0;
  const error = errorText(create.error ?? update.error ?? remove.error);

  const save = () => {
    if (!valid) return;
    setSaved(false);
    const body = { name: name.trim(), description: description.trim(), permissions: codes };
    const done = { onSuccess: (r: Role) => (setSaved(true), onSaved(r.id)) };
    if (role) update.mutate({ id: role.id, body }, done);
    else create.mutate({ id, ...body }, done);
  };

  const toggle = (code: string, on: boolean) => {
    setSaved(false);
    setCodes(on ? [...codes, code] : codes.filter((c) => c !== code));
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold">{role ? role.name : 'Nuevo rol'}</h2>
        {role?.isSystem && <Badge tone="neutral">Del sistema</Badge>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          label="Nombre"
          value={name}
          maxLength={60}
          required
          disabled={!editable || role?.isSystem}
          hint={role?.isSystem ? 'El rol del sistema no se renombra' : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        <TextInput
          label="Descripción (opcional)"
          value={description}
          maxLength={200}
          disabled={!editable}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <fieldset className="flex flex-col gap-4" disabled={!editable}>
        <legend className="mb-1 text-base font-semibold">
          Permisos ({codes.length} de {catalog.length})
        </legend>
        {[...groups.entries()].map(([area, perms]) => (
          <div key={area} className="flex flex-col gap-1">
            <h3 className="text-sm font-bold text-secondary">{AREAS[area] ?? area}</h3>
            <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
              {perms.map((p) => (
                <label
                  key={p.code}
                  className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-surface"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0"
                    checked={codes.includes(p.code)}
                    onChange={(e) => toggle(p.code, e.target.checked)}
                  />
                  <span className="flex flex-col">
                    <span className="text-base">{p.description}</span>
                    <span className="font-mono text-xs text-secondary">{p.code}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {codes.length === 0 && <p className="text-sm">Elige al menos un permiso.</p>}
      </fieldset>

      <ErrorBox text={error} />
      {saved && (
        <p role="status" className="text-sm">
          Rol guardado.
        </p>
      )}

      {editable &&
        (confirmDelete && role ? (
          <div className="flex flex-col gap-3 rounded-md bg-surface p-4">
            <p className="text-base">¿Borrar el rol {role.name}? Esto no se puede deshacer.</p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                No, volver
              </Button>
              <Button
                variant="danger"
                loading={remove.isPending}
                onClick={() => remove.mutate(role.id, { onSuccess: onDeleted })}
              >
                Borrar el rol {role.name}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {role && !role.isSystem ? (
              <Button
                variant="outline"
                disabled={role.userCount > 0}
                onClick={() => setConfirmDelete(true)}
              >
                Borrar rol
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={!valid} loading={create.isPending || update.isPending}>
              {role ? 'Guardar' : 'Crear rol'}
            </Button>
          </div>
        ))}
      {editable && role && !role.isSystem && role.userCount > 0 && (
        <p className="text-sm text-secondary">
          Para borrarlo, primero quítaselo a sus {role.userCount} usuario(s) en Usuarios.
        </p>
      )}
    </form>
  );
}

/** S-05: tope de descuento sin 🔑. Vacío = sin tope en esa medida. */
function DiscountLimits({ role }: { role: Role }) {
  const [pct, setPct] = useState(role.maxDiscountPct ?? '');
  const [amount, setAmount] = useState(role.maxDiscountAmount ?? '');
  const [saved, setSaved] = useState(false);
  const save = useSetDiscountLimits();

  const pctValue = pct.trim() ? toMoney(pct) : null;
  const pctError =
    pct.trim() && (!pctValue || Number(pctValue) > 100) ? 'De 0 a 100, ej. 10 o 12.5' : undefined;
  const amountValue = amount.trim() ? toMoney(amount) : null;
  const amountError = amount.trim() && !amountValue ? 'Escribe un monto, ej. 50' : undefined;

  return (
    <form
      className="flex flex-col gap-4 border-t border-accent pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (pctError || amountError) return;
        setSaved(false);
        save.mutate(
          { id: role.id, body: { maxDiscountPct: pctValue, maxDiscountAmount: amountValue } },
          { onSuccess: () => setSaved(true) },
        );
      }}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">Tope de descuento</h2>
        <p className="text-sm text-secondary">
          Hasta cuánto descuenta {role.name} sin pedir 🔑. Si tiene varios roles, vale el tope más
          alto. Déjalo vacío para no poner tope en esa medida.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          label="Porcentaje máximo (%)"
          inputMode="decimal"
          value={pct}
          error={pctError}
          onChange={(e) => (setSaved(false), setPct(e.target.value))}
        />
        <TextInput
          label="Monto máximo"
          inputMode="decimal"
          value={amount}
          error={amountError}
          onChange={(e) => (setSaved(false), setAmount(e.target.value))}
        />
      </div>
      <ErrorBox text={errorText(save.error)} />
      {saved && (
        <p role="status" className="text-sm">
          Tope guardado.
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="secondary"
          disabled={!!pctError || !!amountError}
          loading={save.isPending}
        >
          Guardar tope
        </Button>
      </div>
    </form>
  );
}
