// Validación del .env del cliente (Docs/13 §2.1). El backend no arranca si falta una clave.
import { z } from 'zod';

const postgresUrl = z
  .string()
  .regex(/^postgres(ql)?:\/\//, 'debe ser una URL de PostgreSQL (postgresql://...)');

const envSchema = z
  .object({
    /** Solo para logs; el nombre comercial vive en la base */
    CLIENT_NAME: z.string().min(1),
    PORT: z.coerce.number().int().min(1).max(65535),
    DATABASE_URL: postgresUrl,
    /** Rol de solo lectura del chatbot (esquema semantic) */
    DATABASE_URL_RO: postgresUrl.optional(),
    /** 64 bytes aleatorios en hex (128 caracteres), distinto por cliente */
    JWT_SECRET: z.string().min(64, 'debe tener al menos 64 caracteres (64 bytes aleatorios)'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('warn'),
    AI_PROVIDER: z.string().optional(),
    /** Sin valor por defecto: lo indica RENGO (Docs/10 §2.1) */
    AI_MODEL: z.string().optional(),
    AI_API_KEY: z.string().optional(),
    AI_MAX_TOKENS: z.coerce.number().int().positive().default(800),
    /** Dominio público (CORS y orígenes de Socket.IO) */
    PUBLIC_DOMAIN: z.string().min(1),
    MIN_FRONTEND_VERSION: z.string().regex(/^\d+\.\d+\.\d+$/, 'debe tener formato X.Y.Z'),
  })
  .superRefine((env, ctx) => {
    if (!env.AI_PROVIDER) return;
    for (const key of ['AI_MODEL', 'AI_API_KEY'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'obligatorio si AI_PROVIDER está definido',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Valida las variables de entorno. Las claves vacías (CLAVE=) cuentan como no definidas. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`El archivo .env no es válido:\n${problems}`);
  }
  return result.data;
}
