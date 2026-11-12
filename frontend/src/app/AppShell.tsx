// Marco común de las áreas: barra superior (restaurante, área, conexión, usuario) y el contenido.
// Sin dispositivo emparejado o sin sesión, manda a emparejar o a entrar.
import { LogOut } from 'lucide-react';
import { Navigate, Outlet, useNavigate } from 'react-router';
import { usePublicConfig } from '../core/config/index.js';
import { sessionStore, useDevice, useSession } from '../core/session/index.js';
import { ConnectionIndicator } from '../core/ui/index.js';
import type { DeviceArea } from './device-areas.js';
import { useBrowserOnline } from './use-browser-online.js';

export function AppShell({ area }: { area: DeviceArea }) {
  const status = useBrowserOnline();
  const device = useDevice();
  const session = useSession();
  const config = usePublicConfig();
  const navigate = useNavigate();

  if (!device) return <Navigate to="/emparejar" replace />;
  if (!session) return <Navigate to="/entrar" replace />;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only rounded-md bg-primary px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-20"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-10 flex min-h-14 items-center gap-4 border-b border-accent bg-background px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <p className="hidden truncate text-sm font-semibold text-secondary sm:block">
            {config.data?.tradeName ?? 'Mise'}
          </p>
          <h1 className="truncate text-lg font-bold">{area.title}</h1>
        </div>
        <ConnectionIndicator status={status} />
        <span className="hidden text-sm font-semibold md:block">{session.user.fullName}</span>
        <button
          type="button"
          onClick={() => {
            void sessionStore.logout().then(() => navigate('/entrar', { replace: true }));
          }}
          className="flex min-h-12 items-center gap-2 rounded-md px-3 text-sm font-semibold text-secondary hover:bg-surface"
        >
          <LogOut aria-hidden className="size-5" />
          <span>Salir</span>
        </button>
      </header>
      <main
        id="contenido"
        className="flex flex-1 flex-col px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <Outlet />
      </main>
    </div>
  );
}
