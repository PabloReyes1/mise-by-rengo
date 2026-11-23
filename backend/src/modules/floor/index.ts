// Módulo floor: zonas, mesas y ocupaciones (Docs/07 §4.4, Docs/08 §2.5). Dueño: Pablito.
// Para otros módulos (orders, billing): requestBranchId da la sucursal de la petición y
// assertCanOperate dice si el actor puede operar la mesa (dueño, table.view_all o 🔑).
import { floorRoutes } from './floor.routes.js';

export { businessDate } from './business-date.js';
export { assertCanOperate, requestBranchId, type Actor } from './floor.service.js';
export { tableAuthorization } from './table-authorization.js';
export const floorModule = floorRoutes;
