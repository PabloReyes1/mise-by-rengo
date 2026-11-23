// Rutas de cuentas, parte de sala (Docs/08 §2.7). Dueño: Pablito.
import {
  billSchema,
  createBillRequestSchema,
  moveBillItemsRequestSchema,
  moveBillItemsResponseSchema,
  occupancyBillsResponseSchema,
  payBillRequestSchema,
  paymentMethodSchema,
  receiptSchema,
  precheckRequestSchema,
  precheckResponseSchema,
  splitOrderItemRequestSchema,
  splitOrderItemResponseSchema,
  updateBillRequestSchema,
} from '@mise/shared/contracts/billing';
import { idSchema } from '@mise/shared/contracts/common';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../core/auth.js';
import { toDbId } from '../../core/ids.js';
import { announce, REALTIME_EVENTS as EV } from '../realtime/index.js';
import { authorize } from '../auth/index.js';
import { requestBranchId, tableAuthorization, type Actor } from '../floor/index.js';
import {
  createBill,
  listOccupancyBills,
  moveBillItems,
  precheckBill,
  splitOrderItem,
  updateBill,
} from './billing.service.js';
import { getReceipt, listPaymentMethods, payBill } from './payment.service.js';

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
  const reprintGuard = authorize('bill.reprint');

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
      const b = await branch(req);
      const { bill, created } = await createBill(prisma, b, req.params.id, req.body, actor(req));
      if (created) announce(app, b, EV.billUpdated, ['branch'], { occupancyId: bill.occupancyId });
      return reply.status(created ? 201 : 200).send(bill);
    },
  );

  app.patch(
    '/api/bills/:id',
    {
      preHandler: split,
      schema: { params, body: updateBillRequestSchema, response: { 200: billSchema } },
    },
    async (req) => {
      const b = await branch(req);
      const bill = await updateBill(prisma, b, req.params.id, req.body, actor(req));
      announce(app, b, EV.billUpdated, ['branch'], { occupancyId: bill.occupancyId });
      return bill;
    },
  );

  app.post(
    '/api/bills/move-items',
    {
      preHandler: split,
      schema: { body: moveBillItemsRequestSchema, response: { 200: moveBillItemsResponseSchema } },
    },
    async (req) => {
      const b = await branch(req);
      const bills = await moveBillItems(prisma, b, req.body, actor(req));
      for (const occupancyId of new Set(bills.map((x) => x.occupancyId)))
        announce(app, b, EV.billUpdated, ['branch'], { occupancyId });
      return { bills };
    },
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
    async (req) => {
      const b = await branch(req);
      const result = await splitOrderItem(prisma, b, req.params.id, req.body, actor(req));
      announce(app, b, EV.billUpdated, ['branch'], {
        billIds: [result.original.billId, result.created.billId],
      });
      return result;
    },
  );

  // Cobro (Docs/05 pasos 11 y 12, H3 #19)
  app.get(
    '/api/payment-methods',
    { preHandler: [authenticate], schema: { response: { 200: z.array(paymentMethodSchema) } } },
    async () => listPaymentMethods(prisma),
  );
  app.post(
    '/api/bills/:id/pay',
    {
      preHandler: [authenticate, authorize('payment.register'), tableAuthorization],
      schema: { params, body: payBillRequestSchema, response: { 200: receiptSchema } },
    },
    async (req) => {
      const b = await branch(req);
      const r = await payBill(prisma, b, req.params.id, req.body, actor(req));
      if (r.created) {
        announce(app, b, EV.billPaid, ['branch', 'cash'], { occupancyId: r.occupancyId });
        if (r.receipt.occupancyClosed)
          announce(app, b, EV.occupancyClosed, ['branch'], { id: r.occupancyId });
      }
      return r.receipt;
    },
  );
  app.get(
    '/api/bills/:id/receipt',
    {
      preHandler: [authenticate, authorize('bill.reprint'), tableAuthorization],
      schema: { params, response: { 200: receiptSchema } },
    },
    async (req) => getReceipt(prisma, await branch(req), req.params.id, actor(req)),
  );

  // Pre-cuenta (Docs/05 paso 10). Reimprimir pide bill.reprint o 🔑
  app.post(
    '/api/bills/:id/precheck',
    {
      preHandler: [authenticate, authorize('bill.print_precheck'), tableAuthorization],
      schema: { params, body: precheckRequestSchema, response: { 200: precheckResponseSchema } },
    },
    async (req, reply) => {
      const b = await branch(req);
      const current = await prisma.bill.findUnique({ where: { id: toDbId(req.params.id) } });
      if (current?.status === 'PRECUENTA') await reprintGuard.call(app, req, reply);
      const r = await precheckBill(prisma, b, req.params.id, actor(req));
      announce(app, b, EV.billUpdated, ['branch'], { occupancyId: r.occupancyId });
      for (const id of r.autoDelivered) announce(app, b, EV.orderDelivered, ['branch'], { id });
      return r.result;
    },
  );

  done();
};
