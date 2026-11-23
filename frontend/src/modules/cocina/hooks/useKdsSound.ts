// Sonido del KDS (Docs/05 paso 5): suena al llegar un pedido y se repite cada 30 s mientras haya
// pedidos sin aceptar. El navegador no deja sonar sin un toque previo: por eso "Activar sonido".
import { useCallback, useEffect, useRef, useState } from 'react';
import { KDS_SOUND_REPEAT_MS } from './kds-timing.js';

/** Campana corta con Web Audio (sin archivos de sonido). */
function bell(ctx: AudioContext) {
  const now = ctx.currentTime;
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.18;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.6, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.65);
  }
}

export function useKdsSound(pendingCount: number) {
  const ctxRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);

  const play = useCallback(() => {
    if (ctxRef.current?.state === 'running') bell(ctxRef.current);
  }, []);

  const enable = useCallback(() => {
    ctxRef.current ??= new AudioContext();
    void ctxRef.current.resume().then(() => {
      setEnabled(true);
      bell(ctxRef.current!);
    });
  }, []);

  // Recordatorio mientras haya pedidos sin aceptar
  useEffect(() => {
    if (!enabled || pendingCount === 0) return;
    const id = setInterval(play, KDS_SOUND_REPEAT_MS);
    return () => clearInterval(id);
  }, [enabled, pendingCount, play]);

  return { enabled, enable, play };
}
