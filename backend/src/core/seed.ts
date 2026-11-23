// Datos iniciales de un cliente nuevo (Docs/13 §2 pasos 6 y 7, RF-254).
// Carga templates/seed + la plantilla elegida. Las tablas de otros módulos se agregan aquí
// cuando existan, cada una por su dueño. Las zonas y mesas de ejemplo
// (tablas del módulo floor) solo se cargan con withTables (S-45).
import type { PrismaClient } from '../generated/prisma/client.js';
import { newDbId } from './ids.js';
import { hashSecret, temporaryPassword } from './secrets.js';
import { loadDemoUsers, loadDevUser, loadTemplate, type DevUser } from './templates.js';

export interface SeedOptions {
  templatesDir: string;
  template: string;
  /** Nombre comercial del cliente */
  tradeName: string;
  /** Plan de la licencia (PA-014: los planes los define RENGO; SC-04) */
  plan: string;
  /** Usuario del administrador inicial */
  adminUsername: string;
  /** Cargar el menú de ejemplo de la plantilla */
  withMenu?: boolean;
  /** Cargar las zonas y mesas de ejemplo de la plantilla (desarrollo y demos, S-45) */
  withTables?: boolean;
  /** SOLO DESARROLLO: crear el usuario dev */
  devUser?: boolean;
  /** SOLO DESARROLLO Y DEMOS: un usuario por rol con PIN (S-46) */
  demoUsers?: boolean;
}

export interface SeedResult {
  /** Contraseña temporal del administrador: se muestra una sola vez (Docs/13 §2 paso 7) */
  adminPassword: string;
}

/** Valores iniciales de la licencia (SC-04): sin vencimiento hasta que RENGO la configure. */
const INITIAL_LICENSE = {
  modules: { recipes: true, ai: false, multiBranch: false, advancedReports: true },
  limits: { branches: 1, devices: 15, aiQuestionsPerMonth: 100 },
};

