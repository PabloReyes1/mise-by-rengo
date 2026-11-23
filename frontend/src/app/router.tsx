// Rutas de la PWA (Docs/06 §3.4): una aplicación por tipo de dispositivo.
// Cada módulo reemplaza su PendingModule cuando su dueño lo construya (Docs/17 §5).
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import {
  AdminLayout,
  CashRegistersPage,
  DevicesPage,
  MenuPage,
  PaymentMethodsPage,
  ReasonsPage,
  RestaurantPage,
  RolesPage,
  TablesPage,
  UsersPage,
} from '../modules/admin/index.js';
import { LoginPage, PairDevicePage } from '../modules/auth/index.js';
import {
  BillsPage,
  FloorPage,
  MeseroLayout,
  OccupancyPage,
  OrderPage,
} from '../modules/mesero/index.js';
import { CajaPage } from '../modules/caja/index.js';
import { KdsPage } from '../modules/cocina/index.js';
import { AppShell } from './AppShell.js';
import { DEVICE_AREAS } from './device-areas.js';
import { NotFound } from './NotFound.js';
import { PendingModule } from './PendingModule.js';
import { StartRedirect } from './StartRedirect.js';

const areaChildren: Record<string, RouteObject[]> = {
  // Caja (H3, reasignado a Deniscito)
  '/caja': [{ index: true, element: <CajaPage /> }],
  // Cocina (Deniscito, H2)
  '/kds': [{ index: true, element: <KdsPage /> }],
  // Mesero (Pablito, H1)
  '/mesero': [
    {
      // Tiempo real y aviso de pedidos listos sobre todas las pantallas del mesero
      element: <MeseroLayout />,
      children: [
        { index: true, element: <FloorPage /> },
        { path: 'ocupacion/:id', element: <OccupancyPage /> },
        { path: 'ocupacion/:id/pedido', element: <OrderPage /> },
        { path: 'ocupacion/:id/cuentas', element: <BillsPage /> },
      ],
    },
  ],
  '/admin': [
    {
      element: <AdminLayout />,
      children: [
        { index: true, element: <Navigate to="/admin/menu" replace /> },
        { path: 'restaurante', element: <RestaurantPage /> },
        { path: 'menu', element: <MenuPage /> },
        { path: 'mesas', element: <TablesPage /> },
        { path: 'cajas', element: <CashRegistersPage /> },
        { path: 'metodos-pago', element: <PaymentMethodsPage /> },
        { path: 'motivos', element: <ReasonsPage /> },
        { path: 'dispositivos', element: <DevicesPage /> },
        { path: 'usuarios', element: <UsersPage /> },
        { path: 'roles', element: <RolesPage /> },
      ],
    },
  ],
};

const routes: RouteObject[] = [
  // Sin dispositivo → emparejar; sin sesión → entrar; con sesión → el área de su tipo
  { path: '/', element: <StartRedirect /> },
  { path: '/emparejar', element: <PairDevicePage /> },
  { path: '/entrar', element: <LoginPage /> },
  ...DEVICE_AREAS.map((area): RouteObject => ({
    path: area.path,
    element: <AppShell area={area} />,
    children: areaChildren[area.path] ?? [{ index: true, element: <PendingModule area={area} /> }],
  })),
  { path: '*', element: <NotFound /> },
];

// Catálogo visual de componentes: solo en desarrollo, para revisar el sistema de diseño
if (import.meta.env.DEV) {
  routes.unshift({
    path: '/_ui',
    lazy: async () => ({ Component: (await import('./UiPreview.js')).UiPreview }),
  });
}

export const router = createBrowserRouter(routes);
