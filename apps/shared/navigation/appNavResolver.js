/**
 * Navegación derivada de menuStructure.js
 *
 * Niveles Caja (assets):
 * - app: Caja (assets)
 * - branch: Finanzas, Propiedades e Inventario (hermanas)
 * - page: destinos de la rama activa (toolbar centro y footer)
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

/** Caja: ramas Finanzas | Propiedades | Inventario (toolbar derecha desktop). */
export function getCajaBranches() {
  return (getAssetsModule()?.subItems || [])
    .map((branch) => toNavItem(branch, 'branch'))
    .filter(Boolean);
}

function getCajaBranchNode(branchId) {
  return getAssetsModule()?.subItems?.find((s) => s.id === branchId) || null;
}

function pagesForBranch(branchId, { includeSelf = false } = {}) {
  const branch = getCajaBranchNode(branchId);
  if (!branch) return [];
  const nodes = includeSelf ? [branch, ...(branch.subItems || [])] : (branch.subItems || []);
  return nodes.map((page) => toNavItem(page, 'page', branchId)).filter(Boolean);
}

/** Páginas del hub Propiedades (/propiedades): la sección y sus hijas. */
export function getPropiedadesSectionPages() {
  return pagesForBranch('propiedades', { includeSelf: true });
}

/** Páginas del hub Inventario (/propiedades/inventario): la sección y sus hijas. */
export function getInventarioSectionPages() {
  return pagesForBranch('inventario', { includeSelf: true });
}

/** Subpáginas de una rama Caja (todas las del menú, incl. en construcción). */
export function getCajaBranchPages(branchId) {
  if (branchId === 'propiedades') return getPropiedadesSectionPages();
  if (branchId === 'inventario') return getInventarioSectionPages();
  return pagesForBranch(branchId);
}

/**
 * Fuera del chrome de Finanzas (footer = ramas; pages viven en hub + popups).
 * - Inversiones / Deudores: hub «Próximamente».
 * - Recurrentes: subpágina de Transacciones.
 * - Monedas / Cuentas: setup contextual desde Transacciones.
 * - Transacciones: destino principal vía hub (no tab de chrome).
 */
export const FINANZAS_HUB_STRIP_EXCLUDE_PAGE_IDS = [
  'inversiones',
  'deudores',
  'recurrente',
  'monedas',
  'cuentas',
  'transacciones',
];

/** @deprecated Usar FINANZAS_HUB_STRIP_EXCLUDE_PAGE_IDS */
export const FINANZAS_TOOLBAR_EXCLUDE_PAGE_IDS = FINANZAS_HUB_STRIP_EXCLUDE_PAGE_IDS;

function chromePages(pages, excludeIds = []) {
  const exclude = new Set(excludeIds);
  return pages.filter((page) => !page.isUnderConstruction && !exclude.has(page.id));
}

/** Strip Finanzas: vacío (chrome = ramas; pages = hub / setup). */
export function getFinanzasBranchPages() {
  return chromePages(getCajaBranchPages('finanzas'), FINANZAS_HUB_STRIP_EXCLUDE_PAGE_IDS);
}

/** Reservado: Propiedades ya no duplica Cuentas ni Transacciones. */
export const PROPIEDADES_HUB_STRIP_EXCLUDE_PAGE_IDS = [];

/**
 * Fuera del chrome de Inventario.
 * El hub de la rama no es un tab; Autos sigue en construcción.
 */
export const INVENTARIO_HUB_STRIP_EXCLUDE_PAGE_IDS = [
  'inventario',
  'vehiculos',
];

/** Páginas Propiedades en toolbar centro, strip y footer. */
export function getPropiedadesBranchPages() {
  return chromePages(getCajaBranchPages('propiedades'), PROPIEDADES_HUB_STRIP_EXCLUDE_PAGE_IDS);
}

/** Páginas Inventario en toolbar centro, strip y footer: En propiedades, Sin locación. */
export function getInventarioBranchPages() {
  return chromePages(getCajaBranchPages('inventario'), INVENTARIO_HUB_STRIP_EXCLUDE_PAGE_IDS);
}

export function getCajaBranchById(branchId) {
  return getCajaBranches().find((b) => b.id === branchId) || null;
}

/**
 * Bottom nav Caja = mismas ramas que toolbar derecha desktop
 * (Finanzas | Propiedades | Inventario).
 */
export function getCajaBottomNavItems() {
  return getCajaBranches();
}

/**
 * Ítems para bottom nav móvil.
 * - Foco: páginas hijas (Rutinas, Objetivos, Tareas).
 * - Pulso: secciones del menú (Data, Nutrición, Lab).
 * - Caja: ramas parent (Finanzas / Propiedades / Inventario).
 * El switcher de apps vive en AppsButton / sidebar, no en el footer.
 */
export function resolveBottomNavItems(appKey = getCurrentAppKey(), currentPath = '') {
  if (appKey === 'foco') {
    return getTiempoBottomNavItems();
  }

  if (appKey === 'pulso') {
    return resolveFlatModulePages('salud');
  }

  if (appKey === 'caja') {
    return getCajaBottomNavItems(currentPath);
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

/** Ramas Caja + rama activa (footer móvil y toolbar derecha desktop). */
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
 * Children del parent activo → toolbar centro del header.
 * Excluye el hub de la rama y destinos que viven solo en hub / subpages.
 */
export const CAJA_TOOLBAR_CENTER_EXCLUDE_IDS = {
  finanzas: ['transacciones', 'inversiones', 'deudores', 'recurrente'],
  propiedades: ['propiedades'],
  inventario: ['inventario', 'vehiculos'],
};

/** Ítems del toolbar centro: children del parent activo (menuStructure). */
export function resolveCajaToolbarCenterChildren(currentPath) {
  const { activeBranchId } = resolveCajaToolbarRight(currentPath);
  if (!activeBranchId) return [];
  return chromePages(
    getCajaBranchPages(activeBranchId),
    CAJA_TOOLBAR_CENTER_EXCLUDE_IDS[activeBranchId] || [],
  );
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
 * Hub de la rama para el botón «atrás».
 * Cada hub (`/finanzas`, `/propiedades`, `/propiedades/inventario`) es raíz:
 * el cambio de rama es el icono de la derecha, no un atrás hacia Finanzas.
 */
export function resolveCajaBranchHubPath(pathname) {
  if (pathname === '/finanzas' || pathname.startsWith('/finanzas/')) {
    return pathname === '/finanzas' ? null : '/finanzas';
  }
  if (pathname === '/propiedades/inventario') {
    return null;
  }
  if (isInventarioBranchRoute(pathname)) {
    return '/propiedades/inventario';
  }
  if (pathname === '/propiedades') {
    return null;
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
