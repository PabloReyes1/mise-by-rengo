// Contador con botones grandes para una mano (RNF-060): comensales, cantidad de un producto.
import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';

export interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}

export function Stepper({ label, value, onChange, min, max }: StepperProps) {
  const id = useId();
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  const button =
    'flex size-14 items-center justify-center rounded-md border border-secondary text-secondary ' +
    'hover:bg-surface disabled:cursor-not-allowed disabled:border-surface disabled:bg-surface disabled:text-accent';

  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-sm font-semibold">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex items-center gap-4">
        <button
          type="button"
          className={button}
          onClick={() => set(value - 1)}
          disabled={value <= min}
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
          disabled={value >= max}
          aria-label="Uno más"
        >
          <Plus aria-hidden className="size-6" />
        </button>
      </div>
    </div>
  );
}
