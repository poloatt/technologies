export const CATEGORIAS_INGRESO = [
  'Sueldo',
  'Ventas',
  'Alquiler',
  'Inversiones',
  'Contabilidad y Facturas',
  'Otro',
];

export const CATEGORIAS_EGRESO = [
  'Salud y Belleza',
  'Contabilidad y Facturas',
  'Transporte',
  'Comida y Mercado',
  'Fiesta',
  'Ropa',
  'Tecnología',
  'Otro',
];

export const CATEGORIAS_TRANSACCION = [
  'Salud y Belleza',
  'Contabilidad y Facturas',
  'Transporte',
  'Comida y Mercado',
  'Fiesta',
  'Ropa',
  'Tecnología',
  'Sueldo',
  'Ventas',
  'Alquiler',
  'Inversiones',
  'Otro',
];

const SET_INGRESO = new Set(CATEGORIAS_INGRESO);
const SET_EGRESO = new Set(CATEGORIAS_EGRESO);
const SET_TODAS = new Set(CATEGORIAS_TRANSACCION);

export function esCategoriaValida(categoria) {
  return typeof categoria === 'string' && SET_TODAS.has(categoria);
}

export function esCategoriaValidaParaTipo(categoria, tipo) {
  if (!esCategoriaValida(categoria)) return false;
  if (tipo === 'INGRESO') return SET_INGRESO.has(categoria);
  if (tipo === 'EGRESO') return SET_EGRESO.has(categoria);
  return true;
}
