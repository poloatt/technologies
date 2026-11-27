import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { SETUP_CUENTA_PARAM, SETUP_PARAM } from './useCajaSetup';

/**
 * Las páginas /cuentas, /monedas y /contactos ya no existen: ahora son popups.
 * Redirige las URLs viejas (marcadores, links externos) al hub con el popup abierto.
 * `?cuenta=ID` (detalle de cuenta) se traduce a `setupCuenta`.
 */
export default function LegacySetupRedirect({ setup, to }) {
  const { search } = useLocation();
  const legacy = new URLSearchParams(search);
  const params = new URLSearchParams();
  params.set(SETUP_PARAM, setup);
  const cuenta = legacy.get('cuenta');
  if (setup === 'cuentas' && cuenta) params.set(SETUP_CUENTA_PARAM, cuenta);
  return <Navigate to={{ pathname: to, search: `?${params.toString()}` }} replace />;
}
