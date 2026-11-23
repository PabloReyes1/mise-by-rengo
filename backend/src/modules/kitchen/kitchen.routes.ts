// Rutas del KDS (Docs/08 §2.6). Dueño: Deniscito.
// Cada cambio se avisa por tiempo real a cocina, sala y al mesero del pedido; "listo", también a
// la caja (Docs/08 §3.1, Docs/05 paso 8).
import { idSchema } from '@mise/shared/contracts/common';
import {
  kdsOrderSchema,
  kdsOrdersQuerySchema,
  kdsOrdersResponseSchema,
  type KdsOrder,
} from '@mise/shared/contracts/kitchen';
import type { RealtimeRoom } from '@mise/shared/contracts/realtime';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../core/auth.js';
import { authorize } from '../auth/index.js';
import { requestBranchId } from '../floor/index.js';
import { announce, REALTIME_EVENTS as EV } from '../realtime/index.js';
import {
  acceptOrder,
  itemReady,
  listKdsOrders,
  orderReady,
  recallOrder,
  type Actor,
} from './kitchen.service.js';

const params = z.object({ id: idSchema });

function actor(req: FastifyRequest): Actor {
  return { userId: req.auth!.userId, deviceId: req.auth!.deviceId, ip: req.ip };
}

export const kitchenRoutes: FastifyPluginCallbackZod = (app, _options, done) => {
  const { prisma } = app;
  const branch = (req: FastifyRequest) => requestBranchId(prisma, req.auth!);
  const operate = [authenticate, authorize('kds.operate')];
  const emit = (b: string, event: string, order: KdsOrder, extra: RealtimeRoom[] = []) =>
    announce(app, b, event, ['kds', 'branch', `user:${order.waiterId}`, ...extra], order);

  app.get(
    '/api/kds/orders',
    {
      preHandler: operate,
      schema: { querystring: kdsOrdersQuerySchema, response: { 200: kdsOrdersResponseSchema } },
    },
    async (req) => listKdsOrders(prisma, await branch(req), req.query.status),
  );

  app.post(
    '/api/orders/:id/accept',
    { preHandler: operate, schema: { params, response: { 200: kdsOrderSchema } } },
    async (req) => {
      const b = await branch(req);
      const r = await acceptOrder(prisma, b, req.params.id, actor(req));
      if (r.changed) emit(b, EV.orderAccepted, r.order);
      return r.order;
    },
  );

  app.post(
    '/api/orders/:id/ready',
    { preHandler: operate, schema: { params, response: { 200: kdsOrderSchema } } },
    async (req) => {
      const b = await branch(req);
      const r = await orderReady(prisma, b, req.params.id, actor(req));
      if (r.changed) emit(b, EV.orderReady, r.order, ['cash']);
      return r.order;
    },
  );

  app.post(
    '/api/order-items/:id/ready',
    { preHandler: operate, schema: { params, response: { 200: kdsOrderSchema } } },
    async (req) => {
      const b = await branch(req);
      const r = await itemReady(prisma, b, req.params.id, actor(req));
      if (r.changed) emit(b, EV.orderItemReady, r.order);
      if (r.orderReady) emit(b, EV.orderReady, r.order, ['cash']);
      return r.order;
    },
  );

  app.post(
    '/api/orders/:id/recall',
    {
      preHandler: [authenticate, authorize('kds.recall')],
      schema: { params, response: { 200: kdsOrderSchema } },
    },
    async (req) => {
      const b = await branch(req);
      const r = await recallOrder(prisma, b, req.params.id, actor(req));
      if (r.changed) emit(b, EV.orderRecalled, r.order);
      return r.order;
    },
  );

  done();
};
