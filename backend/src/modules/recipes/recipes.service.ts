// Insumos, recetas y costeo (Docs/07 §4.6, Docs/08 §2.9, RF-130 a RF-139). Dueño: Deniscito;
// reasignado a Pablito (doc 17 §3.1, H3 #22).
// El costo de cada receta se guarda en recipes.computed_cost: se recalcula al guardar la receta y
// al cambiar el costo de un insumo (RF-138). Las líneas usan una unidad de la misma dimensión que la
// unidad base del insumo (SC-67).
import {
  DEFAULT_COST_TARGET,
  type CostedModifier,
  type CostedProduct,
  type CostTargets,
  type CostTargetValues,
  type CreateIngredientRequest,
  type Ingredient,
  type IngredientCost,
  type PutCostTargetRequest,
  type PutRecipeRequest,
  type Recipe,
  type SetIngredientCostResponse,
  type Unit,
  type UpdateIngredientRequest,
} from '@mise/shared/contracts/recipes';
import { AppError } from '../../core/errors.js';
import { newDbId, toApiId, toDbId } from '../../core/ids.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { changedFields, recordAudit } from '../audit/index.js';
import type { Actor } from '../floor/index.js';
import { costing, lineCost, unitFactor, type Conversion } from './costing.js';

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;
type IngredientRow = Prisma.IngredientGetPayload<{
  include: { _count: { select: { lines: true } } };
}>;

const auditActor = (a: Actor) => ({
  userId: toDbId(a.userId),
  deviceId: toDbId(a.deviceId),
  authorizedBy: a.authorizedBy ? toDbId(a.authorizedBy) : null,
  ip: a.ip,
});

// ---------- Unidades ----------

export async function listUnits(db: Db): Promise<Unit[]> {
  const rows = await db.unit.findMany({ orderBy: [{ dimension: 'asc' }, { code: 'asc' }] });
  return rows.map((u) => ({
    id: toApiId(u.id),
    code: u.code,
    name: u.name,
    dimension: u.dimension as Unit['dimension'],
  }));
}

const loadConversions = (db: Db): Promise<Conversion[]> => db.unitConversion.findMany();

// ---------- Insumos ----------

const toIngredient = (r: IngredientRow): Ingredient => ({
  id: toApiId(r.id),
  name: r.name,
  category: r.category,
  baseUnitId: toApiId(r.baseUnitId),
  unitCost: r.currentUnitCost.toFixed(4),
  active: r.active,
  recipeCount: r._count.lines,
  updatedAt: r.updatedAt.toISOString(),
});

const withCount = { _count: { select: { lines: true } } } as const;

export async function listIngredients(db: Db, includeInactive: boolean): Promise<Ingredient[]> {
  const rows = await db.ingredient.findMany({
    where: includeInactive ? {} : { active: true },
    include: withCount,
    orderBy: { name: 'asc' },
  });
  return rows.map(toIngredient);
}

async function oneIngredient(db: Db, id: string): Promise<Ingredient> {
  return toIngredient(await db.ingredient.findUniqueOrThrow({ where: { id }, include: withCount }));
}

async function assertIngredientNameFree(tx: Tx, name: string, exceptId?: string) {
  const taken = await tx.ingredient.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (taken && taken.id !== exceptId)
    throw new AppError('INGREDIENT_NAME_TAKEN', `Ya existe un insumo llamado "${name}"`);
}

async function assertUnit(tx: Tx, unitId: string) {
  const unit = await tx.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw new AppError('VALIDATION_ERROR', 'La unidad no existe');
  return unit;
}

export async function createIngredient(
  prisma: PrismaClient,
  input: CreateIngredientRequest,
  actor: Actor,
): Promise<{ ingredient: Ingredient; created: boolean }> {
  const id = toDbId(input.id);
  if (await prisma.ingredient.findUnique({ where: { id } }))
    return { ingredient: await oneIngredient(prisma, id), created: false };
  await prisma.$transaction(async (tx) => {
    await assertIngredientNameFree(tx, input.name);
    const baseUnitId = toDbId(input.baseUnitId);
    await assertUnit(tx, baseUnitId);
    await tx.ingredient.create({
      data: {
        id,
        name: input.name,
        category: input.category || null,
        baseUnitId,
        currentUnitCost: input.unitCost,
      },
    });
    await tx.ingredientCost.create({
      data: {
        id: newDbId(),
        ingredientId: id,
        unitCost: input.unitCost,
        setBy: toDbId(actor.userId),
      },
    });
    await recordAudit(tx, {
      action: 'config.ingredient.create',
      entity: 'ingredient',
      entityId: input.id,
      ...auditActor(actor),
      after: { ...input, id: undefined },
    });
  });
  return { ingredient: await oneIngredient(prisma, id), created: true };
}

