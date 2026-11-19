// Tokens de un tema y validador de contraste (Docs/18 §4 y §8).
// Lo usan el frontend (prueba de todos los temas) y el backend (el primary que elige el cliente).

export const TOKEN_NAMES = [
  'primary',
  'secondary',
  'accent',
  'surface',
  'background',
  'success',
  'warning',
  'error',
] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];

export type ThemeTokens = { id: string } & Record<TokenName, string>;

/** Color usado en una regla: un token del tema o el blanco (solo para texto sobre fondos oscuros). */
type RuleColor = TokenName | 'white';

export interface ContrastRule {
  foreground: RuleColor;
  background: RuleColor;
  minimum: number;
  /** Dónde se usa la combinación (Docs/18 §4.1) */
  use: string;
}

export interface ContrastFailure extends ContrastRule {
  ratio: number;
}

const WHITE = '#FFFFFF';

/** Combinaciones permitidas de Docs/18 §4.1 que deben cumplir en todo tema. */
export const CONTRAST_RULES: readonly ContrastRule[] = [
  { foreground: 'white', background: 'primary', minimum: 4.5, use: 'Botón principal' },
  { foreground: 'primary', background: 'background', minimum: 4.5, use: 'Texto principal' },
  { foreground: 'primary', background: 'surface', minimum: 4.5, use: 'Texto en tarjetas' },
  {
    foreground: 'secondary',
    background: 'background',
    minimum: 4.5,
    use: 'Texto secundario, enlaces',
  },
  { foreground: 'white', background: 'secondary', minimum: 4.5, use: 'Botón secundario' },
  { foreground: 'primary', background: 'accent', minimum: 4.5, use: 'Etiqueta de accent' },
  { foreground: 'primary', background: 'warning', minimum: 4.5, use: 'Aviso' },
  { foreground: 'white', background: 'success', minimum: 4.5, use: 'Éxito' },
  // PA-049 a: texto blanco grande en negrita (≥ 18.66 px) → mínimo de texto grande
  { foreground: 'white', background: 'error', minimum: 3, use: 'Acción destructiva' },
];

/** Reglas que debe cumplir el primary que elige el cliente (Docs/18 §6). */
const PRIMARY_OVERRIDE_RULES = CONTRAST_RULES.slice(0, 3);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function channels(hex: string): [number, number, number] {
  if (!HEX.test(hex)) throw new Error(`No es un color hex válido: ${hex}`);
  const h = hex.slice(1);
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG entre dos colores (1 a 21). */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function check(theme: ThemeTokens, rules: readonly ContrastRule[]): ContrastFailure[] {
  const color = (c: RuleColor) => (c === 'white' ? WHITE : theme[c]);
  return rules
    .map((rule) => ({
      ...rule,
      ratio: contrastRatio(color(rule.foreground), color(rule.background)),
    }))
    .filter((r) => r.ratio < r.minimum);
}

/** Lista vacía = el tema se puede publicar. */
export function validateTheme(theme: ThemeTokens): ContrastFailure[] {
  return check(theme, CONTRAST_RULES);
}

/** Lista vacía = el primary del cliente se acepta. Lanza error si no es un color hex. */
export function validatePrimaryOverride(primary: string, theme: ThemeTokens): ContrastFailure[] {
  if (!HEX.test(primary)) throw new Error(`No es un color hex válido: ${primary}`);
  return check({ ...theme, primary }, PRIMARY_OVERRIDE_RULES);
}

export {
  BOTANICAL_GRAPHITE,
  DEFAULT_THEME_ID,
  THEMES,
  THEMES_PENDING_REVIEW,
  themeById,
} from './themes.js';
