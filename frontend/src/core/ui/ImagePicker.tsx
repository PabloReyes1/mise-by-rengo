// Elegir una imagen sin obligar a buscar un archivo (Docs/18 §6b regla 3): pegar del portapapeles
// (Ctrl+V en cualquier parte de la pantalla o el botón "Pegar imagen"), arrastrar y soltar, o
// elegir un archivo. Siempre se comprime antes de entregarla (compressImage).
// Arreglo 3 de la demo de H2 (doc 17 §5), siguiendo a DENGO-POS: Ctrl+V escucha la ventana entera
// (antes solo con el recuadro enfocado), acepta imágenes copiadas como HTML y muestra la vista
// previa en cuanto se elige, sin esperar al servidor.
import { ClipboardPaste, ImageUp } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cx } from './cx.js';
import { compressImage, imageFromHtml, imageFromTransfer, isImage } from './image.js';

/** Igual que el servidor (ADR-009): más de esto ni se intenta. */
const MAX_BYTES = 10 * 1024 * 1024;

export interface ImagePickerProps {
  /** Recibe la imagen ya comprimida */
  onImage: (file: File) => void;
  /** Vista previa actual (foto del producto, logo) */
  preview?: ReactNode;
  label: string;
  busy?: boolean;
  /** Error de la subida, para mostrarlo junto al control */
  error?: string | null;
  /** Nombre base del archivo que se sube */
  name?: string;
}

/** El navegador deja leer el portapapeles con un botón (Chrome, Edge, Safari reciente). */
function canReadClipboard(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function';
}

export function ImagePicker({
  onImage,
  preview,
  label,
  busy,
  error,
  name = 'imagen',
}: ImagePickerProps) {
  const inputId = useId();
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  const take = useRef<(file: Blob | null) => Promise<void>>(async () => {});

  take.current = async (file) => {
    setMessage(null);
    if (!file || !isImage(file)) {
      setMessage('Eso no es una imagen. Usa JPG, PNG o WebP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage('La imagen pesa más de 10 MB. Usa una más liviana.');
      return;
    }
    const compressed = await compressImage(file, name);
    setLocal((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(compressed);
    });
    onImage(compressed);
  };

  // Ctrl+V en cualquier parte mientras el control está en pantalla (salvo al escribir texto)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = imageFromTransfer(e.clipboardData);
      if (file) {
        e.preventDefault();
        void take.current(file);
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      void imageFromHtml(e.clipboardData).then((blob) => {
        if (blob) void take.current(blob);
      });
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  useEffect(
    () => () => {
      if (local) URL.revokeObjectURL(local);
    },
    [local],
  );

  const pasteFromButton = async () => {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) return void (await take.current(await item.getType(type)));
      }
      setMessage('El portapapeles no tiene una imagen. Copia una foto y vuelve a intentar.');
    } catch {
      setMessage('El navegador no dejó leer el portapapeles. Prueba con Ctrl+V.');
    }
  };

  const shown = local ? (
    <img
      src={local}
      alt="Imagen elegida"
      width={96}
      height={96}
      className="size-24 rounded-md border border-accent object-cover"
    />
  ) : (
    preview
  );

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={label}
        aria-describedby={hintId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void take.current(imageFromTransfer(e.dataTransfer));
        }}
        className={cx(
          'flex flex-wrap items-center gap-4 rounded-md border-2 border-dashed p-3',
          dragging ? 'border-primary bg-surface' : 'border-accent',
        )}
      >
        {shown}
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
                void take.current(e.target.files?.[0] ?? null);
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
          También puedes pegarla con Ctrl+V o arrastrarla aquí. Se comprime antes de subir.
        </p>
      </div>
      {(message ?? error) && (
        <p role="alert" className="text-sm">
          {message ?? error}
        </p>
      )}
    </div>
  );
}
