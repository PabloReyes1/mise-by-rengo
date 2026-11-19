// Rutas de mesas y ocupaciones (Docs/08 §2.5). Dueño: Pablito.
import { idSchema } from '@mise/shared/contracts/common';
import {
  createTableSchema,
  diningTableSchema,
  floorResponseSchema,
  listOccupanciesQuerySchema,
  mergeOccupancyRequestSchema,
  moveOccupancyRequestSchema,
  transferOccupancyRequestSchema,
  occupancyListSchema,
  occupancySchema,
  openOccupancyRequestSchema,
  saveZoneSchema,
  updateOccupancyRequestSchema,
  updateTableSchema,
  zoneSchema,
} from '@mise/shared/contracts/floor';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../core/auth.js';
import { authorize } from '../auth/index.js';
import {
  createTable,
  getFloor,
  getOccupancy,
  listOccupancies,
  listZones,
  mergeOccupancies,
  moveOccupancy,
  openOccupancy,
  transferOccupancy,
  requestBranchId,
  saveZone,
  updateGuests,
  updateTable,
  type Actor,
} from './floor.service.js';

const params = z.object({ id: idSchema });

function actor(req: FastifyRequest): Actor {
  return {
    userId: req.auth!.userId,
    deviceId: req.auth!.deviceId,
    authorizedBy: req.authorizedBy,
    ip: req.ip,
    permissions: req.auth!.permissions,
  };
}

export const floorRoutes: FastifyPluginCallbackZod = (app, _options, done) => {
  const { prisma } = app;
  const branch = (req: FastifyRequest) => requestBranchId(prisma, req.auth!);
  const tablesAdmin = [authenticate, authorize('config.tables')];

  // Mapa de mesas de la sucursal
  app.get(
    '/api/floor',
    { preHandler: [authenticate], schema: { response: { 200: floorResponseSchema } } },
    async (req) => getFloor(prisma, await branch(req)),
  );

  // Zonas
  app.get(
    '/api/zones',
    { preHandler: tablesAdmin, schema: { response: { 200: z.array(zoneSchema) } } },
    async (req) => listZones(prisma, await branch(req)),
  );
  app.post(
    '/api/zones',
    { preHandler: tablesAdmin, schema: { body: saveZoneSchema, response: { 201: zoneSchema } } },
    async (req, reply) =>
      reply.status(201).send(await saveZone(prisma, await branch(req), null, req.body, actor(req))),
  );
  app.put(
    '/api/zones/:id',
    {
      preHandler: tablesAdmin,
      schema: { params, body: saveZoneSchema, response: { 200: zoneSchema } },
    },
    async (req) => saveZone(prisma, await branch(req), req.params.id, req.body, actor(req)),
  );

  // Mesas
  app.post(
    '/api/tables',
    {
      preHandler: tablesAdmin,
      schema: { body: createTableSchema, response: { 201: diningTableSchema } },
    },
    async (req, reply) =>
      reply.status(201).send(await createTable(prisma, await branch(req), req.body, actor(req))),
  );
  app.put(
    '/api/tables/:id',
    {
      preHandler: tablesAdmin,
      schema: { params, body: updateTableSchema, response: { 200: diningTableSchema } },
    },
    async (req) => updateTable(prisma, await branch(req), req.params.id, req.body, actor(req)),
  );

  // Ocupaciones
  app.post(
    '/api/occupancies',
    {
      preHandler: [authenticate, authorize('table.open')],
      schema: {
        body: openOccupancyRequestSchema,
        response: { 200: occupancySchema, 201: occupancySchema },
      },
    },
    async (req, reply) => {
      const { occupancy, created } = await openOccupancy(
        prisma,
        await branch(req),
        req.body,
        actor(req),
      );
      // 201 al crear; 200 si es un reenvío del mismo id (idempotente)
      return reply.status(created ? 201 : 200).send(occupancy);
    },
  );
  app.get(
    '/api/occupancies',
    {
      preHandler: [authenticate],
      schema: { querystring: listOccupanciesQuerySchema, response: { 200: occupancyListSchema } },
    },
    async (req) => listOccupancies(prisma, await branch(req), req.query.status),
  );
  app.get(
    '/api/occupancies/:id',
    { preHandler: [authenticate], schema: { params, response: { 200: occupancySchema } } },
    async (req) => getOccupancy(prisma, await branch(req), req.params.id, actor(req)),
  );
  app.patch(
    '/api/occupancies/:id',
    {
      preHandler: [authenticate],
      schema: { params, body: updateOccupancyRequestSchema, response: { 200: occupancySchema } },
    },
    async (req) => updateGuests(prisma, await branch(req), req.params.id, req.body, actor(req)),
  );

  // Unir, trasladar y transferir (🔑 si falta el permiso)
  app.post(
    '/api/occupancies/:id/merge',
    {
      preHandler: [authenticate, authorize('table.merge')],
      schema: { params, body: mergeOccupancyRequestSchema, response: { 200: occupancySchema } },
    },
    async (req) =>
      mergeOccupancies(
        prisma,
        await branch(req),
        req.params.id,
        req.body.sourceOccupancyId,
        actor(req),
      ),
  );
  app.post(
    '/api/occupancies/:id/move',
    {
      preHandler: [authenticate, authorize('table.move')],
      schema: { params, body: moveOccupancyRequestSchema, response: { 200: occupancySchema } },
    },
    async (req) =>
      moveOccupancy(prisma, await branch(req), req.params.id, req.body.targetTableId, actor(req)),
  );
  app.post(
    '/api/occupancies/:id/transfer',
    {
      preHandler: [authenticate, authorize('table.transfer_waiter')],
      schema: { params, body: transferOccupancyRequestSchema, response: { 200: occupancySchema } },
    },
    async (req) =>
      transferOccupancy(prisma, await branch(req), req.params.id, req.body.waiterId, actor(req)),
  );

  done();
};
