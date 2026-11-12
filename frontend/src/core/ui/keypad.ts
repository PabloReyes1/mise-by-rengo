// Lógica del teclado numérico: montos con 2 decimales (cobro, fondo, conteo) y PIN.

export type KeypadKey =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'backspace';

export interface KeypadOptions {
  /** amount = monto con 2 decimales · pin = dígitos ocultos · code = dígitos visibles (emparejar) */
  mode: 'amount' | 'pin' | 'code';
  maxLength: number;
}

const DECIMALS = 2;

export function applyKey(
  value: string,
  key: KeypadKey,
  { mode, maxLength }: KeypadOptions,
): string {
  if (key === 'backspace') return value.slice(0, -1);

  if (key === '.') {
    if (mode !== 'amount' || value.includes('.')) return value;
    return value === '' ? '0.' : `${value}.`;
  }

  if (value.length >= maxLength) return value;

  if (mode === 'amount') {
    const [, decimals] = value.split('.');
    if (decimals !== undefined && decimals.length >= DECIMALS) return value;
    if (value === '0') return key;
  }

  return value + key;
}
