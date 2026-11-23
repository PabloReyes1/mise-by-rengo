// Rutas de caja (Docs/08 §2.8). Dueño: Pablito; reasignado a Deniscito (doc 17 §3.1, H3 #18).
import {
  cashRegistersResponseSchema,
  closeShiftRequestSchema,
  shiftReportSchema,
  createMovementRequestSchema,
  openShiftRequestSchema,
  shiftDetailSchema,
  shiftSummarySchema,
} from '@mise/shared/contracts/cash';
import { idSchema } from '@mise/shared/contracts/common';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../core/auth.js';
import { authorize } from '../auth/index.js';
import { requestBranchId } from '../floor/index.js';
import { announce } from '../realtime/index.js';
import { addMovement, getShift, listCashRegisters, openShift, type Actor } from './cash.service.js';
import { closeShift, getShiftReport, startClose } from './close.service.js';

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

export const cashRoutes: FastifyPluginCallbackZod = (app, _options, done) => {
  const { prisma } = app;
  const branch = (req: FastifyRequest) => requestBranchId(prisma, req.auth!);

  app.get(
    '/api/cash-registers',
    { preHandler: [authenticate], schema: { response: { 200: cashRegistersResponseSchema } } },
    async (req) => listCashRegisters(prisma, await branch(req), actor(req)),
  );

  // Abrir turno: solo en línea (PA-042); 201 al crear, 200 si es el mismo id
  app.post(
    '/api/shifts',
    {
      preHandler: [authenticate, authorize('cash.open_shift')],
      schema: {
        body: openShiftRequestSchema,
        response: { 200: shiftSummarySchema, 201: shiftSummarySchema },
      },
    },
    async (req, reply) => {
      const b = await branch(req);
      const r = await openShift(prisma, b, req.body, actor(req));
      if (r.created) announce(app, b, 'shift.opened', ['cash'], r.shift);
      return reply.status(r.created ? 201 : 200).send(r.shift);
    },
  );

  app.get(
    '/api/shifts/:id',
    {
      preHandler: [authenticate, authorize('cash.open_shift')],
      schema: { params, response: { 200: shiftDetailSchema } },
    },
    async (req) => getShift(prisma, await branch(req), req.params.id, actor(req)),
  );

  app.post(
    '/api/shifts/:id/movements',
    {
      preHandler: [authenticate, authorize('cash.movement')],
      schema: { params, body: createMovementRequestSchema, response: { 200: shiftDetailSchema } },
    },
    async (req) => addMovement(prisma, await branch(req), req.params.id, req.body, actor(req)),
  );

  // Corte (Docs/05 paso 13, H3 #20)
  app.post(
    '/api/shifts/:id/start-close',
    {
      preHandler: [authenticate, authorize('cash.close_shift')],
      schema: { params, response: { 200: shiftReportSchema } },
    },
    async (req) => startClose(prisma, await branch(req), req.params.id, actor(req)),
  );
  app.post(
    '/api/shifts/:id/close',
    {
      preHandler: [authenticate, authorize('cash.close_shift')],
      schema: { params, body: closeShiftRequestSchema, response: { 200: shiftReportSchema } },
    },
    async (req) => {
      const b = await branch(req);
      const report = await closeShift(prisma, b, req.params.id, req.body, actor(req));
      announce(app, b, 'shift.closed', ['cash'], { shiftId: report.shiftId });
      return report;
    },
  );
  app.get(
    '/api/shifts/:id/report',
    {
      preHandler: [authenticate, authorize('cash.close_shift')],
      schema: { params, response: { 200: shiftReportSchema } },
    },
    async (req) => getShiftReport(prisma, await branch(req), req.params.id, actor(req)),
  );

  done();
};
