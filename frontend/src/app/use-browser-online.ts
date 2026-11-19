// Detección básica de conexión con el navegador (online/offline).
// core/offline (Pablito, H4) la reemplaza con el detector completo, que también reconoce "Inestable".
import { useSyncExternalStore } from 'react';
import type { ConnectionStatus } from '../core/ui/index.js';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useBrowserOnline(): ConnectionStatus {
  return useSyncExternalStore(
    subscribe,
    () => (navigator.onLine ? 'online' : 'offline'),
    () => 'online',
  );
}
