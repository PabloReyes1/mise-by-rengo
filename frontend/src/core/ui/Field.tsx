// Controles de formulario (Docs/18 §4.1): borde secondary (cumple 3:1 de componentes), texto primary,
// errores con ícono error + texto primary (el color nunca es la única señal).
import { CircleAlert } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cx } from './cx.js';

const CONTROL =
  'min-h-12 w-full rounded-md border border-secondary bg-background px-3 text-base text-primary ' +
  'placeholder:text-secondary disabled:cursor-not-allowed disabled:bg-surface disabled:text-accent ' +
  'aria-[invalid=true]:border-2 aria-[invalid=true]:border-error';

export interface FieldProps {
  label: string;
  /** Ayuda corta bajo el control */
  hint?: string | undefined;
  error?: string | undefined;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string | undefined;
}

export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-sm text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-error" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
}

export function TextInput({ label, hint, error, className, ...rest }: TextInputProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={CONTROL}
          {...rest}
        />
      )}
    </Field>
  );
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  options: { value: string; label: string }[];
}

export function Select({ label, hint, error, options, className, ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cx(CONTROL, 'appearance-auto')}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  disabled?: boolean;
}

/** Interruptor con el estado también en texto ("Sí"/"No"), no solo por la posición. */
export function Switch({ label, checked, onChange, hint, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex min-h-12 items-center justify-between gap-4">
      <div className="flex flex-col">
        <label htmlFor={id} className="text-base font-semibold">
          {label}
        </label>
        {hint && <span className="text-sm text-secondary">{hint}</span>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'flex h-8 w-16 shrink-0 items-center rounded-full border-2 px-0.5 transition-colors duration-150',
          checked ? 'border-primary bg-primary' : 'border-secondary bg-background',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span
          aria-hidden
          className={cx(
            'size-6 rounded-full transition-transform duration-150 ease-out',
            checked ? 'translate-x-8 bg-white' : 'bg-secondary',
          )}
        />
      </button>
    </div>
  );
}

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'error';

const BADGE: Record<BadgeTone, string> = {
  neutral: 'bg-accent text-primary',
  success: 'bg-success text-white',
  warning: 'bg-warning text-primary',
  // Blanco sobre error solo como texto grande: la etiqueta usa error de borde con texto primary
  error: 'border-2 border-error bg-background text-primary',
};

/** Etiqueta de estado: siempre con texto (Docs/18 §4.2). */
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-bold',
        BADGE[tone],
      )}
    >
      {children}
    </span>
  );
}
