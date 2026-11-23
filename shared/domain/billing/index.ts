// Cálculo de montos del lado del dispositivo (Docs/08 §1: montos como string "203.50").
// Dueño: Pablito. Se cuenta en centavos enteros para no pasar por coma flotante; el servidor
// recalcula siempre con decimales exactos y su resultado es el que vale.

/** "203.50" → 20350. Acepta enteros ("12") y 1 o 2 decimales. */
export function toCents(amount: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) throw new Error(`Monto inválido: ${amount}`);
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** 20350 → "203.50" */
export function fromCents(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`Centavos inválidos: ${cents}`);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

/** Suma montos en string: ["12.00", "8.50"] → "20.50" */
export function sumMoney(amounts: readonly string[]): string {
  return fromCents(amounts.reduce((total, a) => total + toCents(a), 0));
}

/**
 * Total de una línea como lo calcula el servidor (Docs/07 order_items):
 * (precio unitario + Σ modificadores y extras por unidad) × cantidad.
 */
export function lineTotal(unitPrice: string, deltas: readonly string[], quantity: number): string {
  const unit = toCents(unitPrice) + deltas.reduce((t, d) => t + toCents(d), 0);
  return fromCents(unit * quantity);
}
