// Moneda, fechas y zona horaria (RNF-070). Nada fijo: los valores regionales vienen de config/public.

export interface Regional {
  /** Ej. 'es-GT' */
  locale: string;
  /** Código ISO 4217, ej. 'GTQ' */
  currency: string;
  /** Zona de la sucursal, ej. 'America/Guatemala' */
  timeZone: string;
}

/**
 * Formatea un monto que llega de la API como string decimal ("203.50").
 * Intl recibe el string tal cual, así no pasa por coma flotante.
 */
export function formatMoney(amount: string, regional: Regional): string {
  return new Intl.NumberFormat(regional.locale, {
    style: 'currency',
    currency: regional.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount as `${number}`);
}

/** Hora local de la sucursal (las fechas se guardan en UTC). */
export function formatTime(iso: string, regional: Regional): string {
  return new Intl.DateTimeFormat(regional.locale, {
    timeZone: regional.timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Fecha y hora local de la sucursal. */
export function formatDateTime(iso: string, regional: Regional): string {
  return new Intl.DateTimeFormat(regional.locale, {
    timeZone: regional.timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/** "58" o "58,5" → "58.50"; null si no es un monto válido (lo que escribe la persona). */
export function toMoney(input: string): string | null {
  const value = input.trim().replace(',', '.');
  if (!/^\d{1,10}(\.\d{0,2})?$/.test(value)) return null;
  const [int, dec = ''] = value.split('.');
  return `${Number(int)}.${dec.padEnd(2, '0')}`;
}
