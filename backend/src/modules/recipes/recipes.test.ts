import type { MenuResponse } from '@mise/shared/contracts/catalog';
import type { CostedProduct, Ingredient, Unit } from '@mise/shared/contracts/recipes';
import { newId } from '@mise/shared/domain/ids';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../core/app.js';
import { toDbId } from '../../core/ids.js';
import { resetDb } from '../../core/test-db.js';
import { createUser, prisma, setupFixture } from '../../core/test-app.js';
import { Prisma } from '../../generated/prisma/client.js';
import { createPairingCode } from '../auth/index.js';
import { costing, roundPrice, unitFactor } from './costing.js';

type Headers = Record<string, string>;
let app: App;
let branchId: string;
let admin: Headers;
let units: Unit[];
let menu: MenuResponse;

async function loginAs(username: string, password: string): Promise<Headers> {
  const { code } = await createPairingCode(prisma, { branchId: toDbId(branchId) });
  const device = (
    await app.inject({
      method: 'POST',
      url: '/api/devices/pair',
      payload: { code, name: 'D', type: 'ADMIN' },
    })
  ).json();
  const session = (
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-device-id': device.deviceId, 'x-device-token': device.deviceToken },
      payload: { username, password },
    })
  ).json();
  return { authorization: `Bearer ${session.accessToken}`, 'x-device-id': device.deviceId };
}

const call = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object, headers = admin) =>
  app.inject({ method, url, headers, ...(payload ? { payload } : {}) });
const unit = (code: string) => units.find((u) => u.code === code)!.id;
const product = (name: string) => menu.products.find((p) => p.name === name)!;

async function ingredient(name: string, baseUnit: string, unitCost: string): Promise<Ingredient> {
  const res = await call('POST', '/api/ingredients', {
    id: newId(),
    name,
    category: 'Abarrotes',
    baseUnitId: unit(baseUnit),
    unitCost,
  });
  return res.json();
}

async function costed(name: string): Promise<CostedProduct> {
  const list = (await call('GET', '/api/costing/products')).json<CostedProduct[]>();
  return list.find((p) => p.name === name)!;
}

/** Café de olla (12.00): 15 g de café a Q120/kg + 20 g de azúcar a Q10/kg con 10 % de merma */
async function coffeeRecipe() {
  const coffee = await ingredient('Café molido', 'kg', '120');
  const sugar = await ingredient('Azúcar', 'kg', '10');
  const res = await call('PUT', `/api/products/${product('Café de olla').id}/recipe`, {
    lines: [
      { ingredientId: coffee.id, quantity: '15', unitId: unit('g'), wastePct: 0 },
      { ingredientId: sugar.id, quantity: '20', unitId: unit('g'), wastePct: 10 },
    ],
  });
  return { coffee, sugar, res };
}

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  admin = await loginAs('dev', 'desarrollo-local');
  units = (await call('GET', '/api/units')).json();
  menu = (await call('GET', '/api/menu')).json();
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('cálculos de costeo (Docs/07 §4.6)', () => {
  const D = (v: string) => new Prisma.Decimal(v);
  const conv = [
    { fromUnitId: 'kg', toUnitId: 'g', factor: D('1000') },
    { fromUnitId: 'oz', toUnitId: 'g', factor: D('28.349523') },
  ];

  it('convierte en los dos sentidos y encadenado; entre dimensiones no hay camino', () => {
    expect(unitFactor(conv, 'kg', 'g')!.toString()).toBe('1000');
    expect(unitFactor(conv, 'g', 'kg')!.toString()).toBe('0.001');
    expect(unitFactor(conv, 'oz', 'kg')!.toDecimalPlaces(6).toString()).toBe('0.02835');
    expect(unitFactor(conv, 'g', 'ml')).toBeNull();
  });

  it('redondea el precio hacia arriba o al más cercano (PA-045)', () => {
    expect(roundPrice(D('6.73'), '1.00', 'UP').toFixed(2)).toBe('7.00');
    expect(roundPrice(D('7.00'), '1.00', 'UP').toFixed(2)).toBe('7.00');
    expect(roundPrice(D('8.08'), '0.50', 'NEAREST').toFixed(2)).toBe('8.00');
    expect(roundPrice(D('8.25'), '0.50', 'NEAREST').toFixed(2)).toBe('8.50');
    expect(roundPrice(D('5.05'), '5.00', 'UP').toFixed(2)).toBe('10.00');
  });

  it('precio sugerido, % de costo y margen real (RF-135, RF-136)', () => {
    const target = { targetFoodCostPct: 30, roundingStep: '1.00', roundingMode: 'UP' } as const;
    const c = costing(D('3'), D('10'), target);
    expect(c.suggestedPrice!.toFixed(2)).toBe('10.00');
    expect(c).toMatchObject({ foodCostPct: 30, marginPct: 70, belowTarget: false });
    expect(costing(D('3.5'), D('10'), target).belowTarget).toBe(true);
    expect(costing(null, D('10'), target).suggestedPrice).toBeNull();
  });
});

