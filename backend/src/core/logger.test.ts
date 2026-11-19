import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { loggerOptions, tagged } from './logger.js';
import { testEnv } from './test-helpers.js';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  const log = pino(loggerOptions(testEnv({ LOG_LEVEL: 'info' })), stream);
  return { log, lines };
}

describe('logs (Docs/13 §6, RNF-080)', () => {
  it('la etiqueta va al inicio del mensaje para poder buscarla con grep', () => {
    expect(tagged('SYNC', 'operación aplicada')).toBe('[SYNC] operación aplicada');
  });

  it('cada línea incluye el cliente', () => {
    const { log, lines } = capture();
    log.info('hola');
    expect(JSON.parse(lines[0]!)).toMatchObject({ client: 'Prueba', msg: 'hola' });
  });

  it('nunca escribe contraseñas, PIN ni tokens', () => {
    const { log, lines } = capture();
    log.info(
      {
        pin: '4821',
        password: 'secreta',
        body: { authorization: { pin: '1111' }, refreshToken: 'r-token' },
        req: { headers: { authorization: 'Bearer abc' } },
      },
      'intento',
    );
    const out = lines[0]!;
    expect(out).not.toContain('4821');
    expect(out).not.toContain('secreta');
    expect(out).not.toContain('1111');
    expect(out).not.toContain('Bearer abc');
    expect(out).not.toContain('r-token');
  });
});
