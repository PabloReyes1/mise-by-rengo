// Áreas de la PWA por tipo de dispositivo (Docs/06 §3.4) y su dueño (Docs/17 §1).

export interface DeviceArea {
  path: string;
  title: string;
  owner: 'Pablito' | 'Deniscito';
  /** Hito en que se construye la primera pantalla (Docs/17 §5) */
  milestone: string;
}

export const DEVICE_AREAS: readonly DeviceArea[] = [
  { path: '/mesero', title: 'Mesero', owner: 'Pablito', milestone: 'H1' },
  { path: '/caja', title: 'Caja', owner: 'Pablito', milestone: 'H3' },
  { path: '/kds', title: 'Cocina', owner: 'Deniscito', milestone: 'H2' },
  { path: '/admin', title: 'Administración', owner: 'Deniscito', milestone: 'H1' },
  { path: '/reportes', title: 'Reportes', owner: 'Deniscito', milestone: 'H4' },
];
