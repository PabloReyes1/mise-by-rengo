// App con base real y datos de la plantilla, para pruebas de integración de los módulos.
import { join } from 'node:path';
import { buildApp, type App, type BuildAppOptions } from './app.js';
import { newDbId, toApiId } from './ids.js';
import { hashSecret } from './secrets.js';
import { seedClient } from './seed.js';
import { resetDb, testPrisma } from './test-db.js';
import { testEnv } from './test-helpers.js';

export const prisma = testPrisma();
const TEMPLATES_DIR = join(import.meta.dirname, '..', '..', '..', 'templates');

export interface Fixture {
  app: App;
  branchId: string;
  adminPassword: string;
}

/** Base vacía + plantilla restaurante-basico con menú y usuario dev + app con la base. */
export async function setupFixture(options: Partial<BuildAppOptions> = {}): Promise<Fixture> {
  await resetDb(prisma);
  const { adminPassword } = await seedClient(prisma, {
    templatesDir: TEMPLATES_DIR,
    template: 'restaurante-basico',
    tradeName: 'La Fonda de Prueba',
    plan: 'MVP',
    adminUsername: 'admin',
    withMenu: true,
    devUser: true,
  });
  const branch = await prisma.branch.findFirstOrThrow();
  const app = await buildApp({
    env: testEnv(),
    checkDb: () => Promise.resolve(),
    prisma,
    licenseCacheMs: 0,
    ...options,
  });
  return { app, branchId: toApiId(branch.id), adminPassword };
}

/** Crea un usuario con un rol de la plantilla, en la sucursal principal. */
export async function createUser(
  username: string,
  roleName: string,
  { password = 'clave-segura-123', pin }: { password?: string; pin?: string } = {},
): Promise<string> {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  const branch = await prisma.branch.findFirstOrThrow();
  const id = newDbId();
  await prisma.user.create({
    data: {
      id,
      fullName: username,
      username,
      passwordHash: await hashSecret(password),
      pinHash: pin ? await hashSecret(pin) : null,
      roles: { create: [{ roleId: role.id }] },
      branches: { create: [{ branchId: branch.id }] },
    },
  });
  return toApiId(id);
}
