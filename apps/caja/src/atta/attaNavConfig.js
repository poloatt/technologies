/**
 * Re-exporta navegación Caja desde appNavResolver (sin evaluar en import).
 */
export {
  getCajaBranches,
  getCajaBranchPages,
  getFinanzasBranchPages,
  getPropiedadesBranchPages,
  getPropiedadesSectionPages,
  getInventarioSectionPages,
  getCajaBranchById,
  resolveCajaToolbarCenter,
  resolveCajaToolbarRight,
  isCajaPageActive,
  isCajaBranchActive,
} from '@shared/navigation/appNavResolver';

import {
  getCajaBranches,
  getFinanzasBranchPages,
  getPropiedadesBranchPages,
  getPropiedadesSectionPages,
  getInventarioSectionPages,
} from '@shared/navigation/appNavResolver';

export function getCajaBranchFinanzas() {
  return { id: 'finanzas', path: '/finanzas', label: 'Finanzas' };
}

export function getCajaBranchPropiedades() {
  return getPropiedadesSectionPages()[0] ?? null;
}

export function getCajaBranchInventario() {
  return getInventarioSectionPages()[0] ?? null;
}

export function getCajaFinanzasNav() {
  return getFinanzasBranchPages();
}

export function getCajaPropiedadesNav() {
  return getPropiedadesSectionPages();
}

export function getCajaInventarioNav() {
  return getInventarioSectionPages();
}
