import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../core/app.js';
import { toDbId } from '../../core/ids.js';
import { resetDb } from '../../core/test-db.js';
import { createUser, prisma, setupFixture } from '../../core/test-app.js';
import { createPairingCode } from '../auth/index.js';

let app: App;
let branchId: string;
let admin: Record<string, string>;

async function loginAs(username: string, password: string) {
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

async function menu() {
  return (await app.inject({ method: 'GET', url: '/api/menu', headers: admin })).json();
}

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  admin = await loginAs('dev', 'desarrollo-local');
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('GET /api/menu (Docs/08 §2.4)', () => {
  it('trae categorías, productos con precio en string, modificadores y combos, sin imágenes', async () => {
    const m = await menu();
    expect(m.categories).toHaveLength(9);
    expect(m.products).toHaveLength(34);
    expect(m.modifierGroups).toHaveLength(9);
    const pepian = m.products.find((p: { sku: string }) => p.sku === 'PF-001');
    expect(pepian).toMatchObject({
      name: 'Pepián de pollo',
      price: '64.00',
      status: 'ACTIVE',
      imageUrl: null,
    });
    expect(pepian.modifierGroupIds).toHaveLength(1);
    const combo = m.products.find((p: { sku: string }) => p.sku === 'CMB-001');
    expect(combo.comboGroups.map((g: { name: string }) => g.name)).toEqual([
      'Plato fuerte',
      'Bebida',
    ]);
  });

  it('sin sesión no se puede leer el menú', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/menu' })).statusCode).toBe(401);
  });
});

describe('categorías y productos (config.menu)', () => {
  it('crea una categoría y un producto, y el mesero no puede', async () => {
    const cat = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: admin,
      payload: { name: 'Antojitos' },
    });
    expect(cat.statusCode).toBe(201);
    const product = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: admin,
      payload: {
        categoryId: cat.json().id,
        name: 'Garnachas',
        sku: 'ANT-001',
        price: '45.00',
      },
    });
    expect(product.statusCode).toBe(201);
    expect(product.json()).toMatchObject({ price: '45.00', status: 'ACTIVE' });

    await createUser('ana', 'Mesero');
    const waiter = await loginAs('ana', 'clave-segura-123');
    const denied = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: waiter,
      payload: { name: 'X' },
    });
    expect(denied.json().error.code).toBe('AUTHORIZATION_REQUIRED');
  });

  it('rechaza un SKU repetido', async () => {
    const m = await menu();
    const res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: admin,
      payload: { categoryId: m.categories[0].id, name: 'Otro', sku: 'PF-001', price: '10.00' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/SKU/);
  });

  it('cambiar el precio deja en la bitácora el precio anterior y el nuevo', async () => {
    const m = await menu();
    const jocon = m.products.find((p: { sku: string }) => p.sku === 'PF-002');
    const res = await app.inject({
      method: 'PUT',
      url: `/api/products/${jocon.id}`,
      headers: admin,
      payload: {
        categoryId: jocon.categoryId,
        name: jocon.name,
        sku: jocon.sku,
        price: '60.00',
        modifierGroupIds: jocon.modifierGroupIds,
      },
    });
    expect(res.statusCode).toBe(200);
    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'config.menu.update', entity: 'product' },
    });
    expect(log.before).toEqual({ price: '58.00' });
    expect(log.after).toEqual({ price: '60.00' });
  });
});

