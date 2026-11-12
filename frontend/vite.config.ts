import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
// Ruta directa al archivo de temas: la configuración de Vite no lee shared como fuente
import { BOTANICAL_GRAPHITE as botanicalGraphite } from '../shared/domain/theme/themes.js';

// PWA única para todos los clientes (Docs/06 §3.4). La API va por URL relativa /api.
export default defineConfig({
  resolve: {
    // Lee @mise/shared desde el TypeScript fuente (Docs/19 §5)
    conditions: ['@mise/source'],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // La actualización la controla la app: no se actualiza con operaciones en la outbox (Docs/09)
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Mise by Rengo',
        short_name: 'Mise',
        description: 'Punto de venta para restaurantes',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        // Tokens del tema por defecto (Docs/18 §2)
        background_color: botanicalGraphite.background,
        // Igual al fondo de la barra superior, para que la barra del sistema no corte la app
        theme_color: botanicalGraphite.background,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // La API y el tiempo real nunca salen de la caché del service worker
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: {
    port: 5173,
    // En desarrollo, /api va al backend local (en producción lo hace Caddy)
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
});
