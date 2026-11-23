// Tiempos y colores del KDS (Docs/05 paso 6, Docs/18 §5.2, RF-058). Dueño: Deniscito.
// Valores por defecto de client_settings.kds_thresholds y kds_sound (Docs/07); se podrán cambiar
// desde administración en H3 (SC-54).
import type { BadgeTone } from '../../../core/ui/index.js';

export const KDS_THRESHOLDS = { warnMin: 10, lateMin: 20 } as const;
/** Mientras haya pedidos sin aceptar, el sonido se repite cada N s (Docs/05 paso 5) */
export const KDS_SOUND_REPEAT_MS = 30_000;

export type Urgency = 'onTime' | 'warn' | 'late';

export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
}

export function urgency(minutes: number, t = KDS_THRESHOLDS): Urgency {
  if (minutes >= t.lateMin) return 'late';
  if (minutes >= t.warnMin) return 'warn';
  return 'onTime';
}

/** El estado nunca solo con color: siempre con texto (Docs/18). */
export const URGENCY: Record<Urgency, { label: string; tone: BadgeTone; bar: string }> = {
  onTime: { label: 'A tiempo', tone: 'success', bar: 'bg-success text-white' },
  // warning siempre con texto primary, nunca blanco (Docs/18)
  warn: { label: 'Por vencer', tone: 'warning', bar: 'bg-warning text-primary' },
  late: { label: 'Atrasado', tone: 'error', bar: 'bg-error text-white' },
};
