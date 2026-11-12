// Código de emparejamiento desde el servidor (SC-14): para el PRIMER dispositivo de un cliente,
// cuando todavía no hay ningún administrador con sesión que pueda generarlo desde la app.
//   pnpm --filter @mise/backend pairing-code            (sucursal principal)
//   pnpm --filter @mise/backend pairing-code -- --branch "Zona 10"
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createPrisma } from './core/db.js';
import { tagged } from './core/logger.js';
import { createPairingCode } from './modules/auth/index.js';

const { values } = parseArgs({ options: { branch: { type: 'string' } } });

if (existsSync('.env')) process.loadEnvFile('.env');
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  console.error(tagged('BOOT', 'Requiere DATABASE_URL en el .env de la carpeta actual'));
  process.exit(1);
}

const prisma = createPrisma(databaseUrl);
try {
  const branch = await prisma.branch.findFirst({
    where: values.branch ? { name: values.branch } : { active: true },
    orderBy: { name: 'asc' },
  });
  if (!branch)
    throw new Error(values.branch ? `No existe la sucursal ${values.branch}` : 'No hay sucursales');
  const { code, expiresAt } = await createPairingCode(prisma, { branchId: branch.id });
  console.log(tagged('AUTH', `Código de emparejamiento para ${branch.name}: ${code}`));
  console.log(tagged('AUTH', `Vence: ${expiresAt.toISOString()} (10 minutos, un solo uso)`));
} catch (error) {
  console.error(tagged('BOOT', error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
