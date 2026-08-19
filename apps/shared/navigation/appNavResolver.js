/**
 * Navegación derivada de menuStructure.js
 *
 * Niveles Caja (assets):
 * - app: Caja (assets)
 * - branch: Finanzas (hub único; Propiedades e Inventario son secciones in-page)
 * - page: Transacciones, Cuentas, Propiedades… (nivel 2)
 *
 * Foco/Pulso: subItems del módulo = páginas planas (sin rama intermedia).
 */

import { modulos, bottomNavigationItems } from './menuStructure';
import { getTiempoBottomNavItems } from './tiempoNavConfig';
import {
  findActiveModule,
  findActiveLevel1,
  getCurrentAppKey,
  getLevel2Children,
} from '../utils/navigationUtils';

/** @typedef {'branch' | 'page' | 'section'} NavLevel */

/**
 * @param {object} item - Nodo de menuStructure
 * @param {NavLevel} navLevel
 * @param {string|null} branchId
 */
function toNavItem(item, navLevel, branchId = null) {
  if (!item?.path) return null;
  return {
    id: item.id,
    path: item.path,
    label: item.title,
    iconKey: item.icon,
    navLevel,
    branchId,
    isUnderConstruction: !!item.isUnderConstruction,
    isBranchSwitcher: navLevel === 'branch',
  };
}

function getAssetsModule() {
  return modulos.find((m) => m.id === 'assets') || null;
}

/** Caja: ramas virtuales Finanzas | Propiedades | Inventario (toolbar derecha desktop). */
export function getCajaBranches() {
  const finanzas = getFinanzasBranch();
  const propiedades = getPropiedadesSectionNode();
  const inventario = getInventarioSectionNode();

  return [
    finanzas && toNavItem(finanzas, 'branch'),
    propiedades && toNavItem(propiedades, 'branch'),
    inventario && toNavItem(inventario, 'branch'),
  ].filter(Boolean);
}

function getFinanzasBranch() {
  return getAssetsModule()?.subItems?.find((s) => s.id === 'finanzas') || null;
}

function getPropiedadesSectionNode() {
  return getFinanzasBranch()?.subItems?.find((s) => s.id === 'propiedades') || null;
}

function getInventarioSectionNode() {
  return getFinanzasBranch()?.subItems?.find((s) => s.id === 'inventario') || null;
}

/** Páginas del hub Propiedades (/propiedades): sección + contratos + inquilinos. */
export function getPropiedadesSectionPages() {
  const section = getPropiedadesSectionNode();
  if (!section) return [];
  const pages = [section, ...(section.subItems || [])];
  return pages.map((page) => toNavItem(page, 'page', 'propiedades')).filter(Boolean);
}

/** Páginas del hub Inventario (/propiedades/inventario). */
export function getInventarioSectionPages() {
  const section = getInventarioSectionNode();
  if (!section) return [];
  const pages = [section, ...(section.subItems || [])];
  return pages.map((page) => toNavItem(page, 'page', 'inventario')).filter(Boolean);
}

/** Subpáginas de una rama Caja (todas las del menú, incl. en construcción). */
export function getCajaBranchPages(branchId) {
  if (branchId === 'propiedades') {
    return getPropiedadesSectionPages();
  }
  if (branchId === 'inventario') {
    return getInventarioSectionPages();
  }

  const assets = getAssetsModule();
  const branch = assets?.subItems?.find((s) => s.id === branchId);
  if (!branch?.subItems) return [];

  return branch.subItems
    .map((page) => toNavItem(page, 'page', branchId))
    .filter(Boolean);
}

/** Subpáginas Finanzas: solo hub / cards in-page, no en toolbar ni strip contextual. */
export const FINANZAS_TOOLBAR_EXCLUDE_PAGE_IDS = [
  'transacciones',
  'cuentas',
  'monedas',
  'recurrente',
  'inversiones',
  'deudores',
  'propiedades',
  'inventario',
];

/**
 * Páginas Finanzas para toolbar centro y strip en subpáginas.
 * Excluye secciones con hub cards (navegación in-page).
 */
