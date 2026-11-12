// Ruta inicial: decide a dónde ir según el dispositivo y la sesión (ADR-008).
import { Navigate } from 'react-router';
import { homePathFor, useDevice, useSession } from '../core/session/index.js';

export function StartRedirect() {
  const device = useDevice();
  const session = useSession();
  if (!device) return <Navigate to="/emparejar" replace />;
  if (!session) return <Navigate to="/entrar" replace />;
  return <Navigate to={homePathFor(device.type)} replace />;
}
