import { getDefaultColorForMoneda } from './monedaConstants';

export { default as MonedaTile } from './MonedaTile';
export { default as MonedasCarousel } from './MonedasCarousel';
export { default as MonedasSortableList } from './MonedasSortableList';
export { sortMonedasByOrden, arrayMove, getMonedaId } from './monedaSortUtils';
export { MonedaTileSkeleton } from './MonedasCarousel';
export {
  COLORES_MONEDA,
  DEFAULT_USD_COLOR,
  getDefaultColorForMoneda,
  MONEDA_TILE,
  monedaCarouselSx,
  monedaTileCardSx,
  getMonedaTileSx,
  monedaSymbolSx,
} from './monedaConstants';
export { useMonedaBalance } from './useMonedaBalance';

export function normalizeMoneda(moneda) {
  return {
    id: moneda.id || moneda._id,
    _id: moneda.id || moneda._id,
    codigo: moneda.codigo || '—',
    nombre: moneda.nombre || '—',
    simbolo: moneda.simbolo || '$',
    color: moneda.color || getDefaultColorForMoneda(moneda.codigo),
    activa: typeof moneda.activa === 'boolean' ? moneda.activa : true,
  };
}
