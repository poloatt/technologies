/** Rutas base de cuentas y transacciones por rama Caja. */
export const BRANCH_CUENTAS_PATHS = {
  finanzas: '/finanzas/cuentas',
  propiedades: '/propiedades/cuentas',
  inventario: '/propiedades/inventario/cuentas',
};

export const BRANCH_TRANSACCIONES_PATHS = {
  finanzas: '/finanzas/transacciones',
  propiedades: '/propiedades/transacciones',
  inventario: '/propiedades/inventario/transacciones',
};

export const MONEDAS_PATH = '/finanzas/monedas';
export const CUENTAS_PATH = BRANCH_CUENTAS_PATHS.finanzas;

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

export function getCuentasPath(branchId = 'finanzas') {
  return BRANCH_CUENTAS_PATHS[branchId] || CUENTAS_PATH;
}

export function getTransaccionesPath(branchId = 'finanzas') {
  return BRANCH_TRANSACCIONES_PATHS[branchId] || '/finanzas/transacciones';
}

export function isCuentasRoute(pathname = '') {
  return Object.values(BRANCH_CUENTAS_PATHS).some(
    (path) => pathname === path || pathname.startsWith(`${path}?`)
  );
}

export function monedaDetailPath(monedaId) {
  return `${MONEDAS_PATH}?id=${monedaId}`;
}

export function cuentaDetailPath(cuentaId, branchId = 'finanzas') {
  return `${getCuentasPath(branchId)}?cuenta=${cuentaId}`;
}

export function transaccionesCuentaFilterPath(cuentaId, branchId = 'finanzas') {
  return `${getTransaccionesPath(branchId)}?cuenta=${cuentaId}`;
}
