// Navegación de administración. Cada sección aparece solo si el usuario tiene su permiso.
import { NavLink, Outlet } from 'react-router';
import { hasPermission, useSession } from '../../../core/session/index.js';
import { cx } from '../../../core/ui/index.js';

const SECTIONS = [
  { to: '/admin/restaurante', label: 'Restaurante', permission: 'config.restaurant' },
  { to: '/admin/menu', label: 'Menú', permission: 'config.menu' },
  { to: '/admin/dispositivos', label: 'Dispositivos', permission: 'config.devices' },
];

export function AdminLayout() {
  const session = useSession();
  const visible = SECTIONS.filter((s) => hasPermission(session, s.permission));
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <nav aria-label="Administración" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1 border-b border-accent">
          {visible.map((s) => (
            <li key={s.to}>
              <NavLink
                to={s.to}
                className={({ isActive }) =>
                  cx(
                    'flex min-h-12 items-center border-b-2 px-4 text-base font-semibold no-underline',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-secondary hover:text-primary',
                  )
                }
              >
                {s.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {visible.length === 0 ? (
        <p className="text-base text-secondary">Tu usuario no tiene permisos de administración.</p>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
