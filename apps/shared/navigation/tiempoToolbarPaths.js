/** Rutas del módulo Foco (rutinas / objetivos / tareas). */
export function matchTiempoSection(path = '') {
  if (
    path === '/rutinas'
    || path.startsWith('/rutinas/')
    || path.startsWith('/tiempo/rutinas')
  ) return 'rutinas';
  if (
    path === '/objetivos'
    || path.startsWith('/objetivos/')
    || path.startsWith('/tiempo/objetivos')
    || path === '/proyectos'
    || path.startsWith('/proyectos/')
    || path.startsWith('/tiempo/proyectos')
  ) return 'objetivos';
  if (
    path === '/tareas'
    || path.startsWith('/tareas/')
    || path.startsWith('/tiempo/tareas')
  ) return 'tareas';
  return null;
}

export function isTiempoToolbarPath(path = '') {
  return matchTiempoSection(path) != null;
}

/** Rutas Foco que usan barra unificada (incluye Hábitos y Archivo). */
export function isFocoToolbarPath(path = '') {
  return isTiempoToolbarPath(path)
    || path === '/rutinas'
    || path.startsWith('/rutinas/')
    || path === '/archivo'
    || path.startsWith('/archivo/');
}
