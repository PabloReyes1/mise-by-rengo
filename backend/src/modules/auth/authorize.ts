// preHandler de permisos con autorización 🔑 (Docs/03 §5 regla 3, Docs/08 §1).
// Si el usuario no tiene el permiso, la petición puede traer { authorization: { userId, pin } }
// de otro usuario que sí lo tenga. Vale para esta sola petición.
import { authorizationSchema } from '@mise/shared/contracts/auth';
import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { AppError } from '../../core/errors.js';
import { verifyAuthorizer } from './auth.service.js';

export function authorize(permission: string): preHandlerAsyncHookHandler {
  return async function (req: FastifyRequest) {
    const auth = req.auth;
    if (!auth) throw new AppError('UNAUTHENTICATED', 'Inicia sesión para continuar');
    if (auth.permissions.includes(permission)) return;

    const body = req.body as { authorization?: unknown } | undefined;
    const parsed = authorizationSchema.safeParse(body?.authorization);
    if (!parsed.success) {
      throw new AppError('AUTHORIZATION_REQUIRED', 'Esta acción requiere autorización', {
        permission,
      });
    }
    await verifyAuthorizer(req.server.prisma, {
      ...parsed.data,
      permission,
      branchId: auth.branchId,
    });
    req.authorizedBy = parsed.data.userId;
  };
}
