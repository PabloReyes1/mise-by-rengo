// Configuración › Restaurante (RF-001, RF-004, Docs/18 §6 y §8): datos, regional, apariencia y logo.
import type { Settings } from '@mise/shared/contracts/config';
import { THEMES, themeById, validatePrimaryOverride } from '@mise/shared/domain/theme';
import { Check, CircleAlert, ImageUp } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { Button, Card, cx, Select, Switch, TextInput } from '../../../core/ui/index.js';
import { useLicense, useSaveSettings, useSettings, useUploadLogo } from '../api/admin-api.js';

const THEME_NAMES: Record<string, string> = {
  'botanical-graphite': 'Botanical Graphite',
  'violeta-medianoche': 'Violeta medianoche',
  'uva-y-porcelana': 'Uva y porcelana',
};

const CHECK_LABELS: Record<string, string> = {
  'white/primary': 'Texto blanco sobre el color',
  'primary/background': 'El color sobre el fondo',
  'primary/surface': 'El color sobre las tarjetas',
};

type Draft = Omit<Settings, 'settingsVersion'>;

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-accent pt-6 lg:grid-cols-[16rem_1fr] lg:gap-8">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="text-sm text-secondary">{description}</p>}
      </header>
      <div className="flex max-w-2xl flex-col gap-4">{children}</div>
    </section>
  );
}