describe('unidades e insumos (RF-130, RF-131)', () => {
  it('trae las unidades de templates/seed', () => {
    expect(units.map((u) => u.code).sort()).toEqual(['g', 'kg', 'l', 'ml', 'oz', 'u']);
  });

  it('crea un insumo (idempotente), con historial de costo; el nombre no se repite', async () => {
    const body = {
      id: newId(),
      name: 'Tomate',
      category: 'Verduras',
      baseUnitId: unit('kg'),
      unitCost: '8.5',
    };
    const first = await call('POST', '/api/ingredients', body);
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ name: 'Tomate', unitCost: '8.5000', recipeCount: 0 });
    expect((await call('POST', '/api/ingredients', body)).statusCode).toBe(200);
    const dup = await call('POST', '/api/ingredients', { ...body, id: newId(), name: 'TOMATE' });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('INGREDIENT_NAME_TAKEN');
    const history = (await call('GET', `/api/ingredients/${body.id}/costs`)).json();
    expect(history).toEqual([
      expect.objectContaining({ unitCost: '8.5000', setByName: 'Usuario de desarrollo' }),
    ]);
  });

  it('desactivar lo saca de la lista normal pero no de ?all=true', async () => {
    const tomato = await ingredient('Tomate', 'kg', '8');
    const off = await call('PUT', `/api/ingredients/${tomato.id}`, {
      name: 'Tomate',
      category: null,
      baseUnitId: unit('kg'),
      active: false,
    });
    expect(off.json()).toMatchObject({ active: false, category: null });
    expect((await call('GET', '/api/ingredients')).json()).toHaveLength(0);
    expect((await call('GET', '/api/ingredients?all=true')).json()).toHaveLength(1);
  });

  it('un mesero no entra a recetas y costeo', async () => {
    await createUser('ana', 'Mesero', { password: 'clave-mesero-1' });
    const ana = await loginAs('ana', 'clave-mesero-1');
    const res = await call('GET', '/api/ingredients', undefined, ana);
    expect(res.json().error.code).toBe('AUTHORIZATION_REQUIRED');
  });

  it('con el módulo apagado en la licencia responde MODULE_DISABLED', async () => {
    await prisma.license.updateMany({ data: { modules: { recipes: false } } });
    const res = await call('GET', '/api/units');
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('MODULE_DISABLED');
  });
});

