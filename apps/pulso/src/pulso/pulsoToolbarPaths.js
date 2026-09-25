/** Rutas del módulo Pulso. */
export function matchPulsoSection(path = '') {
  if (path === '/data' || path.startsWith('/data/') || path === '/datacorporal' || path.startsWith('/datacorporal/')) return 'data';
  if (path === '/nutricion' || path.startsWith('/nutricion/') || path === '/dieta' || path.startsWith('/dieta/')) return 'nutricion';
  if (path === '/lab' || path.startsWith('/lab/')) return 'lab';
  if (path === '/salud' || path.startsWith('/salud/')) return 'salud';
  return null;
}
