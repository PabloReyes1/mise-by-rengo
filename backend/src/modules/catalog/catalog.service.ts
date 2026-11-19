// Menú: categorías, productos, modificadores, combos e imágenes (Docs/07 §4.3, RF-010 a RF-016).
// Nada se borra: se desactiva (los pedidos guardan referencias). Montos como string "64.00".
import type {
  Category,
  ComboGroup,
  MenuResponse,
  ModifierGroup,
  Product,
  ProductStatus,
} from '@mise/shared/contracts/catalog';
import { AppError } from '../../core/errors.js';
import { newDbId, toApiId, toDbId } from '../../core/ids.js';
import type { ProcessedImage } from '../../core/media.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { changedFields, recordAudit } from '../audit/index.js';

export interface Actor {
  userId: string;
  deviceId: string;
  authorizedBy: string | null;
  ip: string;
}

function auditActor(a: Actor) {
  return {
    userId: toDbId(a.userId),
    deviceId: toDbId(a.deviceId),
    authorizedBy: a.authorizedBy ? toDbId(a.authorizedBy) : null,
    ip: a.ip,
  };
}

const money = (d: Prisma.Decimal | { toFixed: (n: number) => string }) => d.toFixed(2);

const productInclude = {
  modifierGroups: { orderBy: { sort: 'asc' } },
  comboGroups: { orderBy: { sort: 'asc' }, include: { options: true } },
  image: { select: { id: true } },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function toCategory(c: { id: string; name: string; sort: number; active: boolean }): Category {
  return { id: toApiId(c.id), name: c.name, sort: c.sort, active: c.active };
}

function toProduct(p: ProductRow): Product {
  return {
    id: toApiId(p.id),
    categoryId: toApiId(p.categoryId),
    name: p.name,
    shortDescription: p.shortDescription,
    sku: p.sku,
    price: money(p.price),
    isCombo: p.isCombo,
    status: p.status as ProductStatus,
    sort: p.sort,
    // URL versionada: cambia cuando cambia el producto (Docs/08 §2.4)
    imageUrl: p.imageMediaId
      ? `/api/products/${toApiId(p.id)}/image?v=${p.updatedAt.getTime()}`
      : null,
    modifierGroupIds: p.modifierGroups.map((g) => toApiId(g.groupId)),
    comboGroups: p.comboGroups.map((g) => ({
      name: g.name,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      options: g.options.map((o) => ({
        productId: toApiId(o.productId),
        priceDelta: money(o.priceDelta),
        isDefault: o.isDefault,
      })),
    })),
  };
}

const groupInclude = {
  modifiers: { orderBy: { sort: 'asc' } },
} satisfies Prisma.ModifierGroupInclude;

function toGroup(
  g: Prisma.ModifierGroupGetPayload<{ include: typeof groupInclude }>,
): ModifierGroup {
  return {
    id: toApiId(g.id),
    name: g.name,
    required: g.required,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    sort: g.sort,
    modifiers: g.modifiers.map((m) => ({
      id: toApiId(m.id),
      name: m.name,
      priceDelta: money(m.priceDelta),
      status: m.status as ProductStatus,
      sort: m.sort,
    })),
  };
}

/** Menú completo (también lo inactivo: cada pantalla filtra lo que muestra, SC-17). */
export async function getMenu(prisma: PrismaClient): Promise<MenuResponse> {
  const [categories, products, groups] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }] }),
    prisma.product.findMany({
      orderBy: [{ sort: 'asc' }, { name: 'asc' }],
      include: productInclude,
    }),
    prisma.modifierGroup.findMany({
      orderBy: [{ sort: 'asc' }, { name: 'asc' }],
      include: groupInclude,
    }),
  ]);
  return {
    categories: categories.map(toCategory),
    products: products.map(toProduct),
    modifierGroups: groups.map(toGroup),
  };
}

// ─── Categorías ──────────────────────────────────────────────────────────────

export async function saveCategory(
  prisma: PrismaClient,
  id: string | null,
  input: { name?: string | undefined; sort?: number | undefined; active?: boolean | undefined },
  actor: Actor,
): Promise<Category> {
  return prisma.$transaction(async (tx) => {
    if (!id) {
      const station = await tx.kitchenStation.findFirst({ where: { isDefault: true } });
      const sort = input.sort ?? (await tx.category.count());
      const created = await tx.category.create({
        data: {
          id: newDbId(),
          name: input.name!,
          sort,
          active: input.active ?? true,
          stationId: station?.id ?? null,
        },
      });
      await recordAudit(tx, {
        action: 'config.menu.update',
        entity: 'category',
        entityId: toApiId(created.id),
        ...auditActor(actor),
        after: toCategory(created),
      });
      return toCategory(created);
    }
    const dbId = toDbId(id);
    const current = await tx.category.findUnique({ where: { id: dbId } });
    if (!current) throw new AppError('NOT_FOUND', 'La categoría no existe');
    const updated = await tx.category.update({ where: { id: dbId }, data: input });
    const diff = changedFields(toCategory(current), toCategory(updated));
    if (diff)
      await recordAudit(tx, {
        action: 'config.menu.update',
        entity: 'category',
        entityId: id,
        ...auditActor(actor),
        ...diff,
      });
    return toCategory(updated);
  });
}

