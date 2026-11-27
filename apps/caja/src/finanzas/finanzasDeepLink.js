/** Rutas base de transacciones por rama Caja. Cuentas, Monedas y Contactos son popups (ver useCajaSetup). */
export const BRANCH_TRANSACCIONES_PATHS = {
  finanzas: '/finanzas/transacciones',
  propiedades: '/propiedades/transacciones',
  inventario: '/propiedades/inventario/transacciones',
};

export const INVERSIONES_PATH = '/finanzas/inversiones';
export const DOLARES_PATH = '/finanzas/dolares';
export const CREDITOS_PATH = '/finanzas/creditos';

/** @typedef {'finanzas' | 'propiedades' | 'inventario'} FinanzasBranchId */

/**
 * Resuelve la rama activa según la URL actual.
 * @param {string} pathname
 * @returns {FinanzasBranchId}
 */
export function resolveFinanzasBranch(pathname = '') {
  if (pathname.startsWith('/propiedades/inventario')) return 'inventario';
  if (pathname.startsWith('/propiedades')) return 'propiedades';
  return 'finanzas';
}

export function getTransaccionesPath(branchId = 'finanzas') {
  return BRANCH_TRANSACCIONES_PATHS[branchId] || '/finanzas/transacciones';
}

export function transaccionesCuentaFilterPath(cuentaId, branchId = 'finanzas') {
  return `${getTransaccionesPath(branchId)}?cuenta=${cuentaId}`;
}

function withCuenta(path, cuentaId) {
  if (!cuentaId) return path;
  return `${path}?cuenta=${cuentaId}`;
}

/** Movimientos de dólares de una cuenta. */
export function dolaresCuentaPath(cuentaId) {
  return withCuenta(DOLARES_PATH, cuentaId);
}

/** Compras con tarjeta de una cuenta. */
export function creditosCuentaPath(cuentaId) {
  return withCuenta(CREDITOS_PATH, cuentaId);
}

/**
 * Libro de inversiones ya recortado al botón que se pulsó.
 * `vista` es reserve, invest o yield.
 */
export function inversionesVistaPath(vista, cuentaId) {
  const params = new URLSearchParams();
  if (vista) params.set('vista', vista);
  if (cuentaId) params.set('cuenta', cuentaId);
  const qs = params.toString();
  return qs ? `${INVERSIONES_PATH}?${qs}` : INVERSIONES_PATH;
}
