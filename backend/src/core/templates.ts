// Carga y valida los datos iniciales de templates/ (Docs/13 §2 paso 6, Docs/19 §6).
// - templates/seed: datos del producto, iguales para todo cliente (permisos, unidades, tipos de orden).
// - templates/<plantilla>: configuración inicial que el cliente después edita.
// El seed de la base usará loadTemplate() cuando existan las tablas (módulos config, auth y catalog, H1).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

/** Monto como string decimal con 2 cifras ("64.00"), igual que en la API (Docs/08 §1). */
const money = z.string().regex(/^\d+\.\d{2}$/, 'debe ser un monto con 2 decimales, ej. "64.00"');
const key = z.string().regex(/^[a-z0-9-]+$/, 'solo minúsculas, números y guiones');

const seedSchema = z.object({
  permissions: z.array(z.object({ code: z.string().min(1), description: z.string().min(1) })),
  units: z.array(
    z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      dimension: z.enum(['MASS', 'VOLUME', 'COUNT']),
    }),
  ),
  orderTypes: z.array(
    z.object({ code: z.string().min(1), name: z.string().min(1), requiresTable: z.boolean() }),
  ),
});

const menuSchema = z.object({
  categories: z.array(z.object({ key, name: z.string().min(1) })),
  modifierGroups: z.array(
    z.object({
      key,
      name: z.string().min(1),
      required: z.boolean().default(false),
      minSelect: z.number().int().min(0),
      maxSelect: z.number().int().min(1),
      modifiers: z.array(z.object({ name: z.string().min(1), priceDelta: money })).default([]),
    }),
  ),
  products: z.array(
    z.object({
      key,
      sku: z.string().min(1),
      name: z.string().min(1),
      category: z.string(),
      price: money,
      isCombo: z.boolean().default(false),
      modifierGroups: z.array(z.string()).default([]),
    }),
  ),
  combos: z.array(
    z.object({
      product: z.string(),
      groups: z.array(
        z.object({
          name: z.string().min(1),
          minSelect: z.number().int().min(0),
          maxSelect: z.number().int().min(1),
          options: z.array(
            z.object({
              product: z.string(),
              priceDelta: money,
              default: z.boolean().default(false),
            }),
          ),
        }),
      ),
    }),
  ),
});

const templateSchema = z.object({
  roles: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string(),
      isSystem: z.boolean(),
      permissions: z.array(z.string()),
    }),
  ),
  settings: z.object({
    themeId: z.string().min(1),
    locale: z.string().min(1),
    currency: z.string().length(3),
    timeZone: z.string().min(1),
    discountsEnabled: z.boolean(),
  }),
  branch: z.object({ name: z.string().min(1) }),
  kitchenStation: z.object({ name: z.string().min(1), isDefault: z.boolean() }),
  paymentMethods: z.array(
    z.object({
      name: z.string().min(1),
      kind: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']),
      givesChange: z.boolean(),
      requiresReference: z.boolean(),
    }),
  ),
  reasons: z.array(
    z.object({
      type: z.enum([
        'CANCEL_ITEM',
        'REOPEN_BILL',
        'DISCOUNT',
        'CASH_WITHDRAWAL',
        'CASH_DEPOSIT',
        'CONFLICT',
      ]),
      name: z.string().min(1),
    }),
  ),
  ticketTemplates: z.array(
    z.object({
      docType: z.enum(['COMANDA', 'PRECUENTA', 'RECIBO', 'CORTE', 'MOVIMIENTO']),
      header: z.string(),
      footer: z.string(),
      showLogo: z.boolean(),
      paperWidth: z.union([z.literal(58), z.literal(80)]),
    }),
  ),
});

const devUserSchema = z.object({
  username: z.string().min(1),
  fullName: z.string().min(1),
  password: z.string().min(8),
  pin: z.string().regex(/^\d{4,6}$/),
  roles: z.array(z.string()).min(1),
});

