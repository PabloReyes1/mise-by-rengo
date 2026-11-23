// Rutas de administración de usuarios y roles (Docs/08 §2.3; H3 #21).
import {
  adminUserSchema,
  createUserRequestSchema,
  rolesResponseSchema,
  setPinRequestSchema,
  updateUserRequestSchema,
  usersResponseSchema,
} from '@mise/shared/contracts/auth';
import { idSchema } from '@mise/shared/contracts/common';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../core/auth.js';
import { AppError } from '../../core/errors.js';
import { authorize } from './authorize.js';
import {
  createUser,
  listRoles,
  listUsers,
  setUserPin,
  updateUser,
  type AdminActor,
} from './users.service.js';

const actorOf = (req: FastifyRequest): AdminActor => ({
  userId: req.auth!.userId,
  deviceId: req.auth!.deviceId,
  ip: req.ip,
});

/** La lista de roles la necesitan quien administra usuarios y quien administra roles. */
function canSeeRoles(req: FastifyRequest): Promise<void> {
  const perms = req.auth?.permissions ?? [];
  if (!perms.includes('config.users') && !perms.includes('config.roles'))
    return Promise.reject(new AppError('FORBIDDEN', 'No tienes permiso para ver los roles'));
  return Promise.resolve();
}

export const usersRoutes: FastifyPluginCallbackZod = (app, _options, done) => {
  const { prisma } = app;
  const params = z.object({ id: idSchema });

  app.get(
    '/api/users',
    {
      preHandler: [authenticate, authorize('config.users')],
      schema: { response: { 200: usersResponseSchema } },
    },
    () => listUsers(prisma),
  );

  app.post(
    '/api/users',
    {
      preHandler: [authenticate, authorize('config.users')],
      schema: {
        body: createUserRequestSchema,
        response: { 200: adminUserSchema, 201: adminUserSchema },
      },
    },
    async (req, reply) => {
      const { user, created } = await createUser(prisma, req.body, actorOf(req));
      return reply.status(created ? 201 : 200).send(user);
    },
  );

  app.put(
    '/api/users/:id',
    {
      preHandler: [authenticate, authorize('config.users')],
      schema: { params, body: updateUserRequestSchema, response: { 200: adminUserSchema } },
    },
    (req) => updateUser(prisma, req.params.id, req.body, actorOf(req)),
  );

  app.post(
    '/api/users/:id/pin',
    {
      preHandler: [authenticate, authorize('config.users')],
      schema: { params, body: setPinRequestSchema, response: { 200: adminUserSchema } },
    },
    (req) => setUserPin(prisma, req.params.id, req.body.pin, actorOf(req)),
  );

  app.get(
    '/api/roles',
    {
      preHandler: [authenticate, canSeeRoles],
      schema: { response: { 200: rolesResponseSchema } },
    },
    () => listRoles(prisma),
  );

  done();
};
