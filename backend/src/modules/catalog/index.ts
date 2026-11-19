// Módulo catalog (Docs/07 §4.3, Docs/08 §2.4). Dueño: Deniscito.
// Para otros módulos (ej. orders de Pablito): getMenu da precios y estado de cada producto.
import { catalogRoutes } from './catalog.routes.js';

export { getMenu } from './catalog.service.js';
export const catalogModule = catalogRoutes;
