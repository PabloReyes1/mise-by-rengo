// Configuración pública del cliente (GET /api/config/public): nombre, tema, moneda y zona horaria.
// Al llegar, aplica el tema (Docs/18 §8.1). Mientras carga se usan los valores de la plantilla.
// También las plantillas de ticket para imprimir (useTicketPrinter).
import type { DocType, PublicConfig, TicketTemplate } from '@mise/shared/contracts/config';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiFetch } from '../api/index.js';
import type { Regional } from '../format/index.js';
import {
  PLAIN_TICKET,
  printWithDialog,
  withTemplate,
  type PrintDocument,
  type TicketStyle,
} from '../print/index.js';
import { useDevice } from '../session/index.js';
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

/** Clave de las plantillas de ticket de una sucursal (la invalida Configuración › Tickets). */
export const ticketTemplatesKey = (branchId: string) => ['config', 'ticket-templates', branchId];

/** Plantillas de los impresos de la sucursal del dispositivo (encabezado, pie, logo, papel). */
export function useTicketTemplates() {
  const device = useDevice();
  const branchId = device?.branchId ?? '';
  return useQuery({
    queryKey: ticketTemplatesKey(branchId),
    queryFn: () => apiFetch<TicketTemplate[]>(`/branches/${branchId}/ticket-templates`),
    enabled: branchId !== '',
    staleTime: 5 * 60_000,
  });
}

/**
 * Imprime un documento con la plantilla de su tipo (Docs/11; H3 #21). Si la plantilla aún no
 * llegó (sin conexión la primera vez), imprime sin encabezado ni pie en 80 mm.
 */
export function useTicketPrinter(docType: DocType): (doc: PrintDocument) => Promise<void> {
  const templates = useTicketTemplates();
  const { data: config } = usePublicConfig();
  const t = templates.data?.find((x) => x.docType === docType);
  const style: TicketStyle = t
    ? { header: t.header, footer: t.footer, showLogo: t.showLogo, paperWidth: t.paperWidth }
    : PLAIN_TICKET;
  const logoUrl = config?.logoUrl ?? null;
  return (doc) => printWithDialog(withTemplate(doc, style, logoUrl), style.paperWidth);
}
