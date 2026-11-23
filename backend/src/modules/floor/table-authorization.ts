// 🔑 para operar la mesa de otro mesero (SC-33). Dueño: Pablito. Lo usan floor y orders.
// authorize('permiso') solo revisa la 🔑 cuando al usuario le falta ese permiso. Si lo tiene
// (ej. un mesero con table.move u order.create) pero la mesa es de otro, la 🔑 del cuerpo no se
// habría revisado y assertCanOperate la pediría otra vez sin fin. Este paso va después de
// authorize: si la acción trae 🔑 sin usar, la valida contra table.view_all.
import type { preHandlerAsyncHookHandler } from 'fastify';
import { authorize } from '../auth/index.js';

const viewAll = authorize('table.view_all');

export const tableAuthorization: preHandlerAsyncHookHandler = async function (req, reply) {
  if (req.authorizedBy) return; // authorize ya la validó
  if (!(req.body as { authorization?: unknown } | undefined)?.authorization) return;
  await viewAll.call(this, req, reply);
};
