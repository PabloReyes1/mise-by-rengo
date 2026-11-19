// Día de negocio (ADR-011): la fecha local de la sucursal, restando la hora de corte.
// Con corte 04:00, lo que se abre el sábado a las 01:30 cuenta para el viernes.

/** `now` en la zona horaria `timeZone`, menos `cutoff` (HH:MM) → "YYYY-MM-DD". */
export function businessDate(now: Date, timeZone: string, cutoff: string): string {
  const [hours = 0, minutes = 0] = cutoff.split(':').map(Number);
  const shifted = new Date(now.getTime() - (hours * 60 + minutes) * 60_000);
  // en-CA da el formato YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}
