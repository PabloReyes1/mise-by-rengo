// Comando del seed (Docs/13 §2 pasos 6 y 7). Lo usa nuevo-cliente.sh; en desarrollo, a mano:
//   pnpm --filter @mise/backend seed -- --trade-name "La Fonda" --admin admin --with-menu --dev-user
// Lee DATABASE_URL del .env de la carpeta actual, igual que el backend.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { createPrisma } from './core/db.js';
import { tagged } from './core/logger.js';
import { seedClient } from './core/seed.js';

const { values } = parseArgs({
  options: {
    template: { type: 'string', default: 'restaurante-basico' },
    'trade-name': { type: 'string' },
    plan: { type: 'string', default: 'MVP' },
    admin: { type: 'string', default: 'admin' },
    'with-menu': { type: 'boolean', default: false },
    'dev-user': { type: 'boolean', default: false },
  },
});

if (existsSync('.env')) process.loadEnvFile('.env');
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl || !values['trade-name']) {
  console.error(
    tagged('BOOT', 'Uso: seed --trade-name "Nombre" [--admin admin] [--with-menu] [--dev-user]'),
  );
  console.error(tagged('BOOT', 'Requiere DATABASE_URL en el .env de la carpeta actual'));
  process.exit(1);
}

const prisma = createPrisma(databaseUrl);
try {
  const result = await seedClient(prisma, {
    // templates/ está en la raíz del repositorio, tanto desde src/ como desde dist/
    templatesDir: join(import.meta.dirname, '..', '..', 'templates'),
    template: values.template,
    tradeName: values['trade-name'],
    plan: values.plan,
    adminUsername: values.admin,
    withMenu: values['with-menu'],
    devUser: values['dev-user'],
  });
  console.log(tagged('BOOT', `Cliente sembrado con la plantilla ${values.template}.`));
  console.log(tagged('BOOT', `Administrador: ${values.admin}`));
  console.log(
    tagged(
      'BOOT',
      `Contraseña temporal (se muestra UNA sola vez, cámbiala al entrar): ${result.adminPassword}`,
    ),
  );
  if (values['dev-user'])
    console.log(tagged('BOOT', 'Usuario de desarrollo: dev / desarrollo-local / PIN 0000'));
} catch (error) {
  console.error(tagged('BOOT', error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
