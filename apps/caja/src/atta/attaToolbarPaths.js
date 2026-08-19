/** Rutas del módulo Caja (finanzas / propiedades / inventario). */
export function matchCajaSection(path = '') {
  if (path === '/finanzas' || path.startsWith('/finanzas/')) return 'finanzas';
  if (path === '/propiedades/inventario' || path.startsWith('/propiedades/inventario/')) {
    return 'inventario';
  }
  if (path === '/propiedades' || path.startsWith('/propiedades/')) return 'propiedades';
  return null;
}
