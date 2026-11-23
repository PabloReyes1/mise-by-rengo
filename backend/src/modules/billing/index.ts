// Módulo billing: cuentas, descuentos y cobro (Docs/08 §2.7). Dueño: Pablito.
// H2 (sala): cuentas de la mesa, mover ítems y separar unidades. recomputeBills lo usa orders.
// Descuentos, pre-cuenta, cobro y reapertura: H3.
import { billingRoutes } from './billing.routes.js';

export { recomputeBills } from './totals.js';
export const billingModule = billingRoutes;
