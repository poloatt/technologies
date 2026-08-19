import {
  FINANZAS_HUB,
  getHubChipSx,
  hubCarouselSx,
  hubLabelSx,
  hubValueSx,
} from '../../hub';

export const COLORES_MONEDA = {
  CELESTE_ARGENTINA: { value: '#75AADB', label: 'Celeste Argentina' },
  AZUL_NAVY: { value: '#000080', label: 'Azul Navy' },
  TEAL: { value: '#008080', label: 'Teal' },
  DARK_TEAL: { value: '#006666', label: 'Dark Teal' },
  DARK_GREEN: { value: '#006400', label: 'Dark Green' },
  VIOLETA_OSCURO: { value: '#4B0082', label: 'Violeta Oscuro' },
};

/** Dimensiones balanceadas hub / página (alineadas con FINANZAS_HUB). */
export const MONEDA_TILE = {
  height: FINANZAS_HUB.chipHeight,
  heightFull: 54,
  width: FINANZAS_HUB.monedaTileWidth,
  widthFull: 148,
  symbolSize: 26,
  gap: FINANZAS_HUB.chipGap,
  px: FINANZAS_HUB.chipPx,
  py: FINANZAS_HUB.chipPy,
  radius: FINANZAS_HUB.chipRadius,
};

export function getMonedaTileSx(options) {
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

export { hubLabelSx as monedaLabelSx, hubValueSx as monedaValueSx };

export const monedaSymbolSx = {
  width: MONEDA_TILE.symbolSize,
  height: MONEDA_TILE.symbolSize,
  borderRadius: '50%',
  bgcolor: 'background.default',
  border: '1px solid',
  borderColor: 'divider',
  color: 'text.primary',
  fontFamily: 'monospace',
  fontSize: '0.75rem',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

export const monedaCarouselSx = hubCarouselSx;

/** @deprecated use getMonedaTileSx */
export const monedaTileCardSx = getMonedaTileSx();
