// Teclado numérico táctil para montos (cobro, fondo, conteo) y PIN (login, autorización 🔑).
// Teclas de 64 px de alto; también acepta el teclado físico cuando tiene el foco.
import { Delete } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { cx } from './cx.js';
import { applyKey, type KeypadKey, type KeypadOptions } from './keypad.js';

export interface NumericKeypadProps extends KeypadOptions {
  value: string;
  onChange: (value: string) => void;
  /** Nombre accesible del valor, ej. "Monto recibido" o "PIN" */
  label: string;
  /** Símbolo antes del monto, ej. "Q" (viene de la configuración regional) */
  prefix?: string;
}

const DIGITS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function keyFromEvent(event: KeyboardEvent): KeypadKey | null {
  if (/^[0-9]$/.test(event.key)) return event.key as KeypadKey;
  if (event.key === '.' || event.key === ',') return '.';
  if (event.key === 'Backspace') return 'backspace';
  return null;
}

export function NumericKeypad({
  value,
  onChange,
  label,
  prefix,
  mode,
  maxLength,
}: NumericKeypadProps) {
  const press = (key: KeypadKey) => onChange(applyKey(value, key, { mode, maxLength }));

  const onKeyDown = (event: KeyboardEvent) => {
    const key = keyFromEvent(event);
    if (!key) return;
    event.preventDefault();
    press(key);
  };

  const keyClass =
    'flex h-16 items-center justify-center rounded-md bg-surface text-xl font-semibold tabular select-none ' +
    'transition-transform duration-100 ease-out hover:bg-accent/40 active:scale-[0.97] active:bg-accent/60';

  return (
    <div
      role="group"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-4 rounded-md"
    >
      {mode === 'code' ? (
        <output
          aria-label={label}
          className="flex justify-center gap-2 py-1 text-2xl font-bold tabular"
        >
          {Array.from({ length: maxLength }, (_, i) => (
            <span
              key={i}
              className={cx(
                'flex h-14 w-11 items-center justify-center rounded-md border bg-background',
                i === value.length ? 'border-2 border-primary' : 'border-secondary',
              )}
            >
              {value[i] ?? ''}
            </span>
          ))}
        </output>
      ) : mode === 'pin' ? (
        <div
          className="flex justify-center gap-4 py-2"
          aria-live="polite"
          aria-label={`${label}: ${value.length} de ${maxLength} dígitos`}
        >
          {Array.from({ length: maxLength }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className={cx(
                'size-4 rounded-full border-2 border-primary',
                i < value.length && 'bg-primary',
              )}
            />
          ))}
        </div>
      ) : (
        <output
          aria-label={label}
          className="flex min-h-16 items-baseline justify-end gap-2 rounded-md border border-secondary bg-background px-4 py-3 tabular"
        >
          {prefix && <span className="text-lg text-secondary">{prefix}</span>}
          <span className={cx('text-2xl font-bold', !value && 'text-secondary')}>
            {value || '0.00'}
          </span>
        </output>
      )}

      <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            tabIndex={-1}
            className={keyClass}
            onClick={() => press(digit)}
          >
            {digit}
          </button>
        ))}
        {mode === 'amount' ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Punto decimal"
            className={keyClass}
            onClick={() => press('.')}
          >
            .
          </button>
        ) : (
          <span aria-hidden />
        )}
        <button type="button" tabIndex={-1} className={keyClass} onClick={() => press('0')}>
          0
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Borrar"
          className={keyClass}
          onClick={() => press('backspace')}
        >
          <Delete aria-hidden className="size-6" />
        </button>
      </div>
    </div>
  );
}
