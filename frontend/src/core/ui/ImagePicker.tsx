// Elegir una imagen sin obligar a buscar un archivo (Docs/18 §6b regla 3): se puede pegar del
// portapapeles (Ctrl+V o el botón "Pegar"), arrastrar y soltar, o elegir un archivo. Siempre se
// comprime antes de entregarla (compressImage).
import { ClipboardPaste, ImageUp } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cx } from './cx.js';
import { compressImage, imageFromTransfer, isImage } from './image.js';

export interface ImagePickerProps {
  /** Recibe la imagen ya comprimida */
  onImage: (file: File) => void;
  /** Vista previa actual (foto del producto, logo) */
  preview?: ReactNode;
  label: string;
  busy?: boolean;
  /** Nombre base del archivo que se sube */
  name?: string;
}

/** El navegador deja leer el portapapeles con un botón (Chrome, Edge, Safari reciente). */
function canReadClipboard(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function';
}

export function ImagePicker({ onImage, preview, label, busy, name = 'imagen' }: ImagePickerProps) {
  const inputId = useId();
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const take = async (file: Blob | null) => {
    setMessage(null);
    if (!file || !isImage(file)) {
      setMessage('Eso no es una imagen. Usa JPG, PNG o WebP.');
      return;
    }
    onImage(await compressImage(file, name));
  };

  const pasteFromButton = async () => {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) return void (await take(await item.getType(type)));
      }
      setMessage('El portapapeles no tiene una imagen. Copia una foto y vuelve a intentar.');
    } catch {
      setMessage('El navegador no dejó leer el portapapeles. Prueba con Ctrl+V aquí.');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        // Zona que acepta pegar (al tener el foco) y soltar archivos
        tabIndex={0}
        role="group"
        aria-label={label}
        aria-describedby={hintId}
        onPaste={(e) => {
          const file = imageFromTransfer(e.clipboardData);
          if (file) {
            e.preventDefault();
            void take(file);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void take(imageFromTransfer(e.dataTransfer));
        }}
        className={cx(
          'flex flex-wrap items-center gap-4 rounded-md border-2 border-dashed p-3 outline-none focus-visible:border-primary',
          dragging ? 'border-primary bg-surface' : 'border-accent',
        )}
      >
        {preview}
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor={inputId}
            className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-md border border-secondary px-4 text-base font-semibold text-secondary hover:bg-surface"
          >
            <ImageUp aria-hidden className="size-5" />
            {busy ? 'Subiendo…' : 'Elegir archivo'}
            <input
              id={inputId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                void take(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </label>
          {canReadClipboard() && (
            <button
              type="button"
              onClick={() => void pasteFromButton()}
              className="inline-flex min-h-12 items-center gap-2 rounded-md border border-secondary px-4 text-base font-semibold text-secondary hover:bg-surface"
            >
              <ClipboardPaste aria-hidden className="size-5" />
              Pegar imagen
            </button>
          )}
        </div>
        <p id={hintId} className="w-full text-sm text-secondary">
          También puedes pegarla con Ctrl+V aquí o arrastrarla. Se comprime antes de subir.
        </p>
      </div>
      {message && (
        <p role="alert" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
