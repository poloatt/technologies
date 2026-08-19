import { isFocoToolbarPath } from './tiempoToolbarPaths.js';

const CAJA_PATH_PREFIXES = ['/finanzas', '/propiedades'];
const PULSO_PATH_PREFIXES = ['/datacorporal', '/dieta', '/lab', '/salud'];

export function isCajaToolbarPath(path = '') {
  return CAJA_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function isPulsoToolbarPath(path = '') {
  return PULSO_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export { isFocoToolbarPath } from './tiempoToolbarPaths.js';

/** Rutas que usan barra superior unificada (sin header + toolbar legacy). */
export function isUnifiedToolbarPath(path = '') {
  return isFocoToolbarPath(path) || isCajaToolbarPath(path) || isPulsoToolbarPath(path);
}
