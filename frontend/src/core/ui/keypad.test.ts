import { describe, expect, it } from 'vitest';
import { applyKey } from './keypad.js';

describe('applyKey: teclado de montos (2 decimales)', () => {
  const amount = { mode: 'amount' as const, maxLength: 9 };

  it('agrega dígitos', () => {
    expect(applyKey('12', '3', amount)).toBe('123');
  });

  it('un 0 inicial se reemplaza por el siguiente dígito', () => {
    expect(applyKey('0', '5', amount)).toBe('5');
  });

  it('el punto al inicio escribe 0.', () => {
    expect(applyKey('', '.', amount)).toBe('0.');
  });

  it('no permite dos puntos', () => {
    expect(applyKey('12.5', '.', amount)).toBe('12.5');
  });

  it('no permite más de 2 decimales', () => {
    expect(applyKey('12.50', '7', amount)).toBe('12.50');
  });

  it('borrar quita el último carácter', () => {
    expect(applyKey('12.5', 'backspace', amount)).toBe('12.');
  });

  it('respeta el largo máximo', () => {
    expect(applyKey('123456789', '1', amount)).toBe('123456789');
  });
});

describe('applyKey: código de emparejamiento', () => {
  it('acepta solo dígitos hasta el largo del código', () => {
    const code = { mode: 'code' as const, maxLength: 6 };
    expect(applyKey('48211', '.', code)).toBe('48211');
    expect(applyKey('48211', '3', code)).toBe('482113');
    expect(applyKey('482113', '9', code)).toBe('482113');
  });
});

describe('applyKey: teclado de PIN', () => {
  const pin = { mode: 'pin' as const, maxLength: 4 };

  it('acepta solo dígitos, sin punto', () => {
    expect(applyKey('12', '.', pin)).toBe('12');
  });

  it('el 0 inicial se conserva en un PIN', () => {
    expect(applyKey('0', '7', pin)).toBe('07');
  });

  it('se detiene en el largo del PIN', () => {
    expect(applyKey('4821', '5', pin)).toBe('4821');
  });

  it('borrar con el campo vacío no hace nada', () => {
    expect(applyKey('', 'backspace', pin)).toBe('');
  });
});
