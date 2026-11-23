// Rutas de recetas y costeo (Docs/08 §2.9). Todas con config.recipes y el módulo recipes de la
// licencia activo (RF-252). Dueño: Deniscito; reasignado a Pablito (doc 17 §3.1, H3 #22).
import { idSchema } from '@mise/shared/contracts/common';
import {
  costedModifierSchema,
  costedProductSchema,
  costTargetsSchema,
  createIngredientRequestSchema,
  ingredientCostSchema,
  ingredientSchema,
  listCostingQuerySchema,
  listIngredientsQuerySchema,
  putCostTargetRequestSchema,
  putRecipeRequestSchema,
  recipeSchema,
  setIngredientCostRequestSchema,
  setIngredientCostResponseSchema,
  unitSchema,
  updateIngredientRequestSchema,
} from '@mise/shared/contracts/recipes';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../core/auth.js';
import { AppError } from '../../core/errors.js';
import { authorize } from '../auth/index.js';
import type { Actor } from '../floor/index.js';
import {
  createIngredient,
  getCostTargets,
  getRecipe,
  ingredientCostHistory,
  listCostedModifiers,
  listCostedProducts,
  listIngredients,
  listUnits,
  putCostTarget,
  putRecipe,
  setIngredientCost,
  updateIngredient,
} from './recipes.service.js';

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

export const recipesRoutes: FastifyPluginCallbackZod = (app, _options, done) => {
  const { prisma } = app;

  /** El módulo se puede apagar por licencia (modules.recipes = false). Si no dice nada, está activo. */
  async function moduleOn() {
    const license = await prisma.license.findFirst({ select: { modules: true } });
    const modules = (license?.modules ?? {}) as Record<string, unknown>;
    if (modules['recipes'] === false)
      throw new AppError('MODULE_DISABLED', 'Recetas y costeo no está incluido en tu plan');
  }
  const guard = [authenticate, authorize('config.recipes'), moduleOn];

  app.get(
    '/api/units',
    { preHandler: guard, schema: { response: { 200: z.array(unitSchema) } } },
    () => listUnits(prisma),
  );

  app.get(
    '/api/ingredients',
    {
      preHandler: guard,
      schema: {
        querystring: listIngredientsQuerySchema,
        response: { 200: z.array(ingredientSchema) },
      },
    },
    (req) => listIngredients(prisma, req.query.all === 'true'),
  );

  app.post(
    '/api/ingredients',
    {
      preHandler: guard,
      schema: {
        body: createIngredientRequestSchema,
        response: { 200: ingredientSchema, 201: ingredientSchema },
      },
    },
    async (req, reply) => {
      const r = await createIngredient(prisma, req.body, actor(req));
      return reply.status(r.created ? 201 : 200).send(r.ingredient);
    },
  );

  app.put(
    '/api/ingredients/:id',
    {
      preHandler: guard,
      schema: { params, body: updateIngredientRequestSchema, response: { 200: ingredientSchema } },
    },
    (req) => updateIngredient(prisma, req.params.id, req.body, actor(req)),
  );

  app.post(
    '/api/ingredients/:id/cost',
    {
      preHandler: guard,
      schema: {
        params,
        body: setIngredientCostRequestSchema,
        response: { 200: setIngredientCostResponseSchema },
      },
    },
    (req) => setIngredientCost(prisma, req.params.id, req.body.unitCost, actor(req)),
  );

  app.get(
    '/api/ingredients/:id/costs',
    {
      preHandler: guard,
      schema: { params, response: { 200: z.array(ingredientCostSchema) } },
    },
    (req) => ingredientCostHistory(prisma, req.params.id),
  );

  for (const [path, key] of [
    ['/api/products/:id/recipe', 'productId'],
    ['/api/modifiers/:id/recipe', 'modifierId'],
  ] as const) {
    const owner = (id: string) => (key === 'productId' ? { productId: id } : { modifierId: id });
    app.get(
      path,
      { preHandler: guard, schema: { params, response: { 200: recipeSchema.nullable() } } },
      (req) => getRecipe(prisma, owner(req.params.id)),
    );
    app.put(
      path,
      {
        preHandler: guard,
        schema: {
          params,
          body: putRecipeRequestSchema,
          response: { 200: recipeSchema.nullable() },
        },
      },
      (req) => putRecipe(prisma, owner(req.params.id), req.body, actor(req)),
    );
  }

  app.get(
    '/api/cost-targets',
    { preHandler: guard, schema: { response: { 200: costTargetsSchema } } },
    () => getCostTargets(prisma),
  );

  app.put(
    '/api/cost-targets',
    {
      preHandler: guard,
      schema: { body: putCostTargetRequestSchema, response: { 200: costTargetsSchema } },
    },
    (req) => putCostTarget(prisma, req.body, actor(req)),
  );

  app.get(
    '/api/costing/products',
    {
      preHandler: guard,
      schema: {
        querystring: listCostingQuerySchema,
        response: { 200: z.array(costedProductSchema) },
      },
    },
    (req) => listCostedProducts(prisma, { belowTarget: req.query.belowTarget === 'true' }),
  );

  app.get(
    '/api/costing/modifiers',
    { preHandler: guard, schema: { response: { 200: z.array(costedModifierSchema) } } },
    () => listCostedModifiers(prisma),
  );

  done();
};
