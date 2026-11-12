// Licencia y módulos activos (RF-252, RF-256, PA-015, S-32).
import type { LICENSE_STATUSES } from '@mise/shared/contracts/config';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../../core/errors.js';

type LicenseStatus = (typeof LICENSE_STATUSES)[number];
const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(d: Date): number {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY_MS);
}

/**
 * Estado efectivo: SUSPENDIDA manda; si no, se calcula con valid_until y grace_days.
 * Los días se cuentan en fecha UTC (SC-15).
 */
export function effectiveLicense(
  license: { status: string; validUntil: Date | null; graceDays: number },
  today = new Date(),
): { status: LicenseStatus; daysLeft: number | null } {
  if (license.status === 'SUSPENDIDA') return { status: 'SUSPENDIDA', daysLeft: null };
  if (!license.validUntil) return { status: 'ACTIVA', daysLeft: null };
  const daysLeft = utcDay(license.validUntil) - utcDay(today);
  if (daysLeft >= 0) return { status: 'ACTIVA', daysLeft };
  if (-daysLeft <= license.graceDays) return { status: 'GRACIA', daysLeft };
  return { status: 'SOLO_LECTURA', daysLeft };
}

/** Lee la licencia con una caché corta (se consulta en cada petición). */
export function licenseReader(app: FastifyInstance, cacheMs = 30_000) {
  let cached: { at: number; value: Awaited<ReturnType<typeof load>> } | undefined;
  async function load() {
    const license = await app.prisma.license.findFirst();
    if (!license) return null;
    return { ...license, ...effectiveLicense(license) };
  }
  return {
    async get() {
      if (!cached || Date.now() - cached.at >= cacheMs)
        cached = { at: Date.now(), value: await load() };
      return cached.value;
    },
    invalidate() {
      cached = undefined;
    },
  };
}

/** Rutas que funcionan aunque la licencia esté suspendida (RF-252). */
const ALWAYS_ALLOWED = ['/api/health', '/api/time', '/api/config/public'];
/** Rutas de sesión: en solo lectura hay que poder entrar a consultar. */
const SESSION_ROUTES = ['/api/auth/'];
const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export function licenseGuard(reader: ReturnType<typeof licenseReader>) {
  return async (req: FastifyRequest) => {
    const path = req.url.split('?')[0]!;
    if (!path.startsWith('/api/') || ALWAYS_ALLOWED.includes(path)) return;
    const license = await reader.get();
    if (!license) return; // sin licencia cargada (base vacía): no se bloquea
    if (license.status === 'SUSPENDIDA') {
      throw new AppError('LICENSE_SUSPENDED', 'El servicio está suspendido. Contacta a RENGO.');
    }
    if (
      license.status === 'SOLO_LECTURA' &&
      !READ_METHODS.includes(req.method) &&
      !SESSION_ROUTES.some((p) => path.startsWith(p))
    ) {
      throw new AppError(
        'LICENSE_READ_ONLY',
        'La licencia venció: puedes consultar y exportar, pero no hacer cambios. Contacta a RENGO.',
      );
    }
  };
}
