// Rutas del menú (Docs/08 §2.4).
import {
  categorySchema,
  createCategorySchema,
  menuResponseSchema,
  modifierGroupSchema,
  productSchema,
  productStatusRequestSchema,
  saveComboGroupsSchema,
  saveModifierGroupSchema,
  saveProductSchema,
  updateCategorySchema,
} from '@mise/shared/contracts/catalog';
import { idSchema } from '@mise/shared/contracts/common';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../core/auth.js';
import { AppError } from '../../core/errors.js';
import { processImage } from '../../core/media.js';
import { authorize } from '../auth/index.js';
import {
  getMenu,
  getProductImage,
  saveCategory,
  saveComboGroups,
  saveModifierGroup,
  saveProduct,
  setProductImage,
  setProductStatus,
  type Actor,
} from './catalog.service.js';

const params = z.object({ id: idSchema });

function actor(req: FastifyRequest): Actor {
  return {
    userId: req.auth!.userId,
    deviceId: req.auth!.deviceId,
    authorizedBy: req.authorizedBy,
    ip: req.ip,
  };
}

export const catalogRoutes: FastifyPluginCallbackZod = (app, _options, done) => {
  const { prisma } = app;
  const menuAdmin = [authenticate, authorize('config.menu')];

  app.get(
    '/api/menu',
    { preHandler: [authenticate], schema: { response: { 200: menuResponseSchema } } },
    () => getMenu(prisma),
  );

  app.post(
    '/api/categories',
    {
      preHandler: menuAdmin,
      schema: { body: createCategorySchema, response: { 201: categorySchema } },
    },
    async (req, reply) =>
      reply.status(201).send(await saveCategory(prisma, null, req.body, actor(req))),
  );
  app.put(
    '/api/categories/:id',
    {
      preHandler: menuAdmin,
      schema: { params, body: updateCategorySchema, response: { 200: categorySchema } },
    },
    (req) => saveCategory(prisma, req.params.id, req.body, actor(req)),
  );

  app.post(
    '/api/products',
    {
      preHandler: menuAdmin,
      schema: { body: saveProductSchema, response: { 201: productSchema } },
    },
    async (req, reply) =>
      reply.status(201).send(await saveProduct(prisma, null, req.body, actor(req))),
  );
  app.put(
    '/api/products/:id',
    {
      preHandler: menuAdmin,
      schema: { params, body: saveProductSchema, response: { 200: productSchema } },
    },
    (req) => saveProduct(prisma, req.params.id, req.body, actor(req)),
  );
  app.patch(
    '/api/products/:id/status',
    {
      preHandler: [authenticate, authorize('menu.toggle_soldout')],
      schema: { params, body: productStatusRequestSchema, response: { 200: productSchema } },
    },
    (req) => setProductStatus(prisma, req.params.id, req.body.status, actor(req)),
  );
  app.put(
    '/api/products/:id/combo-groups',
    {
      preHandler: menuAdmin,
      schema: { params, body: saveComboGroupsSchema, response: { 200: productSchema } },
    },
    (req) => saveComboGroups(prisma, req.params.id, req.body.groups, actor(req)),
  );

  app.post(
    '/api/products/:id/image',
    { preHandler: menuAdmin, schema: { params } },
    async (req) => {
      const file = await req.file();
      if (!file) throw new AppError('VALIDATION_ERROR', 'Falta la imagen');
      const image = await processImage(await file.toBuffer(), file.mimetype);
      const product = await setProductImage(prisma, req.params.id, image, actor(req));
      return { imageUrl: product.imageUrl };
    },
  );

  // Público (S-11): URL versionada con ?v=, caché de un año
  app.get('/api/products/:id/image', { schema: { params } }, async (req, reply) => {
    const media = await getProductImage(prisma, req.params.id);
    return reply
      .header('content-type', media.mime)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('etag', `"${media.sha256}"`)
      .send(Buffer.from(media.bytes));
  });

  app.post(
    '/api/modifier-groups',
    {
      preHandler: menuAdmin,
      schema: { body: saveModifierGroupSchema, response: { 201: modifierGroupSchema } },
    },
    async (req, reply) =>
      reply.status(201).send(await saveModifierGroup(prisma, null, req.body, actor(req))),
  );
  app.put(
    '/api/modifier-groups/:id',
    {
      preHandler: menuAdmin,
      schema: { params, body: saveModifierGroupSchema, response: { 200: modifierGroupSchema } },
    },
    (req) => saveModifierGroup(prisma, req.params.id, req.body, actor(req)),
  );

  done();
};