export type Seed = z.infer<typeof seedSchema>;
export type Menu = z.infer<typeof menuSchema>;
export type Template = z.infer<typeof templateSchema> & { seed: Seed; menu: Menu };
export type DevUser = z.infer<typeof devUserSchema>;

function readJson(dir: string, file: string): Record<string, unknown> {
  const { $comment: _comment, ...data } = JSON.parse(
    readFileSync(join(dir, file), 'utf8'),
  ) as Record<string, unknown>;
  return data;
}

export function parseMenu(data: unknown): Menu {
  return menuSchema.parse(data);
}

/** Lee templates/seed y templates/<plantilla>. Lanza error si algún archivo no tiene el formato. */
export function loadTemplate(templatesDir: string, name: string): Template {
  const seedDir = join(templatesDir, 'seed');
  const dir = join(templatesDir, name);
  const seed = seedSchema.parse({
    ...readJson(seedDir, 'permissions.json'),
    ...readJson(seedDir, 'units.json'),
    ...readJson(seedDir, 'order-types.json'),
  });
  const template = templateSchema.parse({
    ...readJson(dir, 'roles.json'),
    ...readJson(dir, 'settings.json'),
    ...readJson(dir, 'payment-methods.json'),
    ...readJson(dir, 'reasons.json'),
    ...readJson(dir, 'ticket-templates.json'),
  });
  return { ...template, seed, menu: parseMenu(readJson(dir, 'menu.json')) };
}

/** SOLO DESARROLLO: el usuario local. Nunca se carga al dar de alta un cliente. */
export function loadDevUser(templatesDir: string, name: string): DevUser {
  return devUserSchema.parse(readJson(join(templatesDir, name), 'dev-user.json')['devUser']);
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];
}

/** Revisa las referencias entre archivos. Lista vacía = la plantilla se puede cargar. */
export function validateTemplate(t: Template): string[] {
  const problems: string[] = [];
  const permissionCodes = new Set(t.seed.permissions.map((p) => p.code));

  for (const role of t.roles) {
    for (const p of role.permissions) {
      if (!permissionCodes.has(p)) problems.push(`Rol ${role.name}: el permiso ${p} no existe`);
    }
    for (const p of duplicates(role.permissions)) {
      problems.push(`Rol ${role.name}: el permiso ${p} está repetido`);
    }
  }
  if (!t.roles.some((r) => r.permissions.includes('config.roles'))) {
    problems.push('Ningún rol tiene config.roles: siempre debe quedar uno (Docs/03 §2)');
  }

  const categories = new Set(t.menu.categories.map((c) => c.key));
  const groups = new Set(t.menu.modifierGroups.map((g) => g.key));
  const products = new Map(t.menu.products.map((p) => [p.key, p]));

  for (const g of t.menu.modifierGroups) {
    if (g.minSelect > g.maxSelect) {
      problems.push(
        `Modificadores ${g.name}: el mínimo (${g.minSelect}) es mayor que el máximo (${g.maxSelect})`,
      );
    }
  }
  for (const p of t.menu.products) {
    if (!categories.has(p.category))
      problems.push(`Producto ${p.name}: la categoría ${p.category} no existe`);
    for (const g of p.modifierGroups) {
      if (!groups.has(g))
        problems.push(`Producto ${p.name}: el grupo de modificadores ${g} no existe`);
    }
  }
  for (const sku of duplicates(t.menu.products.map((p) => p.sku))) {
    problems.push(`SKU repetido: ${sku}`);
  }
  for (const combo of t.menu.combos) {
    if (products.get(combo.product)?.isCombo !== true) {
      problems.push(`Combo ${combo.product}: no es un producto marcado como combo`);
    }
    for (const group of combo.groups) {
      for (const option of group.options) {
        if (!products.has(option.product)) {
          problems.push(`Combo ${combo.product}: el producto ${option.product} no existe`);
        }
      }
    }
  }
  return problems;
}
