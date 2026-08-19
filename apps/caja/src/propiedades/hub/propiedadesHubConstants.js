import { CAJA_HUB_CHIP, getHubChipSx } from '../../hub';

/** Propiedades visibles en el hub antes de expandir (bloques más altos). */
export const PROPIEDADES_HUB_PROPIEDAD_PREVIEW_COUNT = 2;

/** Filas visibles en secciones tipo lista (inquilinos, inventario). */
export const PROPIEDADES_HUB_PREVIEW_COUNT = 3;

/** Tile de ambiente (hub / detalle): chip icon-only alineado con MONEDA_TILE / CAJA_HUB_CHIP. */
export const HABITACION_TILE = {
  height: CAJA_HUB_CHIP.chipHeight,
  heightFull: CAJA_HUB_CHIP.chipHeight,
  width: CAJA_HUB_CHIP.chipHeight,
  widthFull: 54,
  symbolSize: 26,
  iconFontSize: 16,
  gap: CAJA_HUB_CHIP.chipGap,
  px: CAJA_HUB_CHIP.chipPx,
  py: CAJA_HUB_CHIP.chipPy,
  radius: CAJA_HUB_CHIP.chipRadius,
};

export function getHabitacionTileSx(options) {
  return {
    ...getHubChipSx(options),
    scrollSnapAlign: 'start',
    ...(options?.isSelectable && !options?.selected && {
      '&:hover': {
        bgcolor: 'action.selected',
      },
    }),
  };
}

/** Círculo neutro del icono (mismo lenguaje que monedaSymbolSx). */
export const habitacionIconSx = {
  width: HABITACION_TILE.symbolSize,
  height: HABITACION_TILE.symbolSize,
  borderRadius: '50%',
  bgcolor: 'background.default',
  border: '1px solid',
  borderColor: 'divider',
  color: 'text.secondary',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
