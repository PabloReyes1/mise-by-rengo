// Configuración › Usuarios (RF-030, permiso config.users; H3 #21). Dueño: Deniscito; reasignado a
// Pablito (Docs/17 §3.1). Nada se borra: un usuario se desactiva (su historial lo usa).
import type { AdminUser } from '@mise/shared/contracts/auth';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useRegional } from '../../../core/config/index.js';
import { formatDateTime } from '../../../core/format/index.js';
import { useSession } from '../../../core/session/index.js';
import { Badge, Button } from '../../../core/ui/index.js';
import { useRoles, useUsers } from '../api/users-api.js';
import { UserDialog } from '../components/UserDialog.js';

export function UsersPage() {
  const session = useSession();
  const regional = useRegional();
  const users = useUsers();
  const roles = useRoles();
  // id del usuario que se edita; 'new' = usuario nuevo
  const [editing, setEditing] = useState<string | null>(null);

  if (users.isPending || roles.isPending)
    return <p className="text-base text-secondary">Cargando usuarios…</p>;
  if (users.error || roles.error || !users.data || !roles.data)
    return <p role="alert">No se pudieron cargar los usuarios.</p>;

  const roleName = new Map(roles.data.map((r) => [r.id, r.name]));
  const editingUser: AdminUser | null =
    editing && editing !== 'new' ? (users.data.find((u) => u.id === editing) ?? null) : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">Usuarios</h1>
          <p className="text-base text-secondary">
            Quién entra al sistema y qué puede hacer según sus roles.
          </p>
        </div>
        <Button icon={<Plus />} onClick={() => setEditing('new')}>
          Nuevo usuario
        </Button>
      </header>

      <ul className="flex flex-col divide-y divide-surface rounded-md border border-surface bg-background">
        {users.data.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={u.active ? 'text-base font-semibold' : 'text-base text-secondary'}>
                  {u.fullName}
                </span>
                <span className="text-sm text-secondary">{u.username}</span>
                {!u.active && <Badge tone="neutral">Inactivo</Badge>}
                {u.locked && <Badge tone="warning">Bloqueado</Badge>}
                {!u.hasPin && <Badge tone="neutral">Sin PIN</Badge>}
                {u.id === session?.user.id && <Badge tone="neutral">Tú</Badge>}
              </div>
              <span className="text-sm text-secondary">
                {u.roleIds.map((id) => roleName.get(id) ?? '—').join(', ')}
                {' · '}
                {u.lastLoginAt
                  ? `Último acceso: ${formatDateTime(u.lastLoginAt, regional)}`
                  : 'Nunca ha entrado'}
              </span>
            </div>
            <Button
              variant="outline"
              icon={<Pencil />}
              aria-label={`Editar a ${u.fullName}`}
              onClick={() => setEditing(u.id)}
            >
              Editar
            </Button>
          </li>
        ))}
      </ul>

      {editing && (editing === 'new' || editingUser) && (
        <UserDialog
          key={editing}
          user={editingUser}
          roles={roles.data}
          branches={session?.branches ?? []}
          selfId={session?.user.id ?? null}
          ownPermissions={session?.permissions ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
