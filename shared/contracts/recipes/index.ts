// Contrato v1 de recetas y costeo (Docs/08 §2.9, Docs/07 §4.6, RF-130 a RF-139).
// Dueño: Deniscito. Reasignado a Pablito (doc 17 §3.1, H3 #22).
import { z } from 'zod';
import { idSchema, isoDateTimeSchema, moneySchema } from '../common/index.js';

export const UNIT_DIMENSIONS = ['MASS', 'VOLUME', 'COUNT'] as const;
export const ROUNDING_MODES = ['UP', 'NEAREST'] as const;
/** Pasos de redondeo del precio sugerido (PA-045) */
export const ROUNDING_STEPS = ['0.50', '1.00', '5.00'] as const;
/** Sin % de costo objetivo configurado se usa este (SC-67) */
export const DEFAULT_COST_TARGET = {
  targetFoodCostPct: 30,
  roundingStep: '1.00',
  roundingMode: 'UP',
} as const;

/** Costo con hasta 4 decimales ("0.0450"): los insumos se costean por gramo o mililitro. */
export const unitCostSchema = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,4})?$/, 'Costo inválido: usa hasta 4 decimales, ej. "45.50"');

/** Cantidad de una línea de receta: mayor que 0, hasta 4 decimales. */
export const quantitySchema = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,4})?$/, 'Cantidad inválida: usa hasta 4 decimales, ej. "120"')
  .refine((v) => Number(v) > 0, 'La cantidad debe ser mayor que 0');

/** Porcentaje con 2 decimales como número (30 = 30 %). */
const pctSchema = z.number().multipleOf(0.01);

// ---------- Unidades (RF-131) ----------

export const unitSchema = z.object({
  id: idSchema,
  code: z.string(),
  name: z.string(),
  dimension: z.enum(UNIT_DIMENSIONS),
});
export type Unit = z.infer<typeof unitSchema>;

// ---------- Insumos (RF-130) ----------

export const ingredientSchema = z.object({
  id: idSchema,
  name: z.string(),
  category: z.string().nullable(),
  baseUnitId: idSchema,
  /** Costo por unidad base */
  unitCost: unitCostSchema,
  active: z.boolean(),
  /** Recetas que lo usan */
  recipeCount: z.number().int(),
  updatedAt: isoDateTimeSchema,
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export const listIngredientsQuerySchema = z.object({
  /** También los inactivos */
  all: z.enum(['true', 'false']).optional(),
});

const ingredientFields = {
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().max(40).nullable(),
  baseUnitId: idSchema,
};

export const createIngredientRequestSchema = z.object({
  id: idSchema,
  ...ingredientFields,
  unitCost: unitCostSchema,
});
export type CreateIngredientRequest = z.infer<typeof createIngredientRequestSchema>;

/** El costo no se cambia aquí: va por /cost para dejar historial (RF-130). */
export const updateIngredientRequestSchema = z.object({
  ...ingredientFields,
  active: z.boolean(),
});
export type UpdateIngredientRequest = z.infer<typeof updateIngredientRequestSchema>;

export const setIngredientCostRequestSchema = z.object({ unitCost: unitCostSchema });
export type SetIngredientCostRequest = z.infer<typeof setIngredientCostRequestSchema>;

export const ingredientCostSchema = z.object({
  unitCost: unitCostSchema,
  validFrom: isoDateTimeSchema,
  setByName: z.string(),
});
export type IngredientCost = z.infer<typeof ingredientCostSchema>;

// ---------- Costeo (RF-134 a RF-136, RF-138) ----------

export const costTargetValuesSchema = z.object({
  /** % del precio que se va en costo (30 = el costo es el 30 % del precio) */
  targetFoodCostPct: pctSchema.min(1).max(99),
  roundingStep: z.enum(ROUNDING_STEPS),
  roundingMode: z.enum(ROUNDING_MODES),
});
export type CostTargetValues = z.infer<typeof costTargetValuesSchema>;

export const costedProductSchema = z.object({
  productId: idSchema,
  name: z.string(),
  categoryId: idSchema,
  categoryName: z.string(),
  isCombo: z.boolean(),
  /** Precio asignado */
  price: moneySchema,
  /** Tiene receta (o, si es combo, alguno de sus componentes por defecto) */
  hasRecipe: z.boolean(),
  /** Costo teórico; null sin receta */
  cost: unitCostSchema.nullable(),
  target: costTargetValuesSchema,
  /** De dónde sale el objetivo (RF-134: producto > categoría > restaurante) */
  targetScope: z.enum(['CLIENT', 'CATEGORY', 'PRODUCT', 'DEFAULT']),
  suggestedPrice: moneySchema.nullable(),
  /** costo / precio × 100 */
  foodCostPct: pctSchema.nullable(),
  /** (precio − costo) / precio × 100 */
  marginPct: pctSchema.nullable(),
  /** El costo pasa el % objetivo (RF-136) */
  belowTarget: z.boolean(),
});
export type CostedProduct = z.infer<typeof costedProductSchema>;

export const listCostingQuerySchema = z.object({
  belowTarget: z.enum(['true', 'false']).optional(),
});

/** Respuesta de POST /api/ingredients/:id/cost: lo que cambió de costo (RF-138). */
export const setIngredientCostResponseSchema = z.object({
  ingredient: ingredientSchema,
  affected: z.array(costedProductSchema),
});
export type SetIngredientCostResponse = z.infer<typeof setIngredientCostResponseSchema>;

export const costTargetsSchema = z.object({
  /** null: no se ha configurado y se usa DEFAULT_COST_TARGET */
  client: costTargetValuesSchema.nullable(),
  categories: z.array(costTargetValuesSchema.extend({ categoryId: idSchema })),
  products: z.array(costTargetValuesSchema.extend({ productId: idSchema })),
});
export type CostTargets = z.infer<typeof costTargetsSchema>;

/** Pone o quita (target null) un objetivo. El del restaurante no se quita. */
export const putCostTargetRequestSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('CLIENT'), target: costTargetValuesSchema }),
  z.object({
    scope: z.literal('CATEGORY'),
    categoryId: idSchema,
    target: costTargetValuesSchema.nullable(),
  }),
  z.object({
    scope: z.literal('PRODUCT'),
    productId: idSchema,
    target: costTargetValuesSchema.nullable(),
  }),
]);
export type PutCostTargetRequest = z.infer<typeof putCostTargetRequestSchema>;

// ---------- Recetas (RF-132) ----------

export const recipeLineSchema = z.object({
  ingredientId: idSchema,
  quantity: quantitySchema,
  unitId: idSchema,
  /** Merma en % (0 a 99) */
  wastePct: pctSchema.min(0).max(99),
});
export type RecipeLineInput = z.infer<typeof recipeLineSchema>;

export const recipeSchema = z.object({
  id: idSchema,
  productId: idSchema.nullable(),
  modifierId: idSchema.nullable(),
  lines: z.array(
    recipeLineSchema.extend({
      ingredientName: z.string(),
      /** Costo de la línea con merma */
      cost: unitCostSchema,
    }),
  ),
  cost: unitCostSchema,
  computedAt: isoDateTimeSchema.nullable(),
});
export type Recipe = z.infer<typeof recipeSchema>;

/** Sin líneas, la receta se borra. */
export const putRecipeRequestSchema = z.object({
  lines: z.array(recipeLineSchema).max(60),
});
export type PutRecipeRequest = z.infer<typeof putRecipeRequestSchema>;
