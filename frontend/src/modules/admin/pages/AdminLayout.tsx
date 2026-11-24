// Navegación de administración. Cada sección aparece solo si el usuario tiene su permiso y, si es
// de un módulo de la licencia (ej. recetas), si el módulo está activo.
// Menú lateral (RENGO 2026-11-23, Docs/18 §7): contraído muestra solo los íconos; "Menú" lo expande
// por encima del contenido con los nombres, y al elegir una opción (o tocar fuera, o Esc) se contrae.
import {
  Banknote,
  Calculator,
  ChefHat,
  ChevronsLeft,
  CreditCard,
  LayoutGrid,
  ListChecks,
  Menu,
  Package,
  Receipt,
  ShieldCheck,
  Smartphone,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { usePublicConfig } from '../../../core/config/index.js';
import { hasPermission, useSession } from '../../../core/session/index.js';
import { cx } from '../../../core/ui/index.js';

const SECTIONS: {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: string | string[];
  module?: string;
}[] = [
  { to: '/admin/restaurante', label: 'Restaurante', icon: Store, permission: 'config.restaurant' },
  { to: '/admin/menu', label: 'Menú', icon: ChefHat, permission: 'config.menu' },
  { to: '/admin/mesas', label: 'Mesas', icon: LayoutGrid, permission: 'config.tables' },
  {
    to: '/admin/insumos',
    label: 'Insumos',
    icon: Package,
    permission: 'config.recipes',
    module: 'recipes',
  },
  {
    to: '/admin/costeo',
    label: 'Costeo',
    icon: Calculator,
    permission: 'config.recipes',
    module: 'recipes',
  },
  { to: '/admin/cajas', label: 'Cajas', icon: Banknote, permission: 'config.restaurant' },
  { to: '/admin/tickets', label: 'Tickets', icon: Receipt, permission: 'config.restaurant' },
  {
    to: '/admin/metodos-pago',
    label: 'Métodos de pago',
    icon: CreditCard,
    permission: 'config.payments',
  },
  // Los motivos de descuento también los administra quien tiene config.discounts
  {
    to: '/admin/motivos',
    label: 'Motivos',
    icon: ListChecks,
    permission: ['config.payments', 'config.discounts'],
  },
  {
    to: '/admin/dispositivos',
    label: 'Dispositivos',
    icon: Smartphone,
    permission: 'config.devices',
  },
  { to: '/admin/usuarios', label: 'Usuarios', icon: Users, permission: 'config.users' },
  // Quien solo fija topes de descuento (config.discounts, S-05) también entra a Roles
  {
    to: '/admin/roles',
    label: 'Roles',
    icon: ShieldCheck,
    permission: ['config.roles', 'config.discounts'],
  },
];

export function AdminLayout() {
  const session = useSession();
  const modules = usePublicConfig().data?.modules ?? {};
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const visible = SECTIONS.filter(
    (s) =>
      [s.permission].flat().some((p) => hasPermission(session, p)) &&
      (!s.module || modules[s.module] !== false),
  );

  // Se contrae al cambiar de sección (también con atrás/adelante del navegador)
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (visible.length === 0)
    return (
      <p className="text-base text-secondary">Tu usuario no tiene permisos de administración.</p>
    );

  return (
    <div className="-mt-6 -ml-4 flex flex-1">
      {open && (
        <div
          aria-hidden
          className="fixed inset-0 top-14 z-20 bg-primary/20"
          onClick={() => setOpen(false)}
        />
      )}
      {/* El riel ocupa siempre su ancho; al expandirse, el panel flota encima del contenido */}
      <div className="relative w-16 shrink-0 border-r border-accent">
        <nav
          aria-label="Administración"
          className={cx(
            'sticky top-14 z-30 flex max-h-[calc(100dvh-3.5rem)] flex-col gap-1 overflow-y-auto bg-background py-3 transition-[width] duration-200 ease-out motion-reduce:transition-none',
            open ? 'w-64 border-r border-accent shadow-overlay' : 'w-full',
          )}
        >
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? 'Contraer menú' : 'Expandir menú'}
            onClick={() => setOpen((v) => !v)}
            className="mx-2 flex min-h-12 items-center gap-3 rounded-md px-3 text-base font-semibold text-secondary hover:bg-surface hover:text-primary"
          >
            {open ? (
              <ChevronsLeft aria-hidden className="size-6 shrink-0" />
            ) : (
              <Menu aria-hidden className="size-6 shrink-0" />
            )}
            {open && <span>Menú</span>}
          </button>
          <ul className="flex flex-col gap-1">
            {visible.map((s) => (
              <li key={s.to}>
                <NavLink
                  to={s.to}
                  title={open ? undefined : s.label}
                  aria-label={open ? undefined : s.label}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'mx-2 flex min-h-12 items-center gap-3 rounded-md px-3 text-base font-semibold no-underline',
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-secondary hover:bg-surface hover:text-primary',
                    )
                  }
                >
                  <s.icon aria-hidden className="size-6 shrink-0" />
                  {open && <span className="truncate">{s.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 pt-6 pl-4">
        <Outlet />
      </div>
    </div>
  );
}