export async function seedClient(prisma: PrismaClient, options: SeedOptions): Promise<SeedResult> {
  if ((await prisma.clientSettings.count()) > 0) {
    throw new Error('La base ya tiene datos: el seed solo se usa con un cliente nuevo');
  }

  const t = loadTemplate(options.templatesDir, options.template);
  const adminPassword = temporaryPassword();
  const branchId = newDbId();
  const stationId = newDbId();
  const roleIds = new Map(t.roles.map((r) => [r.name, newDbId()]));

  await prisma.$transaction(async (tx) => {
    await tx.clientSettings.create({
      data: {
        id: newDbId(),
        tradeName: options.tradeName,
        themeId: t.settings.themeId,
        locale: t.settings.locale,
        currencyCode: t.settings.currency,
        timezone: t.settings.timeZone,
        discountsEnabled: t.settings.discountsEnabled,
      },
    });
    await tx.license.create({ data: { id: newDbId(), plan: options.plan, ...INITIAL_LICENSE } });
    await tx.branch.create({ data: { id: branchId, name: t.branch.name } });
    await tx.kitchenStation.create({
      data: {
        id: stationId,
        branchId,
        name: t.kitchenStation.name,
        isDefault: t.kitchenStation.isDefault,
      },
    });

    await tx.paymentMethod.createMany({
      data: t.paymentMethods.map((m, sort) => ({ id: newDbId(), ...m, sort })),
    });
    for (const r of t.cashRegisters) {
      await tx.cashRegister.create({ data: { id: newDbId(), branchId, ...r } });
    }

    // Unidades y conversiones (RF-131). skipDuplicates: la migración h3_recipes ya las pudo cargar
    await tx.unit.createMany({
      data: t.seed.units.map((u) => ({ id: newDbId(), ...u })),
      skipDuplicates: true,
    });
    const units = new Map((await tx.unit.findMany()).map((u) => [u.code, u.id]));
    await tx.unitConversion.createMany({
      data: t.seed.unitConversions.map((c) => ({
        fromUnitId: units.get(c.from)!,
        toUnitId: units.get(c.to)!,
        factor: c.factor,
      })),
      skipDuplicates: true,
    });

    await tx.orderType.createMany({
      data: t.seed.orderTypes.map((o) => ({ id: newDbId(), ...o })),
    });
    await tx.reason.createMany({
      data: t.reasons.map((r, sort) => ({ id: newDbId(), type: r.type, name: r.name, sort })),
    });
    await tx.ticketTemplate.createMany({
      data: t.ticketTemplates.map((tt) => ({ id: newDbId(), branchId, ...tt })),
    });

    for (const role of t.roles) {
      await tx.role.create({
        data: {
          id: roleIds.get(role.name)!,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          permissions: { create: role.permissions.map((permissionCode) => ({ permissionCode })) },
        },
      });
    }

    await tx.user.create({
      data: {
        id: newDbId(),
        fullName: 'Administrador',
        username: options.adminUsername,
        passwordHash: await hashSecret(adminPassword),
        roles: { create: [{ roleId: roleIds.get('Administrador')! }] },
        branches: { create: [{ branchId }] },
      },
    });

    const users: DevUser[] = [
      ...(options.devUser ? [loadDevUser(options.templatesDir, options.template)] : []),
      ...(options.demoUsers ? loadDemoUsers(options.templatesDir, options.template) : []),
    ];
    for (const dev of users) {
      await tx.user.create({
        data: {
          id: newDbId(),
          fullName: dev.fullName,
          username: dev.username,
          passwordHash: await hashSecret(dev.password),
          pinHash: await hashSecret(dev.pin),
          pinSetAt: new Date(),
          roles: { create: dev.roles.map((name) => ({ roleId: roleIds.get(name)! })) },
          branches: { create: [{ branchId }] },
        },
      });
    }

    if (options.withTables) {
      for (const [sort, zone] of t.tables.zones.entries()) {
        await tx.zone.create({
          data: {
            id: newDbId(),
            branchId,
            name: zone.name,
            sort,
            tables: {
              create: zone.tables.map((m) => ({
                id: newDbId(),
                name: m.name,
                capacity: m.capacity,
                shape: m.shape,
              })),
            },
          },
        });
      }
    }

    if (options.withMenu) {
      const categoryIds = new Map(t.menu.categories.map((c) => [c.key, newDbId()]));
      const groupIds = new Map(t.menu.modifierGroups.map((g) => [g.key, newDbId()]));
      const productIds = new Map(t.menu.products.map((p) => [p.key, newDbId()]));

      await tx.category.createMany({
        data: t.menu.categories.map((c, sort) => ({
          id: categoryIds.get(c.key)!,
          name: c.name,
          sort,
          stationId,
        })),
      });
      for (const [sort, g] of t.menu.modifierGroups.entries()) {
        await tx.modifierGroup.create({
          data: {
            id: groupIds.get(g.key)!,
            name: g.name,
            required: g.required,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            sort,
            categories: {
              create: g.categories.map((c) => ({ categoryId: categoryIds.get(c)! })),
            },
            modifiers: {
              create: g.modifiers.map((m, i) => ({
                id: newDbId(),
                name: m.name,
                priceDelta: m.priceDelta,
                sort: i,
              })),
            },
          },
        });
      }
      for (const [sort, p] of t.menu.products.entries()) {
        await tx.product.create({
          data: {
            id: productIds.get(p.key)!,
            categoryId: categoryIds.get(p.category)!,
            name: p.name,
            sku: p.sku,
            price: p.price,
            isCombo: p.isCombo,
            sort,
            modifierGroups: {
              create: p.modifierGroups.map((g, i) => ({ groupId: groupIds.get(g)!, sort: i })),
            },
          },
        });
      }
      for (const combo of t.menu.combos) {
        for (const [sort, g] of combo.groups.entries()) {
          await tx.comboGroup.create({
            data: {
              id: newDbId(),
              comboProductId: productIds.get(combo.product)!,
              name: g.name,
              minSelect: g.minSelect,
              maxSelect: g.maxSelect,
              sort,
              options: {
                create: g.options.map((o) => ({
                  id: newDbId(),
                  productId: productIds.get(o.product)!,
                  priceDelta: o.priceDelta,
                  isDefault: o.default,
                })),
              },
            },
          });
        }
      }
    }
  });

  return { adminPassword };
}
