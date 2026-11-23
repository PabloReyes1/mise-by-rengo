// Rutas de administración de usuarios, roles y permisos (Docs/08 §2.3; H3 #21).
import {
  adminUserSchema,
  createRoleRequestSchema,
  createUserRequestSchema,
  discountLimitsRequestSchema,
  PERMISSIONS,
  permissionsResponseSchema,
  roleSchema,
  rolesResponseSchema,
  setPinRequestSchema,
  updateRoleRequestSchema,
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
  createRole,
  deleteRole,
  listRoles,
  setDiscountLimits,
  updateRole,
} from './roles.service.js';
import { createUser, listUsers, setUserPin, updateUser, type AdminActor } from './users.service.js';

const actorOf = (req: FastifyRequest): AdminActor => ({
  userId: req.auth!.userId,
  deviceId: req.auth!.deviceId,
  ip: req.ip,
  permissions: req.auth!.permissions,
  authorizedBy: req.authorizedBy,
});

/** Roles y permisos los ven quien administra usuarios, roles o topes de descuento. */
function canSeeRoles(req: FastifyRequest): Promise<void> {
  const perms = req.auth?.permissions ?? [];
  if (!['config.users', 'config.roles', 'config.discounts'].some((p) => perms.includes(p)))
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

  app.get(
    '/api/permissions',
    {
      preHandler: [authenticate, canSeeRoles],
      schema: { response: { 200: permissionsResponseSchema } },
    },
    () => PERMISSIONS.map((p) => ({ code: p.code, description: p.description })),
  );

  app.post(
    '/api/roles',
    {
      preHandler: [authenticate, authorize('config.roles')],
      schema: { body: createRoleRequestSchema, response: { 200: roleSchema, 201: roleSchema } },
    },
    async (req, reply) => {
      const { role, created } = await createRole(prisma, req.body, actorOf(req));
      return reply.status(created ? 201 : 200).send(role);
    },
  );

  app.put(
    '/api/roles/:id',
    {
      preHandler: [authenticate, authorize('config.roles')],
      schema: { params, body: updateRoleRequestSchema, response: { 200: roleSchema } },
    },
    (req) => updateRole(prisma, req.params.id, req.body, actorOf(req)),
  );

  app.delete(
    '/api/roles/:id',
    { preHandler: [authenticate, authorize('config.roles')], schema: { params } },
    async (req, reply) => {
      await deleteRole(prisma, req.params.id, actorOf(req));
      return reply.status(204).send();
    },
  );

  app.put(
    '/api/roles/:id/discount-limits',
    {
      preHandler: [authenticate, authorize('config.discounts')],
      schema: { params, body: discountLimitsRequestSchema, response: { 200: roleSchema } },
    },
    (req) => setDiscountLimits(prisma, req.params.id, req.body, actorOf(req)),
  );

  done();
};
