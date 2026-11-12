// Antes de las pruebas del backend: deja la base de pruebas con el esquema al día.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export default function setup(): void {
  const backendDir = join(import.meta.dirname, '..', '..');
  const envFile = join(backendDir, '.env.test');
  if (!process.env['TEST_DATABASE_URL'] && existsSync(envFile)) process.loadEnvFile(envFile);
  const url = process.env['TEST_DATABASE_URL'];
  if (!url) return; // test-db.ts falla con un mensaje claro en las pruebas que la necesitan

  // Solo aplica migraciones pendientes (no destructivo); cada prueba vacía las tablas con resetDb()
  execSync('pnpm exec prisma migrate deploy', {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
