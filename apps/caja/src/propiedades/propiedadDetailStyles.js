import { alpha } from '@mui/material/styles';
import { HUB_SECTION, HUB_SUBSECTION } from '@shared/styles/hubSectionStyles';
import { getPropiedadEstadoChipSx } from '../hub/styles/attaPropiedadHubStyles';

const PROPIEDAD_HUB = {
  ...HUB_SECTION,
  blockRadius: HUB_SUBSECTION.borderRadius,
};
import { tareaFormGooglePaperSx } from '@shared/components/forms/tareaFormUi';

export { tareaFormGooglePaperSx };

export const PROPIEDAD_DETAIL = {
  sectionRadius: PROPIEDAD_HUB.sectionRadius,
  rowMinHeight: 44,
  bodyPx: 1.5,
  bodyPy: 1.25,
  listGap: 1,
};

/** Dialog paper — reuses Google Tasks form tokens. */
export function getPropiedadDetailPaperSx(isMobile) {
  return tareaFormGooglePaperSx(isMobile);
}

export const propiedadDetailContentSx = {
  px: 2,
  pt: 0.5,
  pb: 1,
  bgcolor: 'background.paper',
};

/** Single rounded surface wrapping all expandable rows. */
export const propiedadDetailSectionListSx = {
  borderRadius: PROPIEDAD_DETAIL.sectionRadius,
  bgcolor: (t) => alpha(t.palette.common.white, t.palette.mode === 'dark' ? 0.04 : 0.06),
  border: '1px solid',
  borderColor: 'divider',
  overflow: 'hidden',
};

export const propiedadDetailSectionHeaderSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.25,
  width: '100%',
  minHeight: PROPIEDAD_DETAIL.rowMinHeight,
  px: PROPIEDAD_DETAIL.bodyPx,
  py: 1,
  border: 'none',
  bgcolor: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  color: 'text.primary',
  transition: 'background-color 0.15s ease',
  '&:hover': { bgcolor: 'action.hover' },
};

export const propiedadDetailSectionTitleSx = {
  flex: 1,
  fontSize: '0.875rem',
  fontWeight: 500,
  lineHeight: 1.45,
};

export const propiedadDetailSectionIconSx = {
  fontSize: 20,
  color: 'text.secondary',
  flexShrink: 0,
};

export const propiedadDetailSectionChevronSx = (expanded) => ({
  fontSize: 20,
  color: 'text.secondary',
  flexShrink: 0,
  transition: 'transform 0.2s ease',
  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
});

export const propiedadDetailSectionBodySx = {
  px: PROPIEDAD_DETAIL.bodyPx,
  pb: PROPIEDAD_DETAIL.bodyPy,
  pt: 0.25,
};

export const propiedadDetailSectionDividerSx = {
  mx: PROPIEDAD_DETAIL.bodyPx,
  borderColor: 'divider',
};

/** Card-like ubicación row inside a section. */
export const propiedadDetailUbicacionCardSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.25,
  px: 1.25,
  py: 1,
  borderRadius: PROPIEDAD_HUB.blockRadius,
  bgcolor: 'action.hover',
  border: '1px solid',
  borderColor: 'divider',
};

export const propiedadDetailRowIconSx = {
  fontSize: 20,
  color: 'text.secondary',
  flexShrink: 0,
};

export const propiedadDetailPrimaryTextSx = {
  fontSize: '0.875rem',
  fontWeight: 500,
  lineHeight: 1.45,
  color: 'text.primary',
};

export const propiedadDetailSecondaryTextSx = {
  fontSize: '0.75rem',
  lineHeight: 1.35,
  color: 'text.secondary',
  mt: 0.25,
};

export const propiedadDetailEmptyTextSx = {
  display: 'block',
  fontSize: '0.8125rem',
  color: 'text.disabled',
  py: 0.5,
};

/** Soft estado pill — text only, no status dot. */
export function getPropiedadDetailEstadoPillSx(estadoColor) {
  return getPropiedadEstadoChipSx(estadoColor);
}

export const propiedadDetailHeaderTitleSx = {
  fontSize: '1.375rem',
  fontWeight: 400,
  lineHeight: 1.35,
  color: 'text.primary',
  pr: 4,
};

export const propiedadDetailHeaderMetaSx = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 1,
  mt: 0.75,
};

export const propiedadDetailHeaderSubtitleSx = {
  fontSize: '0.8125rem',
  lineHeight: 1.35,
  color: 'text.secondary',
};

export const propiedadDetailFooterSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
  px: 2,
  py: 1.5,
  borderTop: 1,
  borderColor: 'divider',
};

export const propiedadDetailFooterActionSx = {
  color: 'text.secondary',
  '&:hover': { bgcolor: 'action.hover' },
};

export const propiedadDetailCloseButtonSx = {
  textTransform: 'none',
  borderRadius: '20px',
  px: 2,
  py: 0.625,
  minWidth: 72,
  fontWeight: 500,
  fontSize: '0.875rem',
  color: 'text.secondary',
  '&:hover': { bgcolor: 'action.hover' },
};

export const propiedadDetailListRowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.25,
  py: 0.75,
  minHeight: 36,
};

export const propiedadDetailLinkTextSx = {
  fontSize: '0.8125rem',
  color: 'primary.main',
  cursor: 'pointer',
  mt: 0.5,
  '&:hover': { textDecoration: 'underline' },
};
