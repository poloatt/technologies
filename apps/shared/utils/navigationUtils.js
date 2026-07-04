import { modulos } from '../navigation/menuStructure';
import currentConfig from '../config/envConfig';
import { isCrossAppSsoViaCookie, isLocalhostDev } from './ssoUtils.js';

/**
 * Utilidades centralizadas para lógica de navegación
 * Elimina duplicación en Layout.jsx, BottomNavigation.jsx, Toolbar.jsx
 */

/**
 * Encuentra el módulo activo según la ruta actual
 * @param {string} currentPath - Ruta actual (location.pathname)
 * @returns {Object|null} - Módulo activo o null si no se encuentra
 */
export function findActiveModule(currentPath) {
  if (!currentPath) return null;

  const focoLegacyPrefixes = ['/rutinas', '/archivo'];
  if (focoLegacyPrefixes.some((p) => currentPath === p || currentPath.startsWith(`${p}/`))) {
    return modulos.find((m) => m.id === 'tiempo') || null;
  }

  // Atta: finanzas, propiedades e inventario comparten el módulo assets
  if (ATTA_PATHS.some((p) => currentPath === p || currentPath.startsWith(`${p}/`))) {
    return modulos.find((m) => m.id === 'assets') || null;
  }

  return modulos.find(modulo =>
    modulo.subItems?.some(sub => currentPath.startsWith(sub.path)) ||
    currentPath.startsWith(modulo.path)
  ) || null;
}

/**
 * Encuentra el nivel 1 activo dentro del módulo activo
 * @param {Object} moduloActivo - Módulo activo
 * @param {string} currentPath - Ruta actual
 * @returns {Object|null} - Nivel 1 activo o null
 */
export function findActiveLevel1(moduloActivo, currentPath) {
  if (!moduloActivo || !currentPath) return null;

  let best = null;
  let bestPathLen = -1;

  for (const branch of moduloActivo.subItems || []) {
    for (const page of branch.subItems || []) {
      if (!page.path) continue;
      if (currentPath === page.path || currentPath.startsWith(`${page.path}/`)) {
        if (page.path.length > bestPathLen) {
          bestPathLen = page.path.length;
          best = branch;
        }
      }
    }
    if (branch.path && (currentPath === branch.path || currentPath.startsWith(`${branch.path}/`))) {
      if (branch.path.length > bestPathLen) {
        bestPathLen = branch.path.length;
        best = branch;
      }
    }
  }

  return best;
}

/**
 * Obtiene los hijos de nivel 2 del nivel 1 activo
 * @param {Object} nivel1Activo - Nivel 1 activo
 * @returns {Array} - Array de hijos de nivel 2 o array vacío
 */
export function getLevel2Children(nivel1Activo) {
  return nivel1Activo?.subItems || [];
}

/**
 * Hook personalizado que combina toda la lógica de navegación
 * @param {string} currentPath - Ruta actual
 * @returns {Object} - Objeto con todas las propiedades de navegación
 */
export function useNavigationState(currentPath) {
  const moduloActivo = findActiveModule(currentPath);
  const nivel1Activo = findActiveLevel1(moduloActivo, currentPath);
  const nivel2 = getLevel2Children(nivel1Activo);
  
  return {
    moduloActivo,
    nivel1Activo,
    nivel2,
    // Utilidades adicionales
    hasActiveModule: !!moduloActivo,
    hasActiveLevel1: !!nivel1Activo,
    hasLevel2Children: nivel2.length > 0
  };
}

/**
 * Obtiene los módulos principales para navegación
 * @param {Array} moduleIds - IDs de módulos a filtrar (opcional)
 * @returns {Array} - Array de módulos filtrados
 */
export function getMainModules(moduleIds = ['assets', 'salud', 'tiempo']) {
  return modulos.filter(m => moduleIds.includes(m.id));
}

/**
 * Reordena módulos poniendo el activo primero
 * @param {Array} modules - Array de módulos
 * @param {Object} activeModule - Módulo activo
 * @returns {Array} - Array reordenado
 */
export function reorderModulesWithActiveFirst(modules, activeModule) {
  if (!activeModule) return modules;
  
  const otherModules = modules.filter(m => m.id !== activeModule.id);
  return [activeModule, ...otherModules];
}

/**
 * Verifica si una ruta está activa
 * @param {string} currentPath - Ruta actual
 * @param {string|Array} targetPaths - Ruta(s) objetivo
 * @returns {boolean} - True si está activa
 */
export function isRouteActive(currentPath, targetPaths) {
  if (Array.isArray(targetPaths)) {
    return targetPaths.some(path => {
      if (path === '/') {
        return (
          currentPath === '/'
          || currentPath.startsWith('/finanzas')
          || currentPath.startsWith('/propiedades')
        );
      }
      return currentPath === path || currentPath.startsWith(path + '/');
    });
  }
  
  if (targetPaths === '/') {
    return (
      currentPath === '/'
      || currentPath.startsWith('/finanzas')
      || currentPath.startsWith('/propiedades')
    );
  }
  
  return currentPath === targetPaths || currentPath.startsWith(targetPaths + '/');
}