// ─── Productos ───────────────────────────────────────────────────────────────

export interface ProductInput {
  categoryId: string;
  name: string;
  shortDescription?: string | null | undefined;
  sku: string;
  price: string;
  isCombo: boolean;
  status: ProductStatus;
  sort?: number | undefined;
  modifierGroupIds: string[];
}

export async function saveProduct(
  prisma: PrismaClient,
  id: string | null,
  input: ProductInput,
  actor: Actor,
): Promise<Product> {
  return prisma.$transaction(async (tx) => {
    const categoryId = toDbId(input.categoryId);
    if (!(await tx.category.findUnique({ where: { id: categoryId } }))) {
      throw new AppError('VALIDATION_ERROR', 'La categoría no existe');
    }
    const groupIds = input.modifierGroupIds.map(toDbId);
    if ((await tx.modifierGroup.count({ where: { id: { in: groupIds } } })) !== groupIds.length) {
      throw new AppError('VALIDATION_ERROR', 'Algún grupo de modificadores no existe');
    }
    const clash = await tx.product.findUnique({ where: { sku: input.sku } });
    const dbId = id ? toDbId(id) : null;
    if (clash && clash.id !== dbId)
      throw new AppError('VALIDATION_ERROR', `El SKU ${input.sku} ya lo usa ${clash.name}`);

    const data = {
      categoryId,
      name: input.name,
      shortDescription: input.shortDescription ?? null,
      sku: input.sku,
      price: input.price,
      isCombo: input.isCombo,
      status: input.status,
    };

    if (!dbId) {
      const newId = newDbId();
      const created = await tx.product.create({
        data: {
          id: newId,
          ...data,
          sort: input.sort ?? (await tx.product.count({ where: { categoryId } })),
          modifierGroups: { create: groupIds.map((groupId, sort) => ({ groupId, sort })) },
        },
        include: productInclude,
      });
      await recordAudit(tx, {
        action: 'config.menu.update',
        entity: 'product',
        entityId: toApiId(newId),
        ...auditActor(actor),
        after: { ...data, price: input.price },
      });
      return toProduct(created);
    }

    const current = await tx.product.findUnique({ where: { id: dbId }, include: productInclude });
    if (!current) throw new AppError('NOT_FOUND', 'El producto no existe');
    await tx.productModifierGroup.deleteMany({ where: { productId: dbId } });
    const updated = await tx.product.update({
      where: { id: dbId },
      data: {
        ...data,
        ...(input.sort !== undefined ? { sort: input.sort } : {}),
        modifierGroups: { create: groupIds.map((groupId, sort) => ({ groupId, sort })) },
      },
      include: productInclude,
    });
    const { imageUrl: _a, ...before } = toProduct(current);
    const { imageUrl: _b, ...after } = toProduct(updated);
    const diff = changedFields(before, after);
    if (diff)
      await recordAudit(tx, {
        action: 'config.menu.update',
        entity: 'product',
        entityId: id!,
        ...auditActor(actor),
        ...diff,
      });
    return toProduct(updated);
  });
}

/** Agotado / disponible / inactivo (RF-011). Avisar a los dispositivos en ≤ 2 s llega con realtime (H2, SC-18). */
export async function setProductStatus(
  prisma: PrismaClient,
  id: string,
  status: ProductStatus,
  actor: Actor,
): Promise<Product> {
  return prisma.$transaction(async (tx) => {
    const dbId = toDbId(id);
    const current = await tx.product.findUnique({ where: { id: dbId } });
    if (!current) throw new AppError('NOT_FOUND', 'El producto no existe');
    const updated = await tx.product.update({
      where: { id: dbId },
      data: { status },
      include: productInclude,
    });
    if (current.status !== status) {
      await recordAudit(tx, {
        action: 'menu.toggle_soldout',
        entity: 'product',
        entityId: id,
        ...auditActor(actor),
        before: { status: current.status },
        after: { status },
      });
    }
    return toProduct(updated);
  });
}

export async function setProductImage(
  prisma: PrismaClient,
  id: string,
  image: ProcessedImage,
  actor: Actor,
): Promise<Product> {
  return prisma.$transaction(async (tx) => {
    const dbId = toDbId(id);
    if (!(await tx.product.findUnique({ where: { id: dbId } })))
      throw new AppError('NOT_FOUND', 'El producto no existe');
    const mediaId = newDbId();
    await tx.media.create({ data: { id: mediaId, ...image } });
    const updated = await tx.product.update({
      where: { id: dbId },
      data: { imageMediaId: mediaId },
      include: productInclude,
    });
    await recordAudit(tx, {
      action: 'config.menu.update',
      entity: 'product',
      entityId: id,
      ...auditActor(actor),
      after: { image: image.sha256 },
    });
    return toProduct(updated);
  });
}

