// Contenedor base (Docs/18 §4.2). surface casi no se distingue del fondo (1.17:1), así que las
// tarjetas se separan con espacio; si el límite importa, llevan borde accent (decorativo) o
// secondary cuando delimitan un control interactivo.
import type { HTMLAttributes } from 'react';
import { cx } from './cx.js';

export type CardVariant = 'surface' | 'outlined';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const VARIANTS: Record<CardVariant, string> = {
  surface: 'bg-surface',
  outlined: 'bg-background border border-accent',
};

export function Card({ variant = 'surface', className, ...rest }: CardProps) {
  return <div className={cx('rounded-md p-4', VARIANTS[variant], className)} {...rest} />;
}
