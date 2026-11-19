// Rutas de config (Docs/08 §2.1 config/public y §2.3).
import { idSchema } from '@mise/shared/contracts/common';
import {
  branchSchema,
  createBranchSchema,
  docTypeSchema,
  licenseSchema,
  publicConfigSchema,
  settingsSchema,
  ticketTemplateSchema,
  updateBranchSchema,
  updateSettingsSchema,
  updateTicketTemplateSchema,
} from '@mise/shared/contracts/config';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../core/auth.js';
import { AppError } from '../../core/errors.js';
import { newDbId } from '../../core/ids.js';
import { processImage } from '../../core/media.js';
import { authorize } from '../auth/index.js';
import {
  createBranch,
  getSettings,
  listBranches,
  listTicketTemplates,
  toSettings,
  updateBranch,
  updateSettings,
  updateTicketTemplate,
  type Actor,
} from './config.service.js';
import type { licenseReader } from './license.js';

function actor(req: FastifyRequest): Actor {
  return {
    userId: req.auth!.userId,
    deviceId: req.auth!.deviceId,
    authorizedBy: req.authorizedBy,
    ip: req.ip,
  };
}

export function configRoutes(license: ReturnType<typeof licenseReader>): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    const { prisma } = app;
    const restaurant = [authenticate, authorize('config.restaurant')];

    app.get(
      '/api/config/public',
      { schema: { response: { 200: publicConfigSchema } } },
      async () => {
        const s = await getSettings(prisma);
        const l = await license.get();
        return {
          tradeName: s.tradeName,
          logoUrl: s.logoMediaId ? `/api/config/logo?v=${s.settingsVersion}` : null,
          themeId: s.themeId,
          colorPrimaryOverride: s.colorPrimaryOverride,
          locale: s.locale,
          currency: s.currencyCode,
          currencySymbol: s.currencySymbol,
          decimals: s.decimals,
          timeZone: s.timezone,
          uiTexts: (s.uiTexts ?? {}) as Record<string, string>,
          modules: (l?.modules ?? {}) as Record<string, boolean>,
          licenseStatus: l?.status ?? 'ACTIVA',
          settingsVersion: s.settingsVersion,
          minFrontendVersion: app.env.MIN_FRONTEND_VERSION,
        };
      },
    );

    app.get(
      '/api/config/settings',
      { preHandler: restaurant, schema: { response: { 200: settingsSchema } } },
      async () => toSettings(await getSettings(prisma)),
    );

    app.put(
      '/api/config/settings',
      {
        preHandler: restaurant,
        schema: { body: updateSettingsSchema, response: { 200: settingsSchema } },
      },
      (req) => updateSettings(prisma, req.body, actor(req)),
    );

    // Logo (RF-001): se redimensiona igual que las fotos de productos (ADR-009)
    app.post('/api/config/logo', { preHandler: restaurant }, async (req) => {
      const file = await req.file();
      if (!file) throw new AppError('VALIDATION_ERROR', 'Falta la imagen');
      const image = await processImage(await file.toBuffer(), file.mimetype);
      const settings = await getSettings(prisma);
      const mediaId = newDbId();
      await prisma.$transaction([
        prisma.media.create({ data: { id: mediaId, ...image } }),
        prisma.clientSettings.update({
          where: { id: settings.id },
          data: { logoMediaId: mediaId, settingsVersion: { increment: 1 } },
        }),
      ]);
      return { logoUrl: `/api/config/logo?v=${settings.settingsVersion + 1}` };
    });

    // Público, como las imágenes de productos (S-11): se cachea por la versión en la URL
    app.get('/api/config/logo', async (_req, reply) => {
      const settings = await getSettings(prisma);
      if (!settings.logoMediaId) throw new AppError('NOT_FOUND', 'El restaurante no tiene logo');
      const media = await prisma.media.findUniqueOrThrow({ where: { id: settings.logoMediaId } });
      return reply
        .header('content-type', media.mime)
        .header('cache-control', 'public, max-age=31536000, immutable')
        .header('etag', `"${media.sha256}"`)
        .send(Buffer.from(media.bytes));
    });

    app.get(
      '/api/license',
      { preHandler: restaurant, schema: { response: { 200: licenseSchema } } },
      async () => {
        const l = await license.get();
        if (!l) throw new AppError('NOT_FOUND', 'No hay licencia');
        return {
          plan: l.plan,
          status: l.status,
          modules: l.modules as Record<string, boolean>,
          limits: l.limits as Record<string, number>,
          validUntil: l.validUntil ? l.validUntil.toISOString().slice(0, 10) : null,
          graceDays: l.graceDays,
          daysLeft: l.daysLeft,
        };
      },
    );

    app.get(
      '/api/branches',
      { preHandler: restaurant, schema: { response: { 200: z.array(branchSchema) } } },
      () => listBranches(prisma),
    );

    app.post(
      '/api/branches',
      {
        preHandler: restaurant,
        schema: { body: createBranchSchema, response: { 201: branchSchema } },
      },
      async (req, reply) =>
        reply.status(201).send(await createBranch(prisma, req.body, actor(req))),
    );

    app.put(
      '/api/branches/:id',
      {
        preHandler: restaurant,
        schema: {
          params: z.object({ id: idSchema }),
          body: updateBranchSchema,
          response: { 200: branchSchema },
        },
      },
      (req) => updateBranch(prisma, req.params.id, req.body, actor(req)),
    );

    app.get(
      '/api/branches/:id/ticket-templates',
      {
        preHandler: restaurant,
        schema: {
          params: z.object({ id: idSchema }),
          response: { 200: z.array(ticketTemplateSchema) },
        },
      },
      (req) => listTicketTemplates(prisma, req.params.id),
    );

    app.put(
      '/api/branches/:id/ticket-templates/:docType',
      {
        preHandler: restaurant,
        schema: {
          params: z.object({ id: idSchema, docType: docTypeSchema }),
          body: updateTicketTemplateSchema,
          response: { 200: ticketTemplateSchema },
        },
      },
      (req) =>
        updateTicketTemplate(prisma, req.params.id, req.params.docType, req.body, actor(req)),
    );

    done();
  };
}
