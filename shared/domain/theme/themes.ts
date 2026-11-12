// Temas del producto (Docs/18 §2 y §8.4). Un tema = los 8 tokens. Viven en shared porque el
// frontend los aplica y el backend valida contra ellos el primary del cliente (Docs/18 §6).
import type { ThemeTokens } from './index.js';

const BOTANICAL_FUNCTIONAL = { success: '#38845B', warning: '#D69B3D', error: '#C65353' } as const;

export const BOTANICAL_GRAPHITE = {
  id: 'botanical-graphite',
  primary: '#243A35',
  secondary: '#526D61',
  accent: '#A5A58D',
  surface: '#E9E5D8',
  background: '#F8F7F2',
  ...BOTANICAL_FUNCTIONAL,
} as const satisfies ThemeTokens;

export const DEFAULT_THEME_ID = BOTANICAL_GRAPHITE.id;

/** Temas que el administrador puede elegir: todos pasan el validador de contraste. */
export const THEMES: Readonly<Record<string, ThemeTokens>> = {
  [BOTANICAL_GRAPHITE.id]: BOTANICAL_GRAPHITE,
  // Tema 3 (Docs/18 §8.4)
  'violeta-medianoche': {
    id: 'violeta-medianoche',
    primary: '#30011E',
    secondary: '#545454',
    accent: '#B68F40',
    surface: '#B6CCA1',
    background: '#D7FCD4',
    ...BOTANICAL_FUNCTIONAL,
  },
  // Tema 4 (Docs/18 §8.4)
  'uva-y-porcelana': {
    id: 'uva-y-porcelana',
    primary: '#3F4270',
    secondary: '#5B5F97',
    accent: '#B8B8D1',
    surface: '#ECECF4',
    background: '#FFFFFB',
    ...BOTANICAL_FUNCTIONAL,
    warning: '#FFC145',
  },
};

/**
 * Temas aprobados por RENGO (PA-053/054) que NO pasan todas las combinaciones de Docs/18 §4.1
 * (texto primary sobre accent y sobre warning). No se pueden elegir hasta resolver PA-057.
 */
export const THEMES_PENDING_REVIEW: Readonly<Record<string, ThemeTokens>> = {
  'piedra-y-rosa': {
    id: 'piedra-y-rosa',
    primary: '#5E5B52',
    secondary: '#A3245C',
    accent: '#F686BD',
    surface: '#BAD7F2',
    background: '#FFFBBD',
    ...BOTANICAL_FUNCTIONAL,
  },
  'carbon-y-oro': {
    id: 'carbon-y-oro',
    primary: '#423E37',
    secondary: '#6E675F',
    accent: '#A39594',
    surface: '#EDEBD7',
    background: '#F7F6EE',
    ...BOTANICAL_FUNCTIONAL,
    warning: '#E3B23C',
  },
  'cielo-de-medianoche': {
    id: 'cielo-de-medianoche',
    primary: '#1C5D99',
    secondary: '#222222',
    accent: '#639FAB',
    surface: '#E4ECF6',
    background: '#FFFFFF',
    ...BOTANICAL_FUNCTIONAL,
  },
};

/** Tema por id; un id desconocido o pendiente cae al tema por defecto. */
export function themeById(id: string): ThemeTokens {
  return THEMES[id] ?? BOTANICAL_GRAPHITE;
}
