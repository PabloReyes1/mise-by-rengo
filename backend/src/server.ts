// Punto de entrada del proceso de un cliente (pm2, Docs/13 §2.3).
// Lee el .env de la carpeta actual (cwd = /opt/mise/clients/<Cliente>, Docs/06 §3.2) y
// escucha SOLO en 127.0.0.1: Caddy es lo único expuesto a internet.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildApp } from './core/app.js';
import { createPrisma, pingDb } from './core/db.js';
import { parseEnv, type Env } from './core/env.js';
import { tagged } from './core/logger.js';

const HOST = '127.0.0.1';

function loadEnv(): Env {
  const envFile = join(process.cwd(), '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  try {
    return parseEnv(process.env);
  } catch (error) {
    console.error(tagged('BOOT', error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

const env = loadEnv();
const prisma = createPrisma(env.DATABASE_URL);
const app = await buildApp({ env, prisma, checkDb: () => pingDb(prisma) });

async function shutdown(signal: string): Promise<void> {
  app.log.warn(tagged('BOOT', `${signal} recibido, cerrando`));
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ host: HOST, port: env.PORT });
  app.log.warn(tagged('BOOT', `escuchando en ${HOST}:${env.PORT}`));
} catch (error) {
  app.log.fatal({ err: error }, tagged('BOOT', 'no se pudo iniciar'));
  await prisma.$disconnect();
  process.exit(1);
}
