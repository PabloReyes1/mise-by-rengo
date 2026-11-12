import { Link } from 'react-router';

export function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <section className="flex max-w-sm flex-col gap-3">
        <h1 className="text-2xl font-bold">Esta página no existe</h1>
        <p className="text-base text-secondary">
          Revisa la dirección o vuelve al <Link to="/">inicio</Link>.
        </p>
      </section>
    </main>
  );
}