export async function updateIngredient(
  prisma: PrismaClient,
  ingredientId: string,
  input: UpdateIngredientRequest,
  actor: Actor,
): Promise<Ingredient> {
  const id = toDbId(ingredientId);
  await prisma.$transaction(async (tx) => {
    const before = await tx.ingredient.findUnique({ where: { id }, include: withCount });
    if (!before) throw new AppError('NOT_FOUND', 'Insumo no encontrado');
    await assertIngredientNameFree(tx, input.name, id);
    const baseUnitId = toDbId(input.baseUnitId);
    // El costo es por unidad base: cambiarla con recetas que lo usan cambiaría su costo sin aviso
    if (baseUnitId !== before.baseUnitId && before._count.lines > 0)
      throw new AppError(
        'VALIDATION_ERROR',
        'El insumo ya está en recetas: su unidad base no se cambia. Crea otro insumo',
      );
    await assertUnit(tx, baseUnitId);
    const after = await tx.ingredient.update({
      where: { id },
      data: {
        name: input.name,
        category: input.category || null,
        baseUnitId,
        active: input.active,
      },
    });
    const pick = (r: typeof after) => ({
      name: r.name,
      category: r.category,
      baseUnitId: toApiId(r.baseUnitId),
      active: r.active,
    });
    const diff = changedFields(pick(before), pick(after));
    if (diff)
      await recordAudit(tx, {
        action: 'config.ingredient.update',
        entity: 'ingredient',
        entityId: ingredientId,
        ...auditActor(actor),
        ...diff,
      });
  });
  return oneIngredient(prisma, id);
}

export async function ingredientCostHistory(
  prisma: PrismaClient,
  ingredientId: string,
): Promise<IngredientCost[]> {
  const id = toDbId(ingredientId);
  if (!(await prisma.ingredient.findUnique({ where: { id } })))
    throw new AppError('NOT_FOUND', 'Insumo no encontrado');
  const rows = await prisma.ingredientCost.findMany({
    where: { ingredientId: id },
    orderBy: { validFrom: 'desc' },
    take: 50,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.setBy))] } },
    select: { id: true, fullName: true },
  });
  const names = new Map(users.map((u) => [u.id, u.fullName]));
  return rows.map((r) => ({
    unitCost: r.unitCost.toFixed(4),
    validFrom: r.validFrom.toISOString(),
    setByName: names.get(r.setBy) ?? '—',
  }));
}

/**
 * Nuevo costo del insumo (RF-130): queda en el historial, se recalculan las recetas que lo usan y
 * se devuelven los productos cuyo costo cambió (RF-138).
 */
export async function setIngredientCost(
  prisma: PrismaClient,
  ingredientId: string,
  unitCost: string,
  actor: Actor,
): Promise<SetIngredientCostResponse> {
  const id = toDbId(ingredientId);
  const before = await listCostedProducts(prisma);
  await prisma.$transaction(async (tx) => {
    const ing = await tx.ingredient.findUnique({ where: { id } });
    if (!ing) throw new AppError('NOT_FOUND', 'Insumo no encontrado');
    if (ing.currentUnitCost.eq(unitCost)) return;
    await tx.ingredient.update({ where: { id }, data: { currentUnitCost: unitCost } });
    await tx.ingredientCost.create({
      data: { id: newDbId(), ingredientId: id, unitCost, setBy: toDbId(actor.userId) },
    });
    const recipes = await tx.recipeLine.findMany({
      where: { ingredientId: id },
      select: { recipeId: true },
      distinct: ['recipeId'],
    });
    await recompute(
      tx,
      recipes.map((r) => r.recipeId),
    );
    await recordAudit(tx, {
      action: 'config.ingredient.cost',
      entity: 'ingredient',
      entityId: ingredientId,
      ...auditActor(actor),
      before: { unitCost: ing.currentUnitCost.toFixed(4) },
      after: { unitCost: Number(unitCost).toFixed(4) },
    });
  });
  const old = new Map(before.map((p) => [p.productId, p.cost]));
  const affected = (await listCostedProducts(prisma)).filter(
    (p) => old.get(p.productId) !== p.cost,
  );
  return { ingredient: await oneIngredient(prisma, id), affected };
}

