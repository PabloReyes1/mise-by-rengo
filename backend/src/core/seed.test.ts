import { join } from 'node:path';
import { verify } from '@node-rs/argon2';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedClient } from './seed.js';
import { resetDb, testPrisma } from './test-db.js';

const TEMPLATES_DIR = join(import.meta.dirname, '..', '..', '..', 'templates');
const prisma = testPrisma();

const base = {
  templatesDir: TEMPLATES_DIR,
  template: 'restaurante-basico',
  tradeName: 'La Fonda de Prueba',
  plan: 'MVP',
};

beforeEach(async () => {
  await resetDb(prisma);
});

describe('seedClient (Docs/13 §2 pasos 6 y 7)', () => {
  it('carga la plantilla: configuración, licencia, sucursal, estación, roles, motivos y tickets', async () => {
    await seedClient(prisma, { ...base, adminUsername: 'admin' });

    const settings = await prisma.clientSettings.findFirstOrThrow();
    expect(settings).toMatchObject({
      tradeName: 'La Fonda de Prueba',
      themeId: 'botanical-graphite',
      discountsEnabled: false,
    });
    expect(await prisma.license.count()).toBe(1);
    expect(await prisma.branch.count()).toBe(1);
    expect(await prisma.kitchenStation.count({ where: { isDefault: true } })).toBe(1);
    expect(await prisma.role.count()).toBe(5);
    expect(await prisma.reason.count()).toBe(15);
    expect(await prisma.ticketTemplate.count()).toBe(5);
    expect(await prisma.orderType.count()).toBe(2);
  });

  it('el Administrador queda con los 42 permisos', async () => {
    await seedClient(prisma, { ...base, adminUsername: 'admin' });
    const admin = await prisma.role.findUniqueOrThrow({
      where: { name: 'Administrador' },
      include: { permissions: true },
    });
    expect(admin.permissions).toHaveLength(42);
    expect(admin.isSystem).toBe(true);
  });

  it('crea el administrador inicial con contraseña temporal (se devuelve una sola vez) y la guarda cifrada', async () => {
    const result = await seedClient(prisma, { ...base, adminUsername: 'admin' });
    expect(result.adminPassword.length).toBeGreaterThanOrEqual(12);

    const admin = await prisma.user.findUniqueOrThrow({
      where: { username: 'admin' },
      include: { roles: { include: { role: true } }, branches: true },
    });
    expect(admin.passwordHash).not.toContain(result.adminPassword);
    expect(await verify(admin.passwordHash, result.adminPassword)).toBe(true);
    expect(admin.roles.map((r) => r.role.name)).toEqual(['Administrador']);
    expect(admin.branches).toHaveLength(1);
  });

  it('sin --with-menu no carga el menú de ejemplo', async () => {
    await seedClient(prisma, { ...base, adminUsername: 'admin' });
    expect(await prisma.product.count()).toBe(0);
  });

  it('con --with-menu carga categorías, productos, modificadores y el combo', async () => {
    await seedClient(prisma, { ...base, adminUsername: 'admin', withMenu: true });
    expect(await prisma.category.count()).toBe(5);
    expect(await prisma.product.count()).toBe(11);
    expect(await prisma.modifierGroup.count()).toBe(3);
    expect(await prisma.comboGroup.count()).toBe(2);
    const pepian = await prisma.product.findUniqueOrThrow({
      where: { sku: 'PF-001' },
      include: { modifierGroups: true },
    });
    expect(pepian.price.toString()).toBe('64');
    expect(pepian.modifierGroups).toHaveLength(1);
  });

  it('el usuario de desarrollo solo se crea si se pide', async () => {
    await seedClient(prisma, { ...base, adminUsername: 'admin' });
    expect(await prisma.user.findUnique({ where: { username: 'dev' } })).toBeNull();
  });

  it('con --dev-user crea el usuario dev con su contraseña y PIN cifrados', async () => {
    await seedClient(prisma, { ...base, adminUsername: 'admin', devUser: true });
    const dev = await prisma.user.findUniqueOrThrow({ where: { username: 'dev' } });
    expect(await verify(dev.passwordHash, 'desarrollo-local')).toBe(true);
    expect(await verify(dev.pinHash!, '0000')).toBe(true);
  });

  it('no se puede sembrar dos veces la misma base', async () => {
    await seedClient(prisma, { ...base, adminUsername: 'admin' });
    await expect(seedClient(prisma, { ...base, adminUsername: 'admin' })).rejects.toThrow(
      /ya tiene datos/,
    );
  });
});
