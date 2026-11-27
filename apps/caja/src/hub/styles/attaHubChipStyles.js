import {
  HUB_SECTION_CARD_BODY_MIN_HEIGHT,
  HUB_SECTION_CARD_MIN_HEIGHT,
  HUB_SUBSECTION,
  getHubSubsectionSx,
  getHubCardSx,
  hubGridContainerSx,
  hubGridItemSx,
  hubHeaderActionSx,
  hubHeaderIconSx,
} from '@shared/styles/hubSectionStyles';
import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, LINE_HEIGHT } from '@shared/tipografia';
import { cajaSwitchSx } from './attaPropiedadHubStyles';

export {
  HUB_SECTION_CARD_BODY_MIN_HEIGHT as CAJA_HUB_CARD_BODY_MIN_HEIGHT,
  HUB_SECTION_CARD_MIN_HEIGHT as CAJA_HUB_CARD_MIN_HEIGHT,
  cajaSwitchSx,
  getHubCardSx,
  hubGridContainerSx,
  hubGridItemSx,
  hubHeaderActionSx,
  hubHeaderIconSx,
};

export const CAJA_HUB_CHIP = {
  chipHeight: 50,
  chipRadius: HUB_SUBSECTION.borderRadius,
  chipGap: 0.625,
  chipPx: 0.875,
  chipPy: 0.5,
  monedaTileWidth: 108,
};

/** @deprecated Use CAJA_HUB_CHIP */
export const FINANZAS_HUB = CAJA_HUB_CHIP;

export function getHubChipSx({ selected } = {}) {
  return {
    ...getHubSubsectionSx({ selected }),
    height: CAJA_HUB_CHIP.chipHeight,
    px: CAJA_HUB_CHIP.chipPx,
    py: CAJA_HUB_CHIP.chipPy,
    transition: 'background-color 0.15s ease, border-color 0.15s ease',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
  };
}

export function getHubListRowSx({ selected } = {}) {
  return {
    ...getHubSubsectionSx({ selected }),
    px: CAJA_HUB_CHIP.chipPx,
    py: CAJA_HUB_CHIP.chipPy,
    transition: 'background-color 0.15s ease, border-color 0.15s ease',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
  };
}

export const hubLabelSx = {
  fontWeight: FONT_WEIGHT.semibold,
  lineHeight: 1.15,
  fontSize: FONT_SIZE.xs,
  letterSpacing: LETTER_SPACING.wider,
  color: 'text.secondary',
  textTransform: 'uppercase',
};

export const hubValueSx = {
  fontWeight: FONT_WEIGHT.bold,
  fontSize: FONT_SIZE.md,
  lineHeight: LINE_HEIGHT.snug,
  mt: 0.125,
};

export const hubPeriodSx = {
  display: 'block',
  fontSize: FONT_SIZE.xs,
  fontWeight: FONT_WEIGHT.semibold,
  letterSpacing: LETTER_SPACING.wider,
  color: 'text.secondary',
  textTransform: 'uppercase',
  mb: 0.375,
  px: 0.125,
};

export const hubCarouselSx = {
  display: 'flex',
  gap: CAJA_HUB_CHIP.chipGap,
  overflowX: 'auto',
  py: 0.125,
  scrollSnapType: 'x mandatory',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
};

export const hubMetricsRowSx = {
  display: 'flex',
  gap: CAJA_HUB_CHIP.chipGap,
  alignItems: 'stretch',
};
