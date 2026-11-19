// Aplica el tema que devuelve config/public (Docs/18 §8.1): data-theme en <html> y variables CSS.
// Los componentes solo usan los tokens (var(--color-*)): ninguno sabe qué tema está activo.
import { TOKEN_NAMES, validatePrimaryOverride } from '@mise/shared/domain/theme';
import { DEFAULT_THEME_ID, THEMES } from './index.js';

export function applyTheme(themeId: string, primaryOverride?: string | null): void {
  const theme = THEMES[themeId] ?? THEMES[DEFAULT_THEME_ID]!;
  const root = document.documentElement;

  root.dataset['theme'] = theme.id;
  for (const token of TOKEN_NAMES) {
    root.style.setProperty(`--color-${token}`, theme[token]);
  }

  // El backend ya valida el primary del cliente; si aun así no cumple, se queda el del tema
  if (primaryOverride) {
    try {
      if (validatePrimaryOverride(primaryOverride, theme).length === 0) {
        root.style.setProperty('--color-primary', primaryOverride);
      }
    } catch {
      // Valor que no es un color: se ignora
    }
  }
}
