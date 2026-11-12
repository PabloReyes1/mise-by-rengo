// Configuración pública del cliente (GET /api/config/public): nombre, tema, moneda y zona horaria.
// Al llegar, aplica el tema (Docs/18 §8.1). Mientras carga se usan los valores de la plantilla.
import type { PublicConfig } from '@mise/shared/contracts/config';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiFetch } from '../api/index.js';
import type { Regional } from '../format/index.js';
import { applyTheme } from '../../styles/themes/apply-theme.js';

export const PUBLIC_CONFIG_KEY = ['config', 'public'] as const;

const FALLBACK_REGIONAL: Regional = {
  locale: 'es-GT',
  currency: 'GTQ',
  timeZone: 'America/Guatemala',
};

export function usePublicConfig() {
  const query = useQuery({
    queryKey: PUBLIC_CONFIG_KEY,
    queryFn: () => apiFetch<PublicConfig>('/config/public'),
    staleTime: 5 * 60_000,
  });
  const data = query.data;
  useEffect(() => {
    if (data) applyTheme(data.themeId, data.colorPrimaryOverride);
  }, [data]);
  return query;
}

/** Moneda, idioma y zona horaria para formatear montos y horas. */
export function useRegional(): Regional {
  const { data } = usePublicConfig();
  if (!data) return FALLBACK_REGIONAL;
  return { locale: data.locale, currency: data.currency, timeZone: data.timeZone };
}
