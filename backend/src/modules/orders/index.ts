// Módulo orders: rondas enviadas a cocina y sus ítems (Docs/07 §4.4, Docs/08 §2.6). Dueño: Pablito.
// Para kitchen (Deniscito): orderInclude + toOrder convierten un pedido de la base al de la API.
import { ordersRoutes } from './orders.routes.js';

export { orderInclude, toOrder, type OrderRow } from './orders.service.js';
export const ordersModule = ordersRoutes;
