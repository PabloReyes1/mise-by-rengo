// Módulo recipes: insumos, unidades, recetas y costeo (Docs/07 §4.6, Docs/08 §2.9).
// Dueño: Deniscito; reasignado a Pablito (doc 17 §3.1, H3 #22).
// Para orders: itemUnitCost da el costo teórico que se congela en la venta (RF-139).
import { recipesRoutes } from './recipes.routes.js';

export { itemUnitCost } from './recipes.service.js';
export const recipesModule = recipesRoutes;
