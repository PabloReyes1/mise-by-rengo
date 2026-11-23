// Rutas de pedidos (Docs/08 §2.6). Dueño: Pablito.
// Las del KDS (aceptar, listo, recall) son de kitchen (Deniscito).
import { idSchema } from '@mise/shared/contracts/common';
import {
  cancelOrderItemRequestSchema,
  deliverOrderRequestSchema,
  occupancyOrdersResponseSchema,
  orderSchema,
  sendOrderRequestSchema,
} from '@mise/shared/contracts/orders';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../core/auth.js';
import { authorize } from '../auth/index.js';
import { requestBranchId, tableAuthorization, type Actor } from '../floor/index.js';
import { cancelOrderItem, deliverOrder, listOccupancyOrders, sendOrder } from './orders.service.js';

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

export const ordersRoutes: FastifyPluginCallbackZod = (app, _options, done) => {
  const { prisma } = app;
  const branch = (req: FastifyRequest) => requestBranchId(prisma, req.auth!);

  // Enviar ronda a cocina: 201 al crear, 200 si es un reenvío del mismo id (idempotente)
  app.post(
    '/api/orders',
    {
      preHandler: [authenticate, authorize('order.create'), tableAuthorization],
      schema: { body: sendOrderRequestSchema, response: { 200: orderSchema, 201: orderSchema } },
    },
    async (req, reply) => {
      const { order, created } = await sendOrder(prisma, await branch(req), req.body, actor(req));
      return reply.status(created ? 201 : 200).send(order);
    },
  );

  app.get(
    '/api/occupancies/:id/orders',
    {
      preHandler: [authenticate],
      schema: { params, response: { 200: occupancyOrdersResponseSchema } },
    },
    async (req) => listOccupancyOrders(prisma, await branch(req), req.params.id, actor(req)),
  );

  app.post(
    '/api/orders/:id/deliver',
    {
      preHandler: [authenticate, authorize('order.deliver'), tableAuthorization],
      schema: { params, body: deliverOrderRequestSchema, response: { 200: orderSchema } },
    },
    async (req) => deliverOrder(prisma, await branch(req), req.params.id, actor(req)),
  );

  app.post(
    '/api/order-items/:id/cancel',
    {
      preHandler: [authenticate, authorize('order.cancel_sent'), tableAuthorization],
      schema: { params, body: cancelOrderItemRequestSchema, response: { 200: orderSchema } },
    },
    async (req) => cancelOrderItem(prisma, await branch(req), req.params.id, req.body, actor(req)),
  );

  done();
};
