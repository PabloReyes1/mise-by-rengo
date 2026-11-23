// Tiempos y colores del KDS (Docs/05 paso 6, Docs/18 §5.2, RF-058). Dueño: Deniscito.
// Los umbrales y el recordatorio vienen de la configuración (Restaurante › Cocina, SC-54);
// estos son los valores por defecto del doc 07 mientras carga.
import type { KdsSettings } from '@mise/shared/contracts/config';
import { usePublicConfig } from '../../../core/config/index.js';
import type { BadgeTone } from '../../../core/ui/index.js';

export type KdsTiming = KdsSettings;

export const KDS_DEFAULTS: KdsTiming = { warnMin: 10, lateMin: 20, reminderSec: 120, volume: 0.8 };

export function useKdsTiming(): KdsTiming {
  return usePublicConfig().data?.kds ?? KDS_DEFAULTS;
}

export type Urgency = 'onTime' | 'warn' | 'late';

export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
}

export function urgency(
  minutes: number,
  t: Pick<KdsTiming, 'warnMin' | 'lateMin'> = KDS_DEFAULTS,
): Urgency {
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
