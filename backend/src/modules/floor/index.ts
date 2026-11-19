// Módulo floor: zonas, mesas y ocupaciones (Docs/07 §4.4, Docs/08 §2.5). Dueño: Pablito.
// Para otros módulos (orders, billing): requestBranchId da la sucursal de la petición.
import { floorRoutes } from './floor.routes.js';

export { businessDate } from './business-date.js';
export { requestBranchId } from './floor.service.js';
export const floorModule = floorRoutes;