describe('agotado (RF-011, menu.toggle_soldout)', () => {
  it('Cocina puede marcar agotado; el mesero no', async () => {
    const m = await menu();
    const pepian = m.products.find((p: { sku: string }) => p.sku === 'PF-001');
    await createUser('chef', 'Cocina');
    const kitchen = await loginAs('chef', 'clave-segura-123');
    const ok = await app.inject({
      method: 'PATCH',
      url: `/api/products/${pepian.id}/status`,
      headers: kitchen,
      payload: { status: 'SOLD_OUT' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().status).toBe('SOLD_OUT');

    await createUser('ana', 'Mesero');
    const waiter = await loginAs('ana', 'clave-segura-123');
    const denied = await app.inject({
      method: 'PATCH',
      url: `/api/products/${pepian.id}/status`,
      headers: waiter,
      payload: { status: 'ACTIVE' },
    });
    expect(denied.json().error.code).toBe('AUTHORIZATION_REQUIRED');
  });
});

describe('modificadores por categoría (2026-11-23)', () => {
  type Named = { id: string; name: string };
  const byName = <T extends Named>(list: T[], name: string) => list.find((x) => x.name === name)!;

  it('cada grupo dice en qué categorías está disponible', async () => {
    const m = await menu();
    const termino = byName(m.modifierGroups, 'Término de la carne');
    expect(termino.categoryIds).toEqual([byName(m.categories, 'Platos fuertes').id]);
  });

  it('un producto no puede usar un grupo que no está en su categoría', async () => {
    const m = await menu();
    const res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: admin,
      payload: {
        categoryId: byName(m.categories, 'Ensaladas').id,
        name: 'Ensalada rara',
        sku: 'ENS-099',
        price: '40.00',
        modifierGroupIds: [byName(m.modifierGroups, 'Término de la carne').id],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/no está disponible/);
  });

  it('al quitar una categoría del grupo, sus productos dejan de usarlo', async () => {
    const m = await menu();
    const extras = byName(m.modifierGroups, 'Extras') as Named & {
      categoryIds: string[];
      modifiers: { id: string; name: string; priceDelta: string }[];
    };
    const platos = byName(m.categories, 'Platos fuertes').id;
    const res = await app.inject({
      method: 'PUT',
      url: `/api/modifier-groups/${extras.id}`,
      headers: admin,
      payload: {
        name: 'Extras',
        required: false,
        minSelect: 0,
        maxSelect: 3,
        categoryIds: extras.categoryIds.filter((c) => c !== platos),
        modifiers: extras.modifiers.map(({ id, name, priceDelta }) => ({ id, name, priceDelta })),
      },
    });
    expect(res.statusCode).toBe(200);
    const after = await menu();
    const pepian = after.products.find((p: { sku: string }) => p.sku === 'PF-001');
    expect(pepian.modifierGroupIds).not.toContain(extras.id);
  });

  it('un grupo necesita al menos una categoría', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/modifier-groups',
      headers: admin,
      payload: {
        name: 'X',
        required: false,
        minSelect: 0,
        maxSelect: 1,
        categoryIds: [],
        modifiers: [],
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('modificadores y combos (RF-013 a RF-015)', () => {
  it('quitar un modificador del grupo lo desactiva, no lo borra (historial)', async () => {
    const m = await menu();
    const extras = m.modifierGroups.find((g: { name: string }) => g.name === 'Extras');
    const keep = extras.modifiers.filter((x: { name: string }) => x.name !== 'Queso fresco');
    const res = await app.inject({
      method: 'PUT',
      url: `/api/modifier-groups/${extras.id}`,
      headers: admin,
      payload: {
        name: 'Extras',
        required: false,
        minSelect: 0,
        maxSelect: 3,
        categoryIds: extras.categoryIds,
        modifiers: [
          ...keep.map((x: { id: string; name: string; priceDelta: string }) => ({
            id: x.id,
            name: x.name,
            priceDelta: x.priceDelta,
          })),
          { name: 'Chile', priceDelta: '2.00' },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const statuses = Object.fromEntries(
      res.json().modifiers.map((x: { name: string; status: string }) => [x.name, x.status]),
    );
    expect(statuses).toMatchObject({
      'Queso fresco': 'INACTIVE',
      Chile: 'ACTIVE',
      Aguacate: 'ACTIVE',
    });
  });

  it('los grupos de combo solo se ponen en productos marcados como combo', async () => {
    const m = await menu();
    const jocon = m.products.find((p: { sku: string }) => p.sku === 'PF-002');
    const horchata = m.products.find((p: { sku: string }) => p.sku === 'BEB-001');
    const res = await app.inject({
      method: 'PUT',
      url: `/api/products/${jocon.id}/combo-groups`,
      headers: admin,
      payload: {
        groups: [
          {
            name: 'Bebida',
            minSelect: 1,
            maxSelect: 1,
            options: [{ productId: horchata.id, priceDelta: '0.00', isDefault: true }],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('reemplaza los grupos de un combo', async () => {
    const m = await menu();
    const combo = m.products.find((p: { sku: string }) => p.sku === 'CMB-001');
    const cafe = m.products.find((p: { sku: string }) => p.sku === 'BEB-003');
    const res = await app.inject({
      method: 'PUT',
      url: `/api/products/${combo.id}/combo-groups`,
      headers: admin,
      payload: {
        groups: [
          {
            name: 'Bebida caliente',
            minSelect: 1,
            maxSelect: 1,
            options: [{ productId: cafe.id, priceDelta: '0.00', isDefault: true }],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().comboGroups.map((g: { name: string }) => g.name)).toEqual([
      'Bebida caliente',
    ]);
  });
});

describe('fotos de productos (RF-016, ADR-009)', () => {
  it('sube una foto, la guarda como WebP de máx. 800 px y la sirve con caché inmutable', async () => {
    const m = await menu();
    const pepian = m.products.find((p: { sku: string }) => p.sku === 'PF-001');
    const png = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: '#7a5230' },
    })
      .png()
      .toBuffer();
    const boundary = '----mise';
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="pepian.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const up = await app.inject({
      method: 'POST',
      url: `/api/products/${pepian.id}/image`,
      headers: { ...admin, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    expect(up.statusCode).toBe(200);
    const imageUrl: string = up.json().imageUrl;
    expect(imageUrl).toMatch(new RegExp(`^/api/products/${pepian.id}/image\\?v=`));

    const img = await app.inject({ method: 'GET', url: imageUrl });
    expect(img.statusCode).toBe(200);
    expect(img.headers['content-type']).toBe('image/webp');
    expect(img.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    const meta = await sharp(img.rawPayload).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(800);
    expect(img.rawPayload.length).toBeLessThanOrEqual(150 * 1024);
  });
});