export function getFinanzasBranchPages() {
  const exclude = new Set(FINANZAS_TOOLBAR_EXCLUDE_PAGE_IDS);
  return getCajaBranchPages('finanzas').filter((page) => !exclude.has(page.id));
}

/** Subpáginas Propiedades ocultas en hub/strip (finanzas duplicadas). */
export const PROPIEDADES_HUB_STRIP_EXCLUDE_PAGE_IDS = [
  'cuentas',
  'transacciones',
];

/** Subpáginas Inventario ocultas en hub/strip. */
export const INVENTARIO_HUB_STRIP_EXCLUDE_PAGE_IDS = [
  'inventario-en-propiedades',
  'vehiculos',
  'inventario-sin-ubicacion',
  'cuentas',
  'transacciones',
];

/** Páginas Propiedades para strip in-page: propiedades, inquilinos, contratos. */
export function getPropiedadesBranchPages() {
  const exclude = new Set(PROPIEDADES_HUB_STRIP_EXCLUDE_PAGE_IDS);
  return getCajaBranchPages('propiedades').filter((page) => !exclude.has(page.id));
}

/** Páginas Inventario para strip in-page: solo la sección principal. */
export function getInventarioBranchPages() {
  const exclude = new Set(INVENTARIO_HUB_STRIP_EXCLUDE_PAGE_IDS);
  return getCajaBranchPages('inventario').filter((page) => !exclude.has(page.id));
}

export function getCajaBranchById(branchId) {
  return getCajaBranches().find((b) => b.id === branchId) || null;
}

/**
 * Ítems para bottom nav móvil.
 * - Foco: páginas hijas (Rutinas, Objetivos, Tareas).
 * - Caja/Pulso: switcher de las 3 apps → hub de cada una.
 */
export function resolveBottomNavItems(appKey = getCurrentAppKey()) {
  if (appKey === 'foco') {
    return getTiempoBottomNavItems();
  }

  return bottomNavigationItems.map((app) => ({
    id: app.id,
    path: app.path,
    label: app.title,
    iconKey: app.icon,
    navLevel: 'app',
    appKey: app.appKey,
    activePaths: app.activePaths,
  }));
}

/** Toolbar derecha Caja (desktop): Finanzas | Propiedades | Inventario. */
export function resolveCajaToolbarRight(currentPath) {
  const moduloActivo = findActiveModule(currentPath);
  if (moduloActivo?.id !== 'assets') {
    return { branches: [], activeBranchId: null };
  }

  const branches = getCajaBranches();
  let activeBranchId = 'finanzas';

  if (isInventarioBranchRoute(currentPath)) {
    activeBranchId = 'inventario';
  } else if (
    currentPath === '/propiedades'
    || (currentPath.startsWith('/propiedades/') && !isInventarioBranchRoute(currentPath))
  ) {
    activeBranchId = 'propiedades';
  }

  return { branches, activeBranchId };
}

/**
 * Si la ruta está en una page con subItems (p. ej. transacciones → recurrentes),
 * devuelve navegación contextual [page, ...subpages]; si no, todas las pages de la rama.
 */
function resolveCajaBranchToolbarPages(currentPath, branchId) {
  if (branchId === 'finanzas') {
    return getFinanzasBranchPages();
  }

  // Propiedades e Inventario: navegación in-page (hub/strip), sin tabs en toolbar centro.
  if (branchId === 'propiedades' || branchId === 'inventario') {
    return [];
  }

  const assets = getAssetsModule();
  const branch = assets?.subItems?.find((s) => s.id === branchId);
  if (!branch?.subItems) return [];

  for (const page of branch.subItems) {
    if (!page.subItems?.length) continue;
    const onParent = isPathActive(currentPath, page.path);
    const onChild = page.subItems.some((sub) => isPathActive(currentPath, sub.path));
    if (onParent || onChild) {
      return [
        toNavItem(page, 'page', branchId),
        ...page.subItems.map((sub) => toNavItem(sub, 'page', branchId)),
      ].filter(Boolean);
    }
  }

  return getCajaBranchPages(branchId);
}

