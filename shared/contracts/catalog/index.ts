// Contrato v1 del módulo catalog (Docs/08 §2.4, Docs/07 §4.3). Dueño: Deniscito. Revisa: Pablito.
import { z } from 'zod';
import { idSchema, moneySchema } from '../common/index.js';

export const PRODUCT_STATUSES = ['ACTIVE', 'SOLD_OUT', 'INACTIVE'] as const;
export const productStatusSchema = z.enum(PRODUCT_STATUSES);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const categorySchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(60),
  sort: z.number().int(),
  active: z.boolean(),
});
export type Category = z.infer<typeof categorySchema>;
export const createCategorySchema = categorySchema
  .omit({ id: true })
  .partial({ sort: true, active: true });
export const updateCategorySchema = createCategorySchema.partial();

export const modifierSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(60),
  priceDelta: moneySchema,
  status: productStatusSchema,
  sort: z.number().int(),
});
export type Modifier = z.infer<typeof modifierSchema>;

export const modifierGroupSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(60),
    required: z.boolean(),
    minSelect: z.number().int().min(0),
    maxSelect: z.number().int().min(1),
    sort: z.number().int(),
    modifiers: z.array(modifierSchema),
  })
  .refine((g) => g.minSelect <= g.maxSelect, {
    message: 'El mínimo no puede ser mayor que el máximo',
    path: ['minSelect'],
  });
export type ModifierGroup = z.infer<typeof modifierGroupSchema>;

const modifierInputSchema = z.object({
  /** Sin id = modificador nuevo */
  id: idSchema.optional(),
  name: z.string().trim().min(1).max(60),
  priceDelta: moneySchema,
  status: productStatusSchema.default('ACTIVE'),
});
export const saveModifierGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    required: z.boolean(),
    minSelect: z.number().int().min(0),
    maxSelect: z.number().int().min(1),
    sort: z.number().int().optional(),
    /** Lista completa: los que no vengan se desactivan (no se borran, por el historial) */
    modifiers: z.array(modifierInputSchema),
  })
  .refine((g) => g.minSelect <= g.maxSelect, {
    message: 'El mínimo no puede ser mayor que el máximo',
    path: ['minSelect'],
  });

export const comboOptionSchema = z.object({
  productId: idSchema,
  priceDelta: moneySchema,
  isDefault: z.boolean(),
});
export const comboGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    minSelect: z.number().int().min(0),
    maxSelect: z.number().int().min(1),
    options: z.array(comboOptionSchema).min(1),
  })
  .refine((g) => g.minSelect <= g.maxSelect, {
    message: 'El mínimo no puede ser mayor que el máximo',
    path: ['minSelect'],
  });
export type ComboGroup = z.infer<typeof comboGroupSchema>;
// PUT /api/products/:id/combo-groups
export const saveComboGroupsSchema = z.object({ groups: z.array(comboGroupSchema) });

export const productSchema = z.object({
  id: idSchema,
  categoryId: idSchema,
  name: z.string().trim().min(1).max(80),
  shortDescription: z.string().max(200).nullable(),
  sku: z.string().trim().min(1).max(30),
  price: moneySchema,
  isCombo: z.boolean(),
  status: productStatusSchema,
  sort: z.number().int(),
  /** URL versionada de la imagen (Docs/08 §2.4), o null si no tiene */
  imageUrl: z.string().nullable(),
  modifierGroupIds: z.array(idSchema),
  comboGroups: z.array(comboGroupSchema),
});
export type Product = z.infer<typeof productSchema>;

export const saveProductSchema = z.object({
  categoryId: idSchema,
  name: z.string().trim().min(1).max(80),
  shortDescription: z.string().max(200).nullable().optional(),
  sku: z.string().trim().min(1).max(30),
  price: moneySchema,
  isCombo: z.boolean().default(false),
  status: productStatusSchema.default('ACTIVE'),
  sort: z.number().int().optional(),
  modifierGroupIds: z.array(idSchema).default([]),
});

// PATCH /api/products/:id/status (menu.toggle_soldout)
export const productStatusRequestSchema = z.object({ status: productStatusSchema });

// GET /api/menu (autenticado): sin imágenes; solo su URL
export const menuResponseSchema = z.object({
  categories: z.array(categorySchema),
  products: z.array(productSchema),
  modifierGroups: z.array(modifierGroupSchema),
});
export type MenuResponse = z.infer<typeof menuResponseSchema>;
