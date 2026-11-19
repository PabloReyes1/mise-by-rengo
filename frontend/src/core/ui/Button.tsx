// Botón base (Docs/18 §4.1). Una sola acción `primary` por vista; las demás secondary u outline.
import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx.js';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** md = 48 px de alto, lg = 56 px (acciones principales en caja y mesero). Ambos ≥ 44 px (RNF-062) */
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary/90',
  secondary: 'bg-secondary text-white hover:bg-secondary/90',
  outline: 'bg-background text-secondary border border-secondary hover:bg-surface',
  // Blanco sobre error solo cumple como texto grande en negrita (PA-049 a): siempre 20 px bold
  danger: 'bg-error text-white text-lg! font-bold! hover:bg-error/90',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-12 px-4 text-base font-semibold gap-2',
  lg: 'min-h-14 px-6 text-lg font-bold gap-3',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <button
      type={type}
      disabled={inactive}
      aria-disabled={inactive || undefined}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex select-none items-center justify-center rounded-md leading-tight',
        'transition-transform duration-150 ease-out active:scale-[0.98]',
        SIZES[size],
        // Deshabilitado: surface + accent, cursor y aria-disabled (Docs/18 §4.1, nunca solo color)
        disabled
          ? 'cursor-not-allowed border-0 bg-surface text-accent active:scale-100'
          : VARIANTS[variant],
        loading && 'cursor-progress',
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <LoaderCircle aria-hidden className="size-5 shrink-0 animate-spin" />
      ) : (
        icon && (
          <span aria-hidden className="flex shrink-0 [&>svg]:size-5">
            {icon}
          </span>
        )
      )}
      <span>{children}</span>
    </button>
  );
}
