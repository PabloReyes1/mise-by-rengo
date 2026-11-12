// Base de datos real para las pruebas de integración (solo pruebas).
// Local: backend/.env.test (TEST_DATABASE_URL). CI: un PostgreSQL 18 del workflow.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createPrisma } from './db.js';

function testDatabaseUrl(): string {
  const envFile = join(import.meta.dirname, '..', '..', '.env.test');
  if (!process.env['TEST_DATABASE_URL'] && existsSync(envFile)) process.loadEnvFile(envFile);
  const url = process.env['TEST_DATABASE_URL'];
  if (!url) {
    throw new Error(
      'Falta TEST_DATABASE_URL: crea backend/.env.test apuntando a una base de pruebas (Docs/19 §3)',
    );
  }
  return url;
}

export const TEST_DATABASE_URL = testDatabaseUrl();

let client: PrismaClient | undefined;

export function testPrisma(): PrismaClient {
  client ??= createPrisma(TEST_DATABASE_URL);
  return client;
}

/** Deja todas las tablas vacías (incluida la bitácora, cuyo trigger se salta solo aquí). */
export async function resetDb(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`),
    prisma.$executeRawUnsafe(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`),
  ]);
}