/** Revisión en vivo del color propio contra el tema (las mismas reglas que valida el servidor). */
function ContrastCheck({ color, themeId }: { color: string; themeId: string }) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return null;
  const theme = themeById(themeId);
  const failures = validatePrimaryOverride(color, theme);
  const failed = new Set(failures.map((f) => `${f.foreground}/${f.background}`));
  return (
    <ul className="flex flex-col gap-1 text-sm" aria-live="polite">
      {Object.entries(CHECK_LABELS).map(([key, label]) => (
        <li key={key} className="flex items-center gap-2">
          {failed.has(key) ? (
            <CircleAlert aria-hidden className="size-4 text-error" />
          ) : (
            <Check aria-hidden className="size-4 text-success" />
          )}
          <span>
            {label}: {failed.has(key) ? 'no se lee bien' : 'se lee bien'}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RestaurantPage() {
  const settings = useSettings();
  const license = useLicense();
  const save = useSaveSettings();
  const logo = useUploadLogo();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings.data) {
      const { settingsVersion: _v, ...rest } = settings.data;
      setDraft(rest);
    }
  }, [settings.data]);

  if (settings.isPending || !draft)
    return <p className="text-base text-secondary">Cargando configuración…</p>;
  if (settings.error) return <p role="alert">No se pudo cargar la configuración.</p>;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setSaved(false);
    setDraft({ ...draft, [key]: value });
  };
  const override = draft.colorPrimaryOverride;
  const overrideOk =
    !override ||
    (/^#[0-9A-Fa-f]{6}$/.test(override) &&
      validatePrimaryOverride(override, themeById(draft.themeId)).length === 0);
  const error =
    save.error instanceof ApiError ? save.error.message : save.error ? 'No se pudo guardar' : null;

  return (
    <form
      className="flex flex-col gap-6 pb-24"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(
          { ...draft, settingsVersion: settings.data.settingsVersion },
          { onSuccess: () => setSaved(true) },
        );
      }}
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Restaurante</h1>
        {license.data && (
          <p className="text-sm text-secondary">
            Licencia {license.data.plan} ·{' '}
            {license.data.status === 'ACTIVA'
              ? 'activa'
              : license.data.status.toLowerCase().replace('_', ' ')}
            {license.data.daysLeft !== null &&
              license.data.daysLeft <= 15 &&
              ` · vence en ${license.data.daysLeft} días`}
          </p>
        )}
      </header>

      <Section title="Datos del restaurante" description="Aparecen en la app y en los tickets.">
        <TextInput
          label="Nombre comercial"
          value={draft.tradeName}
          maxLength={120}
          onChange={(e) => set('tradeName', e.target.value)}
        />
        <TextInput
          label="Razón social"
          value={draft.legalName}
          maxLength={200}
          onChange={(e) => set('legalName', e.target.value)}
        />
        <TextInput
          label="NIT"
          value={draft.nit}
          maxLength={20}
          autoComplete="off"
          onChange={(e) => set('nit', e.target.value)}
        />
      </Section>

      <Section
        title="Regional"
        description="Moneda, idioma y hora con que se muestran montos y fechas."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput
            label="Moneda"
            hint="Código ISO, ej. GTQ"
            value={draft.currencyCode}
            maxLength={3}
            onChange={(e) => set('currencyCode', e.target.value.toUpperCase())}
          />
          <TextInput
            label="Símbolo"
            value={draft.currencySymbol}
            maxLength={5}
            onChange={(e) => set('currencySymbol', e.target.value)}
          />
          <Select
            label="Decimales"
            value={String(draft.decimals)}
            options={['0', '1', '2'].map((v) => ({ value: v, label: v }))}
            onChange={(e) => set('decimals', Number(e.target.value))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Zona horaria"
            hint="Ej. America/Guatemala"
            value={draft.timezone}
            onChange={(e) => set('timezone', e.target.value)}
          />
          <TextInput
            label="Idioma y formato"
            hint="Ej. es-GT"
            value={draft.locale}
            onChange={(e) => set('locale', e.target.value)}
          />
        </div>
        <TextInput
          label="Cierre del día de negocio"
          hint="Las ventas antes de esta hora cuentan para el día anterior (para quienes cierran después de medianoche)"
          type="time"
          value={draft.businessDayCutoff}
          onChange={(e) => set('businessDayCutoff', e.target.value)}
          className="sm:max-w-xs"
        />
      </Section>

      <Section
        title="Apariencia"
        description="El tema cambia los colores de toda la app. Solo el color principal se puede personalizar."
      >
        <div role="radiogroup" aria-label="Tema" className="grid gap-3 sm:grid-cols-3">
          {Object.values(THEMES).map((theme) => (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={draft.themeId === theme.id}
              onClick={() => set('themeId', theme.id)}
              className={cx(
                'flex flex-col gap-3 rounded-md border p-3 text-left',
                draft.themeId === theme.id
                  ? 'border-2 border-primary bg-surface'
                  : 'border-secondary hover:bg-surface',
              )}
            >
              <span className="flex gap-1" aria-hidden>
                {(['primary', 'secondary', 'accent', 'surface', 'background'] as const).map((t) => (
                  <span
                    key={t}
                    className="size-6 rounded-sm border border-accent"
                    style={{ backgroundColor: theme[t] }}
                  />
                ))}
              </span>
              <span className="text-base font-semibold">{THEME_NAMES[theme.id] ?? theme.id}</span>
            </button>
          ))}
        </div>
        <Switch
          label="Color principal propio"
          hint="Por ejemplo, el color de la marca del restaurante"
          checked={override !== null}
          onChange={(on) =>
            set('colorPrimaryOverride', on ? themeById(draft.themeId).primary : null)
          }
        />
        {override !== null && (
          <Card variant="outlined" className="flex flex-col gap-3">
            <div className="flex items-end gap-3">
              <input
                type="color"
                aria-label="Elegir color"
                value={
                  /^#[0-9A-Fa-f]{6}$/.test(override) ? override : themeById(draft.themeId).primary
                }
                onChange={(e) => set('colorPrimaryOverride', e.target.value.toUpperCase())}
                className="h-12 w-14 shrink-0 cursor-pointer rounded-md border border-secondary bg-background"
              />
              <TextInput
                label="Color (hex)"
                value={override}
                maxLength={7}
                onChange={(e) => set('colorPrimaryOverride', e.target.value)}
                className="flex-1"
              />
            </div>
            <ContrastCheck color={override} themeId={draft.themeId} />
          </Card>
        )}
      </Section>

      <Section
        title="Logo"
        description="Se muestra en la app y en los tickets. Se ajusta solo a máximo 800 px."
      >
        <label className="inline-flex min-h-12 w-fit cursor-pointer items-center gap-2 rounded-md border border-secondary px-4 text-base font-semibold text-secondary hover:bg-surface">
          <ImageUp aria-hidden className="size-5" />
          {logo.isPending ? 'Subiendo…' : 'Subir logo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) logo.mutate(file);
            }}
          />
        </label>
        {logo.isSuccess && <p className="text-sm">Logo actualizado.</p>}
        {logo.error && (
          <p role="alert" className="text-sm">
            {logo.error instanceof ApiError ? logo.error.message : 'No se pudo subir el logo'}
          </p>
        )}
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-accent bg-background px-4 py-3">
        {error && (
          <p role="alert" className="mr-auto text-base">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="mr-auto text-base" aria-live="polite">
            Cambios guardados.
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          loading={save.isPending}
          disabled={!overrideOk || !draft.tradeName.trim()}
        >
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
