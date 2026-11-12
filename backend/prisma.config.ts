// Configuración de Prisma 7 (ADR-012). Prisma 7 ya no carga el .env solo:
// se carga aquí desde la carpeta actual, igual que el backend (regla R1, Docs/06 §3.2).
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env')) process.loadEnvFile('.env');

const url = process.env['DATABASE_URL'];

export default defineConfig({
  // Un archivo .prisma por módulo (Docs/19 §3, ADR-012)
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` no necesita la base; migrate sí (sin DATABASE_URL, falla con un mensaje claro)
  ...(url ? { datasource: { url } } : {}),
});
