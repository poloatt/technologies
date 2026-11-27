import {
  FINANZAS_HUB,
  getHubChipSx,
  hubCarouselSx,
  hubLabelSx,
  hubValueSx,
} from '../../hub';
import { FONT_FAMILY, FONT_SIZE } from '@shared/tipografia';

export const COLORES_MONEDA = {
  CELESTE_ARGENTINA: { value: '#75AADB', label: 'Celeste Argentina' },
  AZUL_NAVY: { value: '#000080', label: 'Azul Navy' },
  TEAL: { value: '#008080', label: 'Teal' },
  DARK_TEAL: { value: '#006666', label: 'Dark Teal' },
  DARK_GREEN: { value: '#006400', label: 'Dark Green' },
  VERDE_DOLAR: { value: '#6E8F6B', label: 'Verde Dólar' },
  VIOLETA_OSCURO: { value: '#4B0082', label: 'Violeta Oscuro' },
};

/** Color predeterminado para USD (verde billete desaturado). */
export const DEFAULT_USD_COLOR = COLORES_MONEDA.VERDE_DOLAR.value;

export function getDefaultColorForMoneda(codigo) {
  return String(codigo || '').toUpperCase() === 'USD'
    ? DEFAULT_USD_COLOR
    : COLORES_MONEDA.CELESTE_ARGENTINA.value;
}

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
  fontFamily: FONT_FAMILY.mono,
  fontSize: FONT_SIZE.sm,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

export const monedaCarouselSx = hubCarouselSx;

/** @deprecated use getMonedaTileSx */
export const monedaTileCardSx = getMonedaTileSx();