// ---------- Recetas ----------

type RecipeOwner = { productId: string } | { modifierId: string };

/** Recalcula y guarda computed_cost de las recetas. */
async function recompute(tx: Tx, recipeIds: string[]) {
  if (recipeIds.length === 0) return;
  const conversions = await loadConversions(tx);
  const recipes = await tx.recipe.findMany({
    where: { id: { in: recipeIds } },
    include: { lines: { include: { ingredient: true } } },
  });
  const now = new Date();
  for (const r of recipes) {
    let total = new Prisma.Decimal(0);
    for (const l of r.lines) {
      if (!l.ingredient) continue; // sub-recetas: F2
      const f = unitFactor(conversions, l.unitId, l.ingredient.baseUnitId);
      if (f) total = total.plus(lineCost(l.quantity, f, l.wastePct, l.ingredient.currentUnitCost));
    }
    await tx.recipe.update({ where: { id: r.id }, data: { computedCost: total, computedAt: now } });
  }
}

async function toRecipe(db: Db, where: Prisma.RecipeWhereUniqueInput): Promise<Recipe | null> {
  const r = await db.recipe.findUnique({
    where,
    include: { lines: { include: { ingredient: true }, orderBy: { sort: 'asc' } } },
  });
  if (!r) return null;
  const conversions = await loadConversions(db);
  return {
    id: toApiId(r.id),
    productId: r.productId ? toApiId(r.productId) : null,
    modifierId: r.modifierId ? toApiId(r.modifierId) : null,
    lines: r.lines
      .filter((l) => l.ingredient)
      .map((l) => {
        const f = unitFactor(conversions, l.unitId, l.ingredient!.baseUnitId);
        return {
          ingredientId: toApiId(l.ingredient!.id),
          ingredientName: l.ingredient!.name,
          quantity: l.quantity.toString(),
          unitId: toApiId(l.unitId),
          wastePct: Number(l.wastePct),
          cost: (f
            ? lineCost(l.quantity, f, l.wastePct, l.ingredient!.currentUnitCost)
            : new Prisma.Decimal(0)
          ).toFixed(4),
        };
      }),
    cost: r.computedCost.toFixed(4),
    computedAt: r.computedAt?.toISOString() ?? null,
  };
}

const ownerWhere = (o: RecipeOwner): Prisma.RecipeWhereUniqueInput =>
  'productId' in o ? { productId: toDbId(o.productId) } : { modifierId: toDbId(o.modifierId) };

async function ownerName(db: Db, o: RecipeOwner): Promise<string> {
  if ('productId' in o) {
    const p = await db.product.findUnique({ where: { id: toDbId(o.productId) } });
    if (!p) throw new AppError('NOT_FOUND', 'Producto no encontrado');
    return p.name;
  }
  const m = await db.modifier.findUnique({ where: { id: toDbId(o.modifierId) } });
  if (!m) throw new AppError('NOT_FOUND', 'Modificador no encontrado');
  return m.name;
}

export async function getRecipe(prisma: PrismaClient, owner: RecipeOwner): Promise<Recipe | null> {
  await ownerName(prisma, owner);
  return toRecipe(prisma, ownerWhere(owner));
}

