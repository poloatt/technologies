import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Query param que indica qué popup de setup está abierto. */
export const SETUP_PARAM = 'setup';
/** Query param con el id de la cuenta abierta dentro del popup de Cuentas. */
export const SETUP_CUENTA_PARAM = 'setupCuenta';

/**
 * Arma el `To` que abre un popup de setup sobre la pantalla actual
 * (sin cambiar pathname, preservando otros params).
 * Usable en `navigate(...)` / `<Link to=...>` fuera del hook.
 * @param {string} setupId cuentas | monedas | contactos
 * @param {{ cuentaId?: string }} [options]
 */
export function buildSetupSearch(search = '', setupId, { cuentaId } = {}) {
  const params = new URLSearchParams(search);
  if (setupId) params.set(SETUP_PARAM, setupId);
  else params.delete(SETUP_PARAM);
  if (setupId && cuentaId) params.set(SETUP_CUENTA_PARAM, cuentaId);
  else params.delete(SETUP_CUENTA_PARAM);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Estado de los popups de setup (Cuentas / Monedas / Contactos) guardado en la URL.
 * - Cualquier pantalla (toolbar, hubs, mobile) puede abrirlos con `openSetup`.
 * - Hay deep link, sobrevive al refresh y "Atrás" cierra el popup / vuelve a la lista.
 * `state.setupDepth` cuenta las entradas de historial que empujamos nosotros, para cerrar
 * con `navigate(-n)` sin dejar el popup en el historial. Sin ese estado (deep link) se reemplaza.
 */
export function useCajaSetup() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname, search } = location;
  const depth = location.state?.setupDepth || 0;

  const { setupId, cuentaId } = useMemo(() => {
    const params = new URLSearchParams(search);
    return {
      setupId: params.get(SETUP_PARAM),
      cuentaId: params.get(SETUP_CUENTA_PARAM),
    };
  }, [search]);

  const openSetup = useCallback((id, { cuentaId: nextCuentaId } = {}) => {
    const nextDepth = id === setupId ? depth + 1 : 1;
    navigate(
      { pathname, search: buildSetupSearch(search, id, { cuentaId: nextCuentaId }) },
      { state: { setupDepth: nextDepth } },
    );
  }, [navigate, pathname, search, setupId, depth]);

  const closeSetup = useCallback(() => {
    if (depth > 0) {
      navigate(-depth);
      return;
    }
    navigate({ pathname, search: buildSetupSearch(search, null) }, { replace: true });
  }, [navigate, pathname, search, depth]);

  /** Vuelve de un detalle de cuenta a la lista, dentro del mismo popup. */
  const closeCuenta = useCallback(() => {
    if (depth > 1) {
      navigate(-1);
      return;
    }
    navigate(
      { pathname, search: buildSetupSearch(search, setupId) },
      { replace: true, state: { setupDepth: depth } },
    );
  }, [navigate, pathname, search, setupId, depth]);

  return { setupId, cuentaId, openSetup, closeSetup, closeCuenta };
}

export default useCajaSetup;
