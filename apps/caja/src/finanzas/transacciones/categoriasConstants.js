import {
  HealthAndSafety,
  Receipt,
  DirectionsBus,
  Fastfood,
  LocalBar as Cocktail,
  Checkroom as Shirt,
  Devices,
  MoreHoriz,
  Work,
  Storefront,
  Home,
  TrendingUp,
} from '@mui/icons-material';

// Fuente única de categorías en Caja (alineada al enum del backend en categoriasTransaccion.js).
export const CATEGORIAS = [
  { valor: 'Sueldo', tipos: ['INGRESO'], Icon: Work, color: '#66bb6a' },
  { valor: 'Ventas', tipos: ['INGRESO'], Icon: Storefront, color: '#26a69a' },
  { valor: 'Alquiler', tipos: ['INGRESO'], Icon: Home, color: '#42a5f5' },
  { valor: 'Inversiones', tipos: ['INGRESO'], Icon: TrendingUp, color: '#ab47bc' },
  { valor: 'Contabilidad y Facturas', tipos: ['INGRESO', 'EGRESO'], Icon: Receipt, color: '#7bba7f' },
  { valor: 'Comida y Mercado', tipos: ['EGRESO'], Icon: Fastfood, color: '#ffb74d' },
  { valor: 'Salud y Belleza', tipos: ['EGRESO'], Icon: HealthAndSafety, color: '#ef5350' },
  { valor: 'Ropa', tipos: ['EGRESO'], Icon: Shirt, color: '#ba68c8' },
  { valor: 'Fiesta', tipos: ['EGRESO'], Icon: Cocktail, color: '#9575cd' },
  { valor: 'Transporte', tipos: ['EGRESO'], Icon: DirectionsBus, color: '#64b5f6' },
  { valor: 'Tecnología', tipos: ['EGRESO'], Icon: Devices, color: '#90a4ae' },
  { valor: 'Otro', tipos: ['INGRESO', 'EGRESO'], Icon: MoreHoriz, color: '#a1887f' },
];

const CATEGORIA_BY_VALOR = new Map(CATEGORIAS.map((c) => [c.valor, c]));

export function getCategoriaMeta(valor) {
  return CATEGORIA_BY_VALOR.get(valor) || null;
}

export function getCategoriasPorTipo(tipo) {
  if (!tipo) return CATEGORIAS;
  return CATEGORIAS.filter((c) => c.tipos.includes(tipo));
}