/** Reemplaza las líneas de la receta; sin líneas, la borra (RF-132). */
export async function putRecipe(
  prisma: PrismaClient,
  owner: RecipeOwner,
  input: PutRecipeRequest,
  actor: Actor,
): Promise<Recipe | null> {
  const where = ownerWhere(owner);
  await prisma.$transaction(async (tx) => {
    const name = await ownerName(tx, owner);
    const before = await toRecipe(tx, where);
    const conversions = await loadConversions(tx);
    const ingredientIds = [...new Set(input.lines.map((l) => toDbId(l.ingredientId)))];
    if (ingredientIds.length !== input.lines.length)
      throw new AppError('VALIDATION_ERROR', 'Un insumo está repetido en la receta');
    const ingredients = new Map(
      (await tx.ingredient.findMany({ where: { id: { in: ingredientIds } } })).map((i) => [
        i.id,
        i,
      ]),
    );
    const units = new Map((await tx.unit.findMany()).map((u) => [u.id, u]));
    for (const l of input.lines) {
      const ing = ingredients.get(toDbId(l.ingredientId));
      if (!ing) throw new AppError('VALIDATION_ERROR', 'Un insumo de la receta no existe');
      const unit = units.get(toDbId(l.unitId));
      if (!unit) throw new AppError('VALIDATION_ERROR', 'Una unidad de la receta no existe');
      if (!unitFactor(conversions, unit.id, ing.baseUnitId)) {
        const base = units.get(ing.baseUnitId)!;
        throw new AppError(
          'VALIDATION_ERROR',
          `${ing.name} se costea en ${base.name.toLowerCase()}: no se puede usar en ${unit.name.toLowerCase()}`,
          { ingredientId: l.ingredientId },
        );
      }
    }

    const existing = await tx.recipe.findUnique({ where });
    if (input.lines.length === 0) {
      if (existing) await tx.recipe.delete({ where: { id: existing.id } });
    } else {
      const id = existing?.id ?? newDbId();
      if (existing) {
        await tx.recipeLine.deleteMany({ where: { recipeId: id } });
        await tx.recipe.update({ where: { id }, data: { name } });
      } else {
        await tx.recipe.create({
          data: {
            id,
            name,
            ...('productId' in owner
              ? { productId: toDbId(owner.productId) }
              : { modifierId: toDbId(owner.modifierId) }),
          },
        });
      }
      await tx.recipeLine.createMany({
        data: input.lines.map((l, sort) => ({
          id: newDbId(),
          recipeId: id,
          ingredientId: toDbId(l.ingredientId),
          quantity: l.quantity,
          unitId: toDbId(l.unitId),
          wastePct: l.wastePct,
          sort,
        })),
      });
      await recompute(tx, [id]);
    }
    const lines = (r: Recipe | null) => ({
      lines: (r?.lines ?? []).map((l) => `${l.ingredientName} ${l.quantity} (${l.wastePct}%)`),
    });
    const diff = changedFields(lines(before), lines(await toRecipe(tx, where)));
    if (diff)
      await recordAudit(tx, {
        action: 'config.recipe.update',
        entity: 'productId' in owner ? 'product' : 'modifier',
        entityId: 'productId' in owner ? owner.productId : owner.modifierId,
        ...auditActor(actor),
        ...diff,
      });
  });
  return toRecipe(prisma, where);
}

// ---------- Objetivos (RF-134) ----------

const toValues = (t: {
  targetFoodCostPct: Prisma.Decimal;
  roundingStep: Prisma.Decimal;
  roundingMode: string;
}): CostTargetValues => ({
  targetFoodCostPct: Number(t.targetFoodCostPct),
  roundingStep: t.roundingStep.toFixed(2) as CostTargetValues['roundingStep'],
  roundingMode: t.roundingMode as CostTargetValues['roundingMode'],
});

export async function getCostTargets(db: Db): Promise<CostTargets> {
  const rows = await db.costTarget.findMany();
  const client = rows.find((r) => r.scope === 'CLIENT');
  return {
    client: client ? toValues(client) : null,
    categories: rows
      .filter((r) => r.scope === 'CATEGORY' && r.categoryId)
      .map((r) => ({ categoryId: toApiId(r.categoryId!), ...toValues(r) })),
    products: rows
      .filter((r) => r.scope === 'PRODUCT' && r.productId)
      .map((r) => ({ productId: toApiId(r.productId!), ...toValues(r) })),
  };
}

export async function putCostTarget(
  prisma: PrismaClient,
  input: PutCostTargetRequest,
  actor: Actor,
): Promise<CostTargets> {
  await prisma.$transaction(async (tx) => {
    const key = {
      scope: input.scope,
      categoryId: input.scope === 'CATEGORY' ? toDbId(input.categoryId) : null,
      productId: input.scope === 'PRODUCT' ? toDbId(input.productId) : null,
    };
    if (key.categoryId && !(await tx.category.findUnique({ where: { id: key.categoryId } })))
      throw new AppError('NOT_FOUND', 'Categoría no encontrada');
    if (key.productId && !(await tx.product.findUnique({ where: { id: key.productId } })))
      throw new AppError('NOT_FOUND', 'Producto no encontrado');
    // findFirst y no la llave única: en PostgreSQL dos NULL no chocan en un índice único
    const before = await tx.costTarget.findFirst({ where: key });
    if (input.target === null) {
      if (before) await tx.costTarget.delete({ where: { id: before.id } });
    } else if (before) {
      await tx.costTarget.update({ where: { id: before.id }, data: input.target });
    } else {
      await tx.costTarget.create({ data: { id: newDbId(), ...key, ...input.target } });
    }
    const diff = changedFields(before ? toValues(before) : {}, input.target ?? {});
    if (diff)
      await recordAudit(tx, {
        action: 'config.cost_target.update',
        entity: 'cost_target',
        ...auditActor(actor),
        ...diff,
        note: [input.scope, key.categoryId ?? key.productId].filter(Boolean).join(' '),
      });
  });
  return getCostTargets(prisma);
}

