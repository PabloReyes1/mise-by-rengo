// Marco de las pantallas sin sesión: nombre del restaurante arriba y el contenido centrado.
import type { ReactNode } from 'react';
import { usePublicConfig } from '../../../core/config/index.js';

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { data } = usePublicConfig();
  return (
    <main className="flex min-h-dvh flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <p className="text-sm font-semibold text-secondary">{data?.tradeName ?? 'Mise'}</p>
      <section className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 py-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="text-base text-secondary">{description}</p>}
        </header>
        {children}
      </section>
    </main>
  );
}

/** Mensaje de error con ícono + texto primary (Docs/18 §4.1). */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border-2 border-error bg-background px-4 py-3 text-base">
      {message}
    </p>
  );
}