export async function getProductImage(prisma: PrismaClient, id: string) {
  const product = await prisma.product.findUnique({
    where: { id: toDbId(id) },
    select: { imageMediaId: true },
  });
  if (!product?.imageMediaId) throw new AppError('NOT_FOUND', 'El producto no tiene foto');
  return prisma.media.findUniqueOrThrow({ where: { id: product.imageMediaId } });
}

// ─── Modificadores ───────────────────────────────────────────────────────────

export interface ModifierGroupInput {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sort?: number | undefined;
  modifiers: { id?: string | undefined; name: string; priceDelta: string; status: ProductStatus }[];
}

/** Guarda el grupo y su lista completa: los modificadores que ya no vienen se desactivan. */
export async function saveModifierGroup(
  prisma: PrismaClient,
  id: string | null,
  input: ModifierGroupInput,
  actor: Actor,
): Promise<ModifierGroup> {
  return prisma.$transaction(async (tx) => {
    const groupId = id ? toDbId(id) : newDbId();
    const groupData = {
      name: input.name,
      required: input.required,
      minSelect: input.minSelect,
      maxSelect: input.maxSelect,
    };
    const before = id
      ? await tx.modifierGroup.findUnique({ where: { id: groupId }, include: groupInclude })
      : null;
    if (id && !before) throw new AppError('NOT_FOUND', 'El grupo de modificadores no existe');

    if (before) {
      await tx.modifierGroup.update({
        where: { id: groupId },
        data: { ...groupData, ...(input.sort !== undefined ? { sort: input.sort } : {}) },
      });
    } else {
      await tx.modifierGroup.create({
        data: { id: groupId, ...groupData, sort: input.sort ?? (await tx.modifierGroup.count()) },
      });
    }

    const keep = new Set<string>();
    for (const [sort, m] of input.modifiers.entries()) {
      const data = { name: m.name, priceDelta: m.priceDelta, status: m.status, sort };
      if (m.id) {
        const mId = toDbId(m.id);
        const existing = await tx.modifier.findUnique({ where: { id: mId } });
        if (!existing || existing.groupId !== groupId)
          throw new AppError('VALIDATION_ERROR', `El modificador ${m.name} no es de este grupo`);
        await tx.modifier.update({ where: { id: mId }, data });
        keep.add(mId);
      } else {
        const mId = newDbId();
        await tx.modifier.create({ data: { id: mId, groupId, ...data } });
        keep.add(mId);
      }
    }
    await tx.modifier.updateMany({
      where: { groupId, id: { notIn: [...keep] } },
      data: { status: 'INACTIVE' },
    });

    const saved = await tx.modifierGroup.findUniqueOrThrow({
      where: { id: groupId },
      include: groupInclude,
    });
    const diff = before
      ? changedFields(toGroup(before), toGroup(saved))
      : { before: {}, after: toGroup(saved) };
    if (diff)
      await recordAudit(tx, {
        action: 'config.menu.update',
        entity: 'modifier_group',
        entityId: toApiId(groupId),
        ...auditActor(actor),
        ...diff,
      });
    return toGroup(saved);
  });
}

// ─── Combos ──────────────────────────────────────────────────────────────────

export async function saveComboGroups(
  prisma: PrismaClient,
  id: string,
  groups: ComboGroup[],
  actor: Actor,
): Promise<Product> {
  return prisma.$transaction(async (tx) => {
    const dbId = toDbId(id);
    const product = await tx.product.findUnique({ where: { id: dbId }, include: productInclude });
    if (!product) throw new AppError('NOT_FOUND', 'El producto no existe');
    if (!product.isCombo)
      throw new AppError('VALIDATION_ERROR', 'Este producto no está marcado como combo');

    const optionIds = groups.flatMap((g) => g.options.map((o) => toDbId(o.productId)));
    const found = await tx.product.count({ where: { id: { in: [...new Set(optionIds)] } } });
    if (found !== new Set(optionIds).size)
      throw new AppError('VALIDATION_ERROR', 'Alguna opción del combo no existe');
    if (optionIds.includes(dbId))
      throw new AppError('VALIDATION_ERROR', 'Un combo no puede incluirse a sí mismo');

    await tx.comboGroup.deleteMany({ where: { comboProductId: dbId } });
    for (const [sort, g] of groups.entries()) {
      await tx.comboGroup.create({
        data: {
          id: newDbId(),
          comboProductId: dbId,
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          sort,
          options: {
            create: g.options.map((o) => ({
              id: newDbId(),
              productId: toDbId(o.productId),
              priceDelta: o.priceDelta,
              isDefault: o.isDefault,
            })),
          },
        },
      });
    }
    const updated = await tx.product.update({
      where: { id: dbId },
      data: { updatedAt: new Date() },
      include: productInclude,
    });
    await recordAudit(tx, {
      action: 'config.menu.update',
      entity: 'combo',
      entityId: id,
      ...auditActor(actor),
      before: { comboGroups: toProduct(product).comboGroups },
      after: { comboGroups: toProduct(updated).comboGroups },
    });
    return toProduct(updated);
  });
}
