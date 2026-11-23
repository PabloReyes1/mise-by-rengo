// Campos numéricos (Docs/18 §4.1 regla de campos numéricos).
// Regla: el campo guarda TEXTO mientras se escribe; nunca se convierte a número en cada tecla.
// Así se puede borrar todo y escribir otro valor (con Number("") el campo volvía a 0 y no se
// podía borrar). El número solo se entrega cuando el texto es válido; al salir del campo, si
// quedó vacío o fuera de rango, vuelve al último valor válido.
import { Minus, Plus } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { cx } from './cx.js';
import { Field } from './Field.js';

const CONTROL =
  'min-h-12 w-full rounded-md border border-secondary bg-background px-3 text-base text-primary tabular ' +
  'disabled:cursor-not-allowed disabled:bg-surface disabled:text-accent ' +
  'aria-[invalid=true]:border-2 aria-[invalid=true]:border-error';

/** Texto → entero dentro del rango, o null si todavía no es válido. */
export function parseIntInRange(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const n = Number(text.trim());
  return n >= min && n <= max ? n : null;
}

/** Texto del campo, sincronizado con el valor de afuera cuando este cambia. */
function useNumberText(value: number, min: number, max: number, onChange: (n: number) => void) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((t) => (parseIntInRange(t, min, max) === value ? t : String(value)));
  }, [value, min, max]);
  return {
    text,
    invalid: parseIntInRange(text, min, max) === null,
    change: (next: string) => {
      const clean = next.replace(/\D/g, '');
      setText(clean);
      const n = parseIntInRange(clean, min, max);
      if (n !== null && n !== value) onChange(n);
    },
    blur: () => {
      if (parseIntInRange(text, min, max) === null) setText(String(value));
    },
  };
}

export interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  hint?: string | undefined;
  /** Error de la regla de la pantalla (ej. mínimo mayor que el máximo) */
  error?: string | undefined;
  disabled?: boolean;
  className?: string | undefined;
}

/** Entero con teclado numérico en el celular. */
export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  hint,
  error,
  disabled,
  className,
}: NumberInputProps) {
  const field = useNumberText(value, min, max, onChange);
  return (
    <Field
      label={label}
      hint={hint}
      error={field.invalid && field.text !== '' ? `De ${min} a ${max}` : error}
      className={className}
    >
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={CONTROL}
          disabled={disabled}
          value={field.text}
          onChange={(e) => field.change(e.target.value)}
          onBlur={field.blur}
          onFocus={(e) => e.target.select()}
        />
      )}
    </Field>
  );
}

export interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
  /** Oculta la etiqueta visible (queda para el lector de pantalla) */
  hideLabel?: boolean;
}

/** − número + con botones de 56 px para una mano (RNF-060); el número también se escribe. */
export function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  disabled,
  hideLabel,
}: NumberStepperProps) {
  const id = useId();
  const field = useNumberText(value, min, max, onChange);
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  const button =
    'flex size-14 shrink-0 items-center justify-center rounded-md border border-secondary text-secondary ' +
    'hover:bg-surface disabled:cursor-not-allowed disabled:border-surface disabled:bg-surface disabled:text-accent';
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={cx('text-sm font-semibold', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={button}
          onClick={() => set(value - 1)}
          disabled={disabled || value <= min}
          aria-label={`${label}: uno menos`}
        >
          <Minus aria-hidden className="size-6" />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={field.invalid || undefined}
          className="h-14 w-16 rounded-md border border-secondary bg-background text-center text-2xl font-bold text-primary tabular aria-[invalid=true]:border-2 aria-[invalid=true]:border-error"
          disabled={disabled}
          value={field.text}
          onChange={(e) => field.change(e.target.value)}
          onBlur={field.blur}
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className={button}
          onClick={() => set(value + 1)}
          disabled={disabled || value >= max}
          aria-label={`${label}: uno más`}
        >
          <Plus aria-hidden className="size-6" />
        </button>
      </div>
    </div>
  );
}
