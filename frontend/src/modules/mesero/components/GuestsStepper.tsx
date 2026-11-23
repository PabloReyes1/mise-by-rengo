// Número de comensales (1–99, Docs/05 paso 2) con botones grandes para una mano (RNF-060).
import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';

export const MIN_GUESTS = 1;
export const MAX_GUESTS = 99;

export function GuestsStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const set = (n: number) => onChange(Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, n)));
  const button =
    'flex size-14 items-center justify-center rounded-md border border-secondary text-secondary ' +
    'hover:bg-surface disabled:cursor-not-allowed disabled:border-surface disabled:bg-surface disabled:text-accent';

  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-sm font-semibold">
        Comensales
      </span>
      <div role="group" aria-labelledby={id} className="flex items-center gap-4">
        <button
          type="button"
          className={button}
          onClick={() => set(value - 1)}
          disabled={value <= MIN_GUESTS}
          aria-label="Uno menos"
        >
          <Minus aria-hidden className="size-6" />
        </button>
        <output aria-live="polite" className="min-w-12 text-center text-2xl font-bold tabular">
          {value}
        </output>
        <button
          type="button"
          className={button}
          onClick={() => set(value + 1)}
          disabled={value >= MAX_GUESTS}
          aria-label="Uno más"
        >
          <Plus aria-hidden className="size-6" />
        </button>
      </div>
    </div>
  );
}