describe('recetas y costeo (RF-132 a RF-138)', () => {
  it('la receta en gramos usa insumos costeados por kg, con merma', async () => {
    const { res } = await coffeeRecipe();
    expect(res.statusCode).toBe(200);
    // 0.015 × 120 + 0.020 × 1.10 × 10 = 1.80 + 0.22
    expect(res.json()).toMatchObject({
      cost: '2.0200',
      lines: [
        { ingredientName: 'Café molido', quantity: '15', cost: '1.8000' },
        { ingredientName: 'Azúcar', wastePct: 10, cost: '0.2200' },
      ],
    });
    expect(await costed('Café de olla')).toMatchObject({
      hasRecipe: true,
      cost: '2.0200',
      price: '12.00',
      targetScope: 'DEFAULT',
      target: { targetFoodCostPct: 30, roundingStep: '1.00', roundingMode: 'UP' },
      // 2.02 / 0.30 = 6.73 → 7.00
      suggestedPrice: '7.00',
      foodCostPct: 16.83,
      marginPct: 83.17,
      belowTarget: false,
    });
  });

  it('una unidad de otra dimensión no se acepta; sin líneas la receta se borra', async () => {
    const milk = await ingredient('Leche', 'l', '12');
    const url = `/api/products/${product('Café de olla').id}/recipe`;
    const bad = await call('PUT', url, {
      lines: [{ ingredientId: milk.id, quantity: '100', unitId: unit('g'), wastePct: 0 }],
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.message).toMatch(/litro/);
    const ok = await call('PUT', url, {
      lines: [{ ingredientId: milk.id, quantity: '250', unitId: unit('ml'), wastePct: 0 }],
    });
    expect(ok.json().cost).toBe('3.0000');
    expect((await call('PUT', url, { lines: [] })).json()).toBeNull();
    expect((await call('GET', url)).json()).toBeNull();
  });

  it('cambiar el costo de un insumo recalcula y dice qué productos cambiaron (RF-138)', async () => {
    const { coffee } = await coffeeRecipe();
    const res = await call('POST', `/api/ingredients/${coffee.id}/cost`, { unitCost: '400' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ingredient.unitCost).toBe('400.0000');
    const affected = res.json().affected as CostedProduct[];
    expect(affected.find((p) => p.name === 'Café de olla')).toMatchObject({
      cost: '6.2200',
      suggestedPrice: '21.00',
      belowTarget: true,
    });
    const below = (await call('GET', '/api/costing/products?belowTarget=true')).json();
    expect(below.map((p: CostedProduct) => p.name)).toContain('Café de olla');
    expect((await call('GET', `/api/ingredients/${coffee.id}/costs`)).json()).toHaveLength(2);
    // Ya está en una receta: la unidad base no se cambia
    const base = await call('PUT', `/api/ingredients/${coffee.id}`, {
      name: 'Café molido',
      category: null,
      baseUnitId: unit('g'),
      active: true,
    });
    expect(base.statusCode).toBe(400);
  });

  it('objetivo: producto > categoría > restaurante (RF-134)', async () => {
    await coffeeRecipe();
    const cafe = await costed('Café de olla');
    const put = (body: object) => call('PUT', '/api/cost-targets', body);
    await put({
      scope: 'CLIENT',
      target: { targetFoodCostPct: 25, roundingStep: '0.50', roundingMode: 'NEAREST' },
    });
    // 2.02 / 0.25 = 8.08 → 8.00
    expect(await costed('Café de olla')).toMatchObject({
      targetScope: 'CLIENT',
      suggestedPrice: '8.00',
    });
    await put({
      scope: 'CATEGORY',
      categoryId: cafe.categoryId,
      target: { targetFoodCostPct: 20, roundingStep: '1.00', roundingMode: 'UP' },
    });
    expect((await costed('Café de olla')).targetScope).toBe('CATEGORY');
    const res = await put({
      scope: 'PRODUCT',
      productId: cafe.productId,
      target: { targetFoodCostPct: 40, roundingStep: '5.00', roundingMode: 'UP' },
    });
    expect(res.json().products).toHaveLength(1);
    // 2.02 / 0.40 = 5.05 → 10.00
    expect(await costed('Café de olla')).toMatchObject({
      targetScope: 'PRODUCT',
      suggestedPrice: '10.00',
    });
    await put({ scope: 'PRODUCT', productId: cafe.productId, target: null });
    expect((await costed('Café de olla')).targetScope).toBe('CATEGORY');
    expect((await call('GET', '/api/cost-targets')).json()).toMatchObject({
      client: { targetFoodCostPct: 25 },
      categories: [{ categoryId: cafe.categoryId, targetFoodCostPct: 20 }],
      products: [],
    });
  });
});

describe('costo congelado en la venta (RF-139)', () => {
  async function sell(name: string) {
    const zone = (await call('POST', '/api/zones', { name: `Zona ${newId()}` })).json();
    const table = (
      await call('POST', '/api/tables', { zoneId: zone.id, name: newId().slice(-4), capacity: 2 })
    ).json();
    const occ = (
      await call('POST', '/api/occupancies', {
        id: newId(),
        tableId: table.id,
        orderTypeCode: 'MESA',
        guests: 1,
      })
    ).json();
    const p = product(name);
    const itemId = newId();
    const res = await call('POST', '/api/orders', {
      id: newId(),
      occupancyId: occ.id,
      clientSentAt: new Date().toISOString(),
      items: [
        { id: itemId, billId: occ.bills[0].id, productId: p.id, quantity: 2, unitPrice: p.price },
      ],
    });
    expect(res.statusCode).toBe(201);
    const item = await prisma.orderItem.findUniqueOrThrow({ where: { id: toDbId(itemId) } });
    return item.unitCostSnapshot?.toFixed(4) ?? null;
  }

  it('el ítem guarda el costo del momento; cambiarlo después no altera la venta', async () => {
    const { coffee } = await coffeeRecipe();
    const sold = await sell('Café de olla');
    expect(sold).toBe('2.0200');
    await call('POST', `/api/ingredients/${coffee.id}/cost`, { unitCost: '400' });
    const after = await prisma.orderItem.findFirstOrThrow({
      where: { unitCostSnapshot: { not: null } },
    });
    expect(after.unitCostSnapshot!.toFixed(4)).toBe('2.0200');
    expect(await sell('Café de olla')).toBe('6.2200');
  });

  it('sin receta el costo queda vacío', async () => {
    expect(await sell('Café de olla')).toBeNull();
  });
});
