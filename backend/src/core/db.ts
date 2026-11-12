// Cliente de Prisma 7 sin motor Rust, con el adaptador de node-postgres (ADR-002, ADR-012).
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export function createPrisma(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

/** Consulta mínima para saber si la base responde (la usa /api/health). */
export function pingDb(prisma: PrismaClient): Promise<unknown> {
  return prisma.$queryRaw`SELECT 1`;
}