// ---------- Costeo de productos (RF-135, RF-136) ----------

export async function listCostedProducts(
  db: Db,
  { belowTarget = false }: { belowTarget?: boolean } = {},
): Promise<CostedProduct[]> {
  const [products, recipes, targets] = await Promise.all([
    db.product.findMany({
      where: { status: { not: 'INACTIVE' } },
      include: {
        category: true,
        comboGroups: { include: { options: { where: { isDefault: true } } } },
      },
      orderBy: [{ category: { sort: 'asc' } }, { sort: 'asc' }, { name: 'asc' }],
    }),
    db.recipe.findMany({ where: { productId: { not: null } } }),
    db.costTarget.findMany(),
  ]);
  const costs = new Map(recipes.map((r) => [r.productId!, r.computedCost]));
  const byProduct = new Map(targets.filter((t) => t.productId).map((t) => [t.productId!, t]));
  const byCategory = new Map(targets.filter((t) => t.categoryId).map((t) => [t.categoryId!, t]));
  const client = targets.find((t) => t.scope === 'CLIENT');

  const rows = products.map((p): CostedProduct => {
    // Combo: su propia receta (ej. empaque) + la de sus componentes por defecto
    const parts = [p.id, ...p.comboGroups.flatMap((g) => g.options.map((o) => o.productId))];
    const known = parts.map((id) => costs.get(id)).filter((c) => c !== undefined);
    const cost = known.length ? known.reduce((a, b) => a.plus(b)) : null;
    const t = byProduct.get(p.id) ?? byCategory.get(p.categoryId) ?? client;
    const target = t ? toValues(t) : { ...DEFAULT_COST_TARGET };
    const scope = byProduct.has(p.id)
      ? 'PRODUCT'
      : byCategory.has(p.categoryId)
        ? 'CATEGORY'
        : client
          ? 'CLIENT'
          : 'DEFAULT';
    const c = costing(cost, p.price, target);
    return {
      productId: toApiId(p.id),
      name: p.name,
      categoryId: toApiId(p.categoryId),
      categoryName: p.category.name,
      isCombo: p.isCombo,
      price: p.price.toFixed(2),
      hasRecipe: cost !== null,
      cost: cost?.toFixed(4) ?? null,
      target,
      targetScope: scope,
      suggestedPrice: c.suggestedPrice?.toFixed(2) ?? null,
      foodCostPct: c.foodCostPct,
      marginPct: c.marginPct,
      belowTarget: c.belowTarget,
    };
  });
  return belowTarget ? rows.filter((r) => r.belowTarget) : rows;
}

export async function listCostedModifiers(db: Db): Promise<CostedModifier[]> {
  const rows = await db.recipe.findMany({
    where: { modifierId: { not: null } },
    select: { modifierId: true, computedCost: true },
  });
  return rows.map((r) => ({ modifierId: toApiId(r.modifierId!), cost: r.computedCost.toFixed(4) }));
}

// ---------- Costo congelado en la venta (RF-139) ----------

/**
 * Costo teórico de un ítem al venderlo: receta del producto + la de sus modificadores + la de los
 * componentes del combo (y sus modificadores). null si nada de eso tiene receta.
 */
export async function itemUnitCost(
  db: Db,
  item: { productId: string; modifierIds: string[]; componentProductIds: string[] },
): Promise<Prisma.Decimal | null> {
  const productIds = [item.productId, ...item.componentProductIds];
  const recipes = await db.recipe.findMany({
    where: {
      OR: [{ productId: { in: productIds } }, { modifierId: { in: item.modifierIds } }],
    },
    select: { productId: true, modifierId: true, computedCost: true },
  });
  if (recipes.length === 0) return null;
  const byOwner = new Map(recipes.map((r) => [r.productId ?? r.modifierId!, r.computedCost]));
  // Se cuenta cada aparición: dos veces el mismo componente o modificador suma dos veces
  return [...productIds, ...item.modifierIds]
    .map((id) => byOwner.get(id))
    .filter((c) => c !== undefined)
    .reduce((a, b) => a.plus(b), new Prisma.Decimal(0))
    .toDecimalPlaces(4);
}