/** Toolbar centro Caja (móvil y desktop): subpáginas de la sección activa. */
export function resolveCajaToolbarCenter(currentPath) {
  const moduloActivo = findActiveModule(currentPath);
  if (moduloActivo?.id !== 'assets') return [];

  if (isInventarioBranchRoute(currentPath)) {
    return resolveCajaBranchToolbarPages(currentPath, 'inventario');
  }
  if (
    currentPath === '/propiedades'
    || (currentPath.startsWith('/propiedades/') && !isInventarioBranchRoute(currentPath))
  ) {
    return resolveCajaBranchToolbarPages(currentPath, 'propiedades');
  }
  return resolveCajaBranchToolbarPages(currentPath, 'finanzas');
}

function isInventarioBranchRoute(pathname) {
  return (
    pathname === '/propiedades/inventario'
    || pathname.startsWith('/propiedades/inventario/')
    || pathname === '/propiedades/autos'
    || pathname.startsWith('/propiedades/autos/')
  );
}

export function isCajaPageActive(pathname, page) {
  if (!page) return false;
  if (page.id === 'finanzas') {
    return pathname === '/finanzas';
  }
  if (page.id === 'propiedades') {
    if (isInventarioBranchRoute(pathname)) {
      return false;
    }
    return pathname === '/propiedades' || pathname.startsWith('/propiedades/habitaciones');
  }
  if (page.id === 'inventario') {
    return isInventarioBranchRoute(pathname);
  }
  if (
    page.id === 'inventario-en-propiedades'
    || page.id === 'inventario-sin-ubicacion'
  ) {
    return isPathActive(pathname, page.path);
  }
  if (page.id === 'vehiculos') {
    return (
      pathname === '/propiedades/autos'
      || pathname.startsWith('/propiedades/autos/')
    );
  }
  return isPathActive(pathname, page.path);
}

export function isPathActive(pathname, path) {
  if (!path) return false;
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Secciones planas (Foco, Pulso): subItems del módulo. */
export function resolveFlatModulePages(moduleId) {
  const modulo = modulos.find((m) => m.id === moduleId);
  return (modulo?.subItems || [])
    .filter((item) => !item.isUnderConstruction)
    .map((item) => toNavItem(item, 'section'))
    .filter(Boolean);
}

/** Mapa id → { path, label, iconKey } para toolbars (Foco). */
export function resolveFlatModulePagesMap(moduleId) {
  return Object.fromEntries(
    resolveFlatModulePages(moduleId).map((t) => [
      t.id,
      { path: t.path, label: t.label, iconKey: t.iconKey },
    ]),
  );
}

/**
 * Hub Caja para botón «atrás» en subpáginas.
 * Finanzas → /finanzas; Propiedades → /finanzas; Inventario → /finanzas.
 */
export function resolveCajaBranchHubPath(pathname) {
  if (pathname === '/finanzas' || pathname.startsWith('/finanzas/')) {
    return pathname === '/finanzas' ? null : '/finanzas';
  }
  if (pathname === '/propiedades/inventario') {
    return '/finanzas';
  }
  if (isInventarioBranchRoute(pathname) && pathname !== '/propiedades/inventario') {
    return '/propiedades/inventario';
  }
  if (pathname === '/propiedades') {
    return '/finanzas';
  }
  if (pathname.startsWith('/propiedades/')) {
    return '/propiedades';
  }
  return null;
}

/** Etiqueta del hub de rama (tooltip del botón atrás). */
export function resolveCajaBranchHubLabel(pathname) {
  const hubPath = resolveCajaBranchHubPath(pathname);
  if (!hubPath) return null;
  if (hubPath === '/finanzas') return 'Finanzas';
  if (hubPath === '/propiedades') return 'Propiedades';
  if (hubPath === '/propiedades/inventario') return 'Inventario';
  return 'Volver';
}

export function isCajaBranchActive(pathname, branch) {
  if (!branch) return false;
  if (branch.id === 'finanzas') {
    return pathname === '/finanzas' || pathname.startsWith('/finanzas/');
  }
  if (branch.id === 'propiedades') {
    if (isInventarioBranchRoute(pathname)) {
      return false;
    }
    return pathname === '/propiedades' || pathname.startsWith('/propiedades/');
  }
  if (branch.id === 'inventario') {
    return isInventarioBranchRoute(pathname);
  }
  return isPathActive(pathname, branch.path);
}
