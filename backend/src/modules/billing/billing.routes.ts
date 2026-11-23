// Rutas de cuentas, parte de sala (Docs/08 §2.7). Dueño: Pablito.
import {
  billSchema,
  createBillRequestSchema,
  moveBillItemsRequestSchema,
  moveBillItemsResponseSchema,
  occupancyBillsResponseSchema,
  splitOrderItemRequestSchema,
  splitOrderItemResponseSchema,
  updateBillRequestSchema,
} from '@mise/shared/contracts/billing';
import { idSchema } from '@mise/shared/contracts/common';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../core/auth.js';
import { authorize } from '../auth/index.js';
import { requestBranchId, tableAuthorization, type Actor } from '../floor/index.js';
import {
  createBill,
  listOccupancyBills,
  moveBillItems,
  splitOrderItem,
  updateBill,
} from './billing.service.js';

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

export const billingRoutes: FastifyPluginCallbackZod = (app, _options, done) => {
  const { prisma } = app;
  const branch = (req: FastifyRequest) => requestBranchId(prisma, req.auth!);
  const split = [authenticate, authorize('bill.split'), tableAuthorization];

  app.get(
    '/api/occupancies/:id/bills',
    {
      preHandler: [authenticate],
      schema: { params, response: { 200: occupancyBillsResponseSchema } },
    },
    async (req) => listOccupancyBills(prisma, await branch(req), req.params.id, actor(req)),
  );

  // 201 al crear; 200 si es un reenvío del mismo id (idempotente)
  app.post(
    '/api/occupancies/:id/bills',
    {
      preHandler: split,
      schema: {
        params,
        body: createBillRequestSchema,
        response: { 200: billSchema, 201: billSchema },
      },
    },
    async (req, reply) => {
      const { bill, created } = await createBill(
        prisma,
        await branch(req),
        req.params.id,
        req.body,
        actor(req),
      );
      return reply.status(created ? 201 : 200).send(bill);
    },
  );

  app.patch(
    '/api/bills/:id',
    {
      preHandler: split,
      schema: { params, body: updateBillRequestSchema, response: { 200: billSchema } },
    },
    async (req) => updateBill(prisma, await branch(req), req.params.id, req.body, actor(req)),
  );

  app.post(
    '/api/bills/move-items',
    {
      preHandler: split,
      schema: { body: moveBillItemsRequestSchema, response: { 200: moveBillItemsResponseSchema } },
    },
    async (req) => ({
      bills: await moveBillItems(prisma, await branch(req), req.body, actor(req)),
    }),
  );

  app.post(
    '/api/order-items/:id/split',
    {
      preHandler: split,
      schema: {
        params,
        body: splitOrderItemRequestSchema,
        response: { 200: splitOrderItemResponseSchema },
      },
    },
    async (req) => splitOrderItem(prisma, await branch(req), req.params.id, req.body, actor(req)),
  );

  done();
};