/**
 * Obtiene información de navegación para breadcrumbs
 * @param {string} currentPath - Ruta actual
 * @returns {Object} - Información para breadcrumbs
 */
export function getBreadcrumbInfo(currentPath) {
  const { moduloActivo, nivel1Activo } = useNavigationState(currentPath);
  
  const pathParts = currentPath.split('/').filter(Boolean);
  const canGoBack = pathParts.length > 1;
  const parentPath = canGoBack ? '/' + pathParts.slice(0, -1).join('/') : '/';
  
  return {
    moduloActivo,
    nivel1Activo,
    canGoBack,
    parentPath,
    pathParts
  };
} 

// --- Helpers para navegación entre apps (subdominios) ---

const ATTA_PATHS = ['/finanzas', '/propiedades'];
const PULSO_PATHS = ['/datacorporal', '/dieta', '/lab'];
const FOCO_PATHS = ['/rutinas', '/objetivos', '/tareas', '/archivo', '/configuracion'];

const PORT_APP_MAPPING = {
  '5174': 'atta',
  '5175': 'pulso',
  '5173': 'foco'
};

export function getAppKeyFromPath(pathname) {
  if (!pathname) return 'foco';
  if (ATTA_PATHS.some(p => pathname.startsWith(p))) return 'atta';
  if (PULSO_PATHS.some(p => pathname.startsWith(p))) return 'pulso';
  if (FOCO_PATHS.some(p => pathname.startsWith(p))) return 'foco';
  return 'foco';
}

export function getCurrentAppKey() {
  if (typeof window === 'undefined') return 'foco';
  const { hostname, port, pathname } = window.location;
  if (hostname === 'atta.attadia.com' || hostname === 'atta.local.attadia.com') return 'atta';
  if (hostname === 'pulso.attadia.com' || hostname === 'pulso.local.attadia.com') return 'pulso';
  if (hostname === 'foco.attadia.com' || hostname === 'foco.local.attadia.com') return 'foco';
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return PORT_APP_MAPPING[port] || getAppKeyFromPath(pathname);
  }
  return getAppKeyFromPath(pathname);
}

export function buildAppUrl(appKey, path) {
  const cleanPath = path?.startsWith('/') ? path : `/${path || ''}`;
  // Usar URLs explícitas de envConfig, que ya contemplan dev/prod por import.meta.env
  const base = currentConfig?.frontendUrls?.[appKey];
  if (!base) return cleanPath;
  return `${base}${cleanPath}`;
}

export function navigateToAppPath(navigate, targetPath) {
  const targetApp = getAppKeyFromPath(targetPath);
  const currentApp = getCurrentAppKey();
  if (targetApp === currentApp) {
    return navigate(targetPath);
  }

  // Producción / subdominios locales: SSO vía cookie httpOnly compartida
  if (isCrossAppSsoViaCookie()) {
    return window.location.assign(buildAppUrl(targetApp, targetPath));
  }

  // Dev localhost: cookies no cruzan puertos — fallback handoff por URL
  if (isLocalhostDev()) {
    try {
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      const redirectParam = encodeURIComponent(targetPath);
      if (token) {
        const url = buildAppUrl(
          targetApp,
          `/auth/callback?token=${encodeURIComponent(token)}${refreshToken ? `&refreshToken=${encodeURIComponent(refreshToken)}` : ''}&redirect=${redirectParam}`,
        );
        return window.location.assign(url);
      }
    } catch (_) {
      // ignorar errores de storage
    }
  }

  window.location.assign(buildAppUrl(targetApp, targetPath));
}

const prefetchedApps = new Set();

/** Prefetch index de otra app al hover/focus para acelerar el switch cross-app. */
export function prefetchApp(appKey) {
  if (typeof document === 'undefined' || !appKey) return;
  if (appKey === getCurrentAppKey()) return;
  if (prefetchedApps.has(appKey)) return;
  prefetchedApps.add(appKey);

  const base = currentConfig?.frontendUrls?.[appKey];
  if (!base) return;

  const prefetchLink = document.createElement('link');
  prefetchLink.rel = 'prefetch';
  prefetchLink.href = `${base}/`;
  document.head.appendChild(prefetchLink);

  try {
    const { protocol, hostname } = new URL(base);
    const dnsLink = document.createElement('link');
    dnsLink.rel = 'dns-prefetch';
    dnsLink.href = `${protocol}//${hostname}`;
    document.head.appendChild(dnsLink);
  } catch (_) {
    // ignorar URLs inválidas
  }
}

export function prefetchAppForPath(path) {
  prefetchApp(getAppKeyFromPath(path));
}