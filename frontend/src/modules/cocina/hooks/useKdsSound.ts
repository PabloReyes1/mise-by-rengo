// Sonido del KDS (Docs/05 paso 5; arreglo 4 de la demo de H2, doc 17 §5; SC-54).
// - Pedido nuevo: suena UNA vez (sonido "nuevo").
// - Recordatorio cada `reminderSec` (configurable en Restaurante › Cocina; 0 = nunca): suena UNA
//   vez, con el sonido del estado más crítico entre los pedidos sin terminar.
// - Un sonido distinto por estado: nuevo, por vencer, atrasado.
// El navegador no deja sonar sin un toque previo: por eso "Activar sonido".
import type { KdsOrder } from '@mise/shared/contracts/kitchen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { minutesSince, urgency, type KdsTiming } from './kds-timing.js';

export type KdsSoundKind = 'new' | 'warn' | 'late';

/** Notas de cada sonido: [frecuencia Hz, inicio s, duración s]. */
const PATTERNS: Record<KdsSoundKind, [number, number, number][]> = {
  // Campana suave que sube: llegó algo
  new: [
    [880, 0, 0.5],
    [1320, 0.18, 0.6],
  ],
  // Tres toques medios: va tarde
  warn: [
    [740, 0, 0.18],
    [740, 0.25, 0.18],
    [740, 0.5, 0.18],
  ],
  // Grave y repetido: atrasado
  late: [
    [440, 0, 0.25],
    [330, 0.3, 0.25],
    [440, 0.6, 0.25],
    [330, 0.9, 0.35],
  ],
};

function playPattern(ctx: AudioContext, kind: KdsSoundKind, volume: number) {
  const now = ctx.currentTime;
  for (const [freq, at, dur] of PATTERNS[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === 'late' ? 'square' : 'sine';
    osc.frequency.value = freq;
    const start = now + at;
    const peak = Math.max(0.0002, volume * (kind === 'late' ? 0.35 : 0.6));
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }
}

/** Lo más crítico entre los pedidos sin terminar; null si no hay nada pendiente. */
export function mostCritical(orders: KdsOrder[], now: number, t: KdsTiming): KdsSoundKind | null {
  let worst: KdsSoundKind | null = null;
  for (const o of orders) {
    if (o.status !== 'ENVIADO' && o.status !== 'EN_PREPARACION') continue;
    const u = urgency(minutesSince(o.sentAt, now), t);
    if (u === 'late') return 'late';
    if (u === 'warn') worst = 'warn';
    else if (!worst && o.status === 'ENVIADO') worst = 'new';
  }
  return worst;
}

export function useKdsSound(orders: KdsOrder[], timing: KdsTiming) {
  const ctxRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);
  const latest = useRef({ orders, timing });
  latest.current = { orders, timing };

  const play = useCallback((kind: KdsSoundKind) => {
    if (ctxRef.current?.state === 'running')
      playPattern(ctxRef.current, kind, latest.current.timing.volume);
  }, []);

  const enable = useCallback(() => {
    ctxRef.current ??= new AudioContext();
    void ctxRef.current.resume().then(() => {
      setEnabled(true);
      playPattern(ctxRef.current!, 'new', latest.current.timing.volume);
    });
  }, []);

  // Recordatorio: una vez cada reminderSec, con el sonido de lo más crítico
  useEffect(() => {
    if (!enabled || timing.reminderSec <= 0) return;
    const id = setInterval(() => {
      const kind = mostCritical(latest.current.orders, Date.now(), latest.current.timing);
      if (kind) play(kind);
    }, timing.reminderSec * 1000);
    return () => clearInterval(id);
  }, [enabled, timing.reminderSec, play]);

  return { enabled, enable, play };
}
