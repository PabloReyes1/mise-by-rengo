// Lugar de un módulo que todavía no se construye (no simula pantallas que no existen).
import { Hammer } from 'lucide-react';
import type { DeviceArea } from './device-areas.js';

export function PendingModule({ area }: { area: DeviceArea }) {
  return (
    <section className="m-auto flex max-w-sm flex-col items-center gap-3 text-center">
      <Hammer aria-hidden className="size-8 text-secondary" />
      <h2 className="text-xl font-bold">{area.title}: en construcción</h2>
      <p className="text-base text-secondary">
        Esta área se construye en {area.milestone}. Responsable: {area.owner}.
      </p>
    </section>
  );
}
