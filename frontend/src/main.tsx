// Arranque de la PWA.
import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.js';
import { applyTheme } from './styles/themes/apply-theme.js';
import { DEFAULT_THEME_ID } from './styles/themes/index.js';

// Hasta que exista config/public (módulo config, H1) se usa el tema por defecto
applyTheme(DEFAULT_THEME_ID);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
