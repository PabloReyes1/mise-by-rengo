// Diálogo modal sobre <dialog> nativo: foco atrapado, Esc para cerrar y fondo inerte sin código extra.
// Usarlo solo cuando la tarea necesita interrumpir (confirmar un cobro, pedir un PIN 🔑).
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from './cx.js';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Texto corto bajo el título (qué pasa o qué se pide) */
  description?: string;
  children?: ReactNode;
  /** Botones de acción, alineados abajo */
  actions?: ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  className,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      className={cx(
        'm-auto overscroll-contain w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] rounded-md bg-background p-0 text-primary shadow-overlay',
        'opacity-0 translate-y-2 transition-[opacity,translate,display,overlay] transition-discrete duration-200 ease-out',
        'open:opacity-100 open:translate-y-0 starting:open:opacity-0 starting:open:translate-y-2',
        'backdrop:bg-primary/40 backdrop:transition-opacity backdrop:duration-200',
        className,
      )}
    >
      <div className="flex flex-col gap-6 p-6">
        <header className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-base text-secondary">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-m-2 flex size-12 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-surface"
          >
            <X aria-hidden className="size-6" />
          </button>
        </header>
        {children}
        {actions && <footer className="flex flex-wrap justify-end gap-3">{actions}</footer>}
      </div>
    </dialog>
  );
}
