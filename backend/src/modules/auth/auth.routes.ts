// Rutas de auth (Docs/08 §2.2).
import {
  DEVICE_TOKEN_HEADER,
  deviceUsersResponseSchema,
  loginRequestSchema,
  pairDeviceRequestSchema,
  pairDeviceResponseSchema,
  pairingCodeRequestSchema,
  pairingCodeResponseSchema,
  pinLoginRequestSchema,
  refreshRequestSchema,
  sessionResponseSchema,
} from '@mise/shared/contracts/auth';
import { idSchema } from '@mise/shared/contracts/common';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../core/auth.js';
import { AppError } from '../../core/errors.js';
import { toDbId } from '../../core/ids.js';
import { authorize } from './authorize.js';
import {
  authenticateDevice,
  createPairingCode,
  deviceUsers,
  loginWithPassword,
  loginWithPin,
  logout,
  pairDevice,
  refreshSession,
  revokeDevice,
} from './auth.service.js';

function header(req: FastifyRequest, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function device(req: FastifyRequest) {
  return authenticateDevice(
    req.server.prisma,
    header(req, 'x-device-id'),
    header(req, DEVICE_TOKEN_HEADER),
  );
}

export const authRoutes: FastifyPluginCallbackZod = (app, _options, done) => {
  const { prisma, env, rateLimits } = app;
  const pairLimit = { rateLimit: { max: rateLimits.pairPerMinute, timeWindow: '1 minute' } };
  const loginLimit = { rateLimit: { max: rateLimits.loginPerMinute, timeWindow: '1 minute' } };

  app.post(
    '/api/devices/pairing-codes',
    {
      preHandler: [authenticate, authorize('config.devices')],
      schema: { body: pairingCodeRequestSchema, response: { 200: pairingCodeResponseSchema } },
    },
    async (req) => {
      const auth = req.auth!;
      if (!auth.permissions.includes('branch.all') && !auth.branchIds.includes(req.body.branchId)) {
        throw new AppError('BRANCH_FORBIDDEN', 'No tienes acceso a esa sucursal');
      }
      const { code, expiresAt } = await createPairingCode(prisma, {
        branchId: toDbId(req.body.branchId),
        createdBy: toDbId(auth.userId),
      });
      return { code, expiresAt: expiresAt.toISOString() };
    },
  );

  app.post(
    '/api/devices/pair',
    {
      config: pairLimit,
      schema: { body: pairDeviceRequestSchema, response: { 200: pairDeviceResponseSchema } },
    },
    (req) =>
      pairDevice(
        prisma,
        { ...req.body, platform: header(req, 'user-agent') ?? '' },
        { ip: req.ip },
      ),
  );

  app.delete(
    '/api/devices/:id',
    {
      preHandler: [authenticate, authorize('config.devices')],
      schema: { params: z.object({ id: idSchema }) },
    },
    async (req, reply) => {
      await revokeDevice(prisma, req.params.id, { userId: req.auth!.userId, ip: req.ip });
      return reply.status(204).send();
    },
  );

  app.post(
    '/api/auth/login',
    {
      config: loginLimit,
      schema: { body: loginRequestSchema, response: { 200: sessionResponseSchema } },
    },
    async (req) => loginWithPassword(prisma, env, await device(req), req.body, { ip: req.ip }),
  );

  app.post(
    '/api/auth/pin',
    {
      config: loginLimit,
      schema: { body: pinLoginRequestSchema, response: { 200: sessionResponseSchema } },
    },
    async (req) => loginWithPin(prisma, env, await device(req), req.body, { ip: req.ip }),
  );

  app.get(
    '/api/auth/device-users',
    { schema: { response: { 200: deviceUsersResponseSchema } } },
    async (req) => deviceUsers(prisma, await device(req)),
  );

  app.post(
    '/api/auth/refresh',
    {
      config: loginLimit,
      schema: { body: refreshRequestSchema, response: { 200: sessionResponseSchema } },
    },
    (req) => refreshSession(prisma, env, req.body.refreshToken),
  );

  app.post(
    '/api/auth/logout',
    { preHandler: [authenticate], schema: { body: refreshRequestSchema } },
    async (req, reply) => {
      await logout(prisma, req.body.refreshToken);
      return reply.status(204).send();
    },
  );

  done();
};
