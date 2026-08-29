import { alpha } from '@mui/material/styles';

/** Shared Google Calendar / Tasks–inspired form tokens (dark theme). */

export const TASK_FORM_TITLE_FONT_SIZE = '1.375rem';
export const TASK_FORM_TITLE_LINE_HEIGHT = 1.35;
export const TASK_FORM_TITLE_FONT_WEIGHT = 400;

export const TASK_FORM_BODY_FONT_SIZE = '0.875rem';
export const TASK_FORM_BODY_LINE_HEIGHT = 1.45;

export const TASK_FORM_PILL_FONT_SIZE = '0.8125rem';
export const TASK_FORM_PILL_LINE_HEIGHT = 1.35;
export const TASK_FORM_PILL_FONT_WEIGHT = 400;

export const TASK_FORM_CAPTION_FONT_SIZE = '0.75rem';
export const TASK_FORM_CAPTION_LINE_HEIGHT = 1.35;

export const TASK_FORM_BUTTON_FONT_SIZE = TASK_FORM_BODY_FONT_SIZE;
export const TASK_FORM_BUTTON_FONT_WEIGHT = 500;

export const TASK_FORM_ICON_SIZE = 20;
export const TASK_FORM_PILL_ICON_SIZE = 16;
export const TASK_FORM_CHEVRON_ICON_SIZE = 18;
export const TASK_FORM_ACTION_ICON_SIZE = 20;
export const TASK_FORM_SUBTASK_CHECK_ICON_SIZE = 18;
export const TASK_FORM_INLINE_ATTACHMENT_ICON_SIZE = 14;

export const TASK_FORM_PILL_HEIGHT = 32;
export const TASK_FORM_PILL_BORDER_RADIUS = '9999px';
export const TASK_FORM_PILL_CHIP_BORDER_RADIUS = 16;
export const TASK_FORM_PILL_GAP = 0.75;
export const TASK_FORM_STANDARD_PILL_WIDTH = 180;
export const TASK_FORM_OBJETIVO_PILL_MAX_WIDTH = 280;
export const TASK_FORM_PILL_BORDER_WIDTH = '1px';
export const TASK_FORM_PILL_OUTLINE_BORDER = 'rgba(255, 255, 255, 0.15)';
export const TASK_FORM_PILL_OUTLINE_BORDER_HOVER = 'rgba(255, 255, 255, 0.25)';
export const TASK_FORM_PILL_OUTLINED_BG = 'transparent';
export const TASK_FORM_PILL_OUTLINED_BG_HOVER = 'rgba(255, 255, 255, 0.08)';
export const TASK_FORM_PILL_FILL_BG = 'rgba(255, 255, 255, 0.08)';
export const TASK_FORM_PILL_FILL_BG_HOVER = 'rgba(255, 255, 255, 0.12)';

export const TASK_FORM_ROW_MIN_HEIGHT = 44;
export const TASK_FORM_ROW_PY = 1.25;
export const TASK_FORM_ROW_GAP = 1.5;
export const TASK_FORM_ROW_ICON_TOP_OFFSET = 0.25;
export const TASK_FORM_HORIZONTAL_PX = 2;
export const TASK_FORM_ICON_COLUMN_WIDTH = 24;
export const TASK_FORM_HEADER_ACTION_GUTTER = 4;
export const TASK_FORM_HEADER_ACTION_GAP = 0.75;
export const TASK_FORM_HEADER_ACTION_COLUMN_WIDTH = TASK_FORM_PILL_HEIGHT;
export const TASK_FORM_ACTION_COLUMN_WIDTH = TASK_FORM_HEADER_ACTION_COLUMN_WIDTH;

export const taskFormTitleTextSx = {
  fontSize: TASK_FORM_TITLE_FONT_SIZE,
  fontWeight: TASK_FORM_TITLE_FONT_WEIGHT,
  lineHeight: TASK_FORM_TITLE_LINE_HEIGHT,
};

export const taskFormBodyTextSx = {
  fontSize: TASK_FORM_BODY_FONT_SIZE,
  lineHeight: TASK_FORM_BODY_LINE_HEIGHT,
};

export const taskFormPillTextSx = {
  fontSize: TASK_FORM_PILL_FONT_SIZE,
  lineHeight: TASK_FORM_PILL_LINE_HEIGHT,
  fontWeight: TASK_FORM_PILL_FONT_WEIGHT,
};

export const taskFormCaptionTextSx = {
  fontSize: TASK_FORM_CAPTION_FONT_SIZE,
  lineHeight: TASK_FORM_CAPTION_LINE_HEIGHT,
  color: 'text.secondary',
};

/** Small type label floating above the title (Evento / Tarea). */
export const taskFormTipoFloatingLabelSx = {
  ...taskFormCaptionTextSx,
  fontSize: '0.6875rem',
  fontWeight: 500,
  letterSpacing: '0.03em',
  lineHeight: 1.2,
  display: 'block',
  width: 'fit-content',
  maxWidth: '100%',
  pointerEvents: 'none',
  userSelect: 'none',
};

export const taskFormFieldInputSx = {
  fontSize: TASK_FORM_BODY_FONT_SIZE,
  lineHeight: TASK_FORM_BODY_LINE_HEIGHT,
  py: 0,
};

export const taskFormSwitchLabelSx = {
  ...taskFormPillTextSx,
  userSelect: 'none',
};

export const taskFormErrorTextSx = {
  fontSize: TASK_FORM_CAPTION_FONT_SIZE,
  lineHeight: TASK_FORM_CAPTION_LINE_HEIGHT,
  color: 'error.main',
};

export const taskFormPillIconSx = { fontSize: TASK_FORM_PILL_ICON_SIZE, flexShrink: 0 };
export const taskFormPillChevronSx = { fontSize: TASK_FORM_CHEVRON_ICON_SIZE, color: 'text.secondary', flexShrink: 0 };
export const taskFormActionIconSx = { fontSize: TASK_FORM_ACTION_ICON_SIZE };
export const taskFormSubtaskCheckIconSx = { fontSize: TASK_FORM_SUBTASK_CHECK_ICON_SIZE };
export const taskFormInlineAttachmentIconSx = { fontSize: TASK_FORM_INLINE_ATTACHMENT_ICON_SIZE };
export const taskFormPillRowSx = { width: '100%', minHeight: TASK_FORM_PILL_HEIGHT };
export const taskFormScheduleStackSx = { width: '100%' };
export const taskFormRowContentIndent = TASK_FORM_ICON_COLUMN_WIDTH / 8 + TASK_FORM_ROW_GAP;

/** Indented body when schedule fields expand under the summary row (no duplicate icon). */
export const taskFormScheduleExpandedContentSx = {
  pl: taskFormRowContentIndent,
  pr: TASK_FORM_HEADER_ACTION_GUTTER,
  width: '100%',
  boxSizing: 'border-box',
};

export const taskFormScheduleControlsRowSx = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  minWidth: 0,
};

export const taskFormScheduleRecurrenceWrapSx = {
  width: '100%',
  minWidth: 0,
  '& > button': {
    width: '100%',
    maxWidth: '100%',
    justifyContent: 'space-between',
  },
};

export const taskFormSubtaskRowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  py: 0.25,
  minHeight: TASK_FORM_ROW_MIN_HEIGHT,
};

export const taskFormTimeSeparatorSx = {
  px: 0.25,
  userSelect: 'none',
  fontSize: TASK_FORM_PILL_FONT_SIZE,
  color: 'text.secondary',
};

export const taskFormChipSx = {
  height: TASK_FORM_PILL_HEIGHT,
  borderRadius: TASK_FORM_PILL_CHIP_BORDER_RADIUS,
  fontSize: TASK_FORM_PILL_FONT_SIZE,
};

export const taskFormDialogPaperSx = (isMobile) => ({
  borderRadius: isMobile ? 0 : 3,
  bgcolor: 'background.paper',
  backgroundImage: 'none',
  boxShadow: (t) => t.shadows[isMobile ? 16 : 12],
  overflow: 'hidden',
  ...(isMobile && {
    m: 0,
    width: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    height: '100%',
  }),
});

/**
 * Centra el diálogo en desktop. contentOffset compensa la sidebar para centrar en el área útil.
 */
export function getTaskFormDialogSx(isMobile, { zIndex, contentOffset = 0 } = {}) {
  const sx = {};
  if (zIndex != null) sx.zIndex = zIndex;
  if (isMobile) return sx;

  sx['& .MuiDialog-container'] = {
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (contentOffset > 0) {
    sx['& .MuiDialog-paper'] = {
      marginLeft: `${contentOffset / 2}px`,
    };
  }

  return sx;
}

export const taskFormGooglePaperSx = taskFormDialogPaperSx;

export const taskFormTitleFieldSx = {
  '& .MuiInputBase-input': {
    ...taskFormTitleTextSx,
    py: 0.75,
    px: 0,
  },
  '& .MuiInput-underline:before': { borderBottomColor: 'divider' },
  '& .MuiInput-underline:hover:not(.Mui-disabled):before': {
    borderBottomColor: 'rgba(255, 255, 255, 0.25)',
  },
  '& .MuiInput-underline:after': { borderBottomWidth: 1 },
};

export const taskFormStandardFieldSx = {
  '& .MuiInputBase-root': { fontSize: TASK_FORM_BODY_FONT_SIZE },
  '& .MuiInputBase-input': { px: 0 },
  '& .MuiInput-underline:before': { borderBottomColor: 'divider' },
  '& .MuiInput-underline:hover:not(.Mui-disabled):before': {
    borderBottomColor: 'rgba(255, 255, 255, 0.25)',
  },
  '& .MuiInput-underline:after': { borderBottomWidth: 1 },
};

export const taskFormRowIconSx = {
  color: 'text.secondary',
  fontSize: TASK_FORM_ICON_SIZE,
  flexShrink: 0,
};

export const taskFormPrimaryTextSx = {
  variant: 'body2',
  component: 'div',
  sx: { ...taskFormBodyTextSx, color: 'text.primary' },
};

export const taskFormSecondaryTextSx = taskFormCaptionTextSx;

export const taskFormRowIconColumnSx = (align = 'flex-start') => ({
  width: TASK_FORM_ICON_COLUMN_WIDTH,
  flexShrink: 0,
  display: 'flex',
  justifyContent: 'center',
  ...(align === 'center'
    ? { alignItems: 'center', alignSelf: 'center' }
    : {
      alignItems: 'flex-start',
      alignSelf: 'flex-start',
      pt: TASK_FORM_ROW_ICON_TOP_OFFSET,
    }),
});

export const taskFormHeaderActionIconSx = (color = 'text.secondary') => ({
  width: TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
  height: TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
  minWidth: TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
  p: 0,
  borderRadius: 0,
  border: 'none',
  bgcolor: 'transparent',
  color,
  flexShrink: 0,
  boxSizing: 'border-box',
  transition: 'color 0.15s ease, opacity 0.15s ease',
});

export const taskFormHeaderActionColumnSx = {
  width: TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'flex-start',
  mt: 0.5,
};

export const taskFormRowActionColumnSx = {
  width: TASK_FORM_ACTION_COLUMN_WIDTH,
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
};

export const taskFormRowWithActionSx = {
  display: 'flex',
  alignItems: 'center',
  gap: TASK_FORM_HEADER_ACTION_GAP,
  width: '100%',
  minWidth: 0,
  pr: TASK_FORM_HEADER_ACTION_GUTTER,
};

export const taskFormRowContentGutterSx = {
  pr: TASK_FORM_HEADER_ACTION_GUTTER,
};

export const taskFormSubtaskListSx = {
  pl: taskFormRowContentIndent,
  pr: TASK_FORM_HEADER_ACTION_GUTTER,
  pb: 0.5,
};

/** Shared wrapper for objetivo + subtareas rows (visual section group). */
export const taskFormObjetivoSubtareasSectionSx = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
};

/** Matching content width for objetivo and subtareas row bodies. */
export const taskFormObjetivoSubtareasContentSx = {
  ...taskFormRowContentGutterSx,
  width: '100%',
  minWidth: 0,
  flex: 1,
  boxSizing: 'border-box',
};

export const taskFormHeaderIconSpacerSx = {
  width: TASK_FORM_ICON_COLUMN_WIDTH,
  flexShrink: 0,
};

export const taskFormHeaderActionSpacerSx = {
  width: TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
  minWidth: TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
  flexShrink: 0,
};

export const taskFormHeaderContentRowSx = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: TASK_FORM_HEADER_ACTION_GAP,
  pr: TASK_FORM_HEADER_ACTION_GUTTER,
};

export const taskFormSaveButtonSx = {
  textTransform: 'none',
  borderRadius: TASK_FORM_PILL_BORDER_RADIUS,
  px: 2.5,
  py: 0.75,
  minWidth: 88,
  fontWeight: TASK_FORM_BUTTON_FONT_WEIGHT,
  fontSize: TASK_FORM_BUTTON_FONT_SIZE,
  boxShadow: 'none',
  bgcolor: '#ffffff',
  color: '#202124',
  '&:hover': {
    bgcolor: '#f1f3f4',
    boxShadow: 'none',
  },
  '&.Mui-disabled': {
    bgcolor: 'action.disabledBackground',
    color: 'text.disabled',
  },
};

export const TASK_FORM_TIPO_EVENTO_TAREA = [
  { value: 'EVENTO', label: 'Evento' },
  { value: 'TAREA', label: 'Tarea' },
];

export const TASK_FORM_TIPO_ALL = [
  ...TASK_FORM_TIPO_EVENTO_TAREA,
  { value: 'HABITO', label: 'Hábito' },
];

export const TASK_FORM_ESTADO_OPTIONS = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_PROGRESO', label: 'En Progreso' },
  { value: 'COMPLETADA', label: 'Completada' },
];

export const TASK_FORM_ESTADO_CANCELADA_OPTION = {
  value: 'CANCELADA',
  label: 'Cancelada',
};

/** Pills de estado: Cancelada solo cuando la tarea ya está cancelada. */
export function getTaskFormEstadoOptions(estado) {
  if (String(estado || '').toUpperCase() === 'CANCELADA') {
    return [...TASK_FORM_ESTADO_OPTIONS, TASK_FORM_ESTADO_CANCELADA_OPTION];
  }
  return TASK_FORM_ESTADO_OPTIONS;
}

export const TASK_FORM_OBJETIVO_ESTADO_OPTIONS = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_PROGRESO', label: 'En Progreso' },
  { value: 'COMPLETADO', label: 'Completado' },
];

const taskFormPillBaseSx = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: TASK_FORM_PILL_GAP,
  borderRadius: TASK_FORM_PILL_BORDER_RADIUS,
  fontSize: TASK_FORM_PILL_FONT_SIZE,
  fontWeight: 400,
  lineHeight: TASK_FORM_PILL_LINE_HEIGHT,
  px: 1.25,
  py: 0,
  height: TASK_FORM_PILL_HEIGHT,
  minHeight: TASK_FORM_PILL_HEIGHT,
  boxSizing: 'border-box',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  transition: 'background-color 0.15s ease, border-color 0.15s ease',
  '&:disabled': {
    opacity: 0.45,
    cursor: 'default',
  },
};

export const taskFormPillOutlinedSx = {
  ...taskFormPillBaseSx,
  border: `${TASK_FORM_PILL_BORDER_WIDTH} solid ${TASK_FORM_PILL_OUTLINE_BORDER}`,
  bgcolor: TASK_FORM_PILL_OUTLINED_BG,
  color: 'text.primary',
  '&:hover:not(:disabled)': {
    bgcolor: TASK_FORM_PILL_OUTLINED_BG_HOVER,
    borderColor: TASK_FORM_PILL_OUTLINE_BORDER_HOVER,
  },
};

export const taskFormPillSolidSx = {
  ...taskFormPillBaseSx,
  border: 'none',
  bgcolor: TASK_FORM_PILL_FILL_BG,
  color: 'text.primary',
  '&:hover:not(:disabled)': {
    bgcolor: TASK_FORM_PILL_FILL_BG_HOVER,
  },
};

export const taskFormFixedPillSx = {
  width: TASK_FORM_STANDARD_PILL_WIDTH,
  minWidth: TASK_FORM_STANDARD_PILL_WIDTH,
  maxWidth: TASK_FORM_STANDARD_PILL_WIDTH,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

export const taskFormDatePillSx = {
  ...taskFormFixedPillSx,
  justifyContent: 'center',
  textAlign: 'center',
};

/** Date pill: full width on mobile, fixed width on desktop. */
export const taskFormScheduleDatePillResponsiveSx = {
  ...taskFormDatePillSx,
  width: { xs: '100%', sm: TASK_FORM_STANDARD_PILL_WIDTH },
  minWidth: { xs: 0, sm: TASK_FORM_STANDARD_PILL_WIDTH },
  maxWidth: { xs: '100%', sm: TASK_FORM_STANDARD_PILL_WIDTH },
};

export const taskFormDatePillColumnSx = {
  ...taskFormFixedPillSx,
  flexShrink: 0,
  textAlign: 'center',
};

export const taskFormSchedulePillButtonSx = {
  ...taskFormPillOutlinedSx,
};

export const taskFormSettingsPillButtonSx = {
  ...taskFormSchedulePillButtonSx,
};

/** Fixed-width settings pill (estado, objetivo): capsule, 32px, 180px, left-aligned. */
export const taskFormSettingsPillSx = {
  ...taskFormPillOutlinedSx,
  ...taskFormFixedPillSx,
  justifyContent: 'flex-start',
  textAlign: 'left',
};

export const taskFormFixedSelectPillSx = taskFormSettingsPillSx;

export const taskFormGrowingSelectPillSx = {
  ...taskFormSettingsPillButtonSx,
  justifyContent: 'flex-start',
  textAlign: 'left',
  width: 'auto',
  minWidth: TASK_FORM_STANDARD_PILL_WIDTH,
  maxWidth: TASK_FORM_OBJETIVO_PILL_MAX_WIDTH,
};

/** Full-width objetivo pill inside the objetivo/subtareas group. */
export const taskFormObjetivoSubtareasPillSelectSx = {
  width: '100%',
  maxWidth: '100%',
  '& .MuiSelect-select': {
    ...taskFormGrowingSelectPillSx,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
};

export const taskFormPillSelectFieldSx = {
  width: 'auto',
  maxWidth: '100%',
  alignSelf: 'flex-start',
  flexShrink: 0,
  '& .MuiInputBase-root': {
    height: TASK_FORM_PILL_HEIGHT,
    minHeight: TASK_FORM_PILL_HEIGHT,
    alignItems: 'center',
  },
  '& .MuiSelect-select': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    textAlign: 'left',
    height: TASK_FORM_PILL_HEIGHT,
    minHeight: TASK_FORM_PILL_HEIGHT,
    lineHeight: 1,
    pt: 0,
    pb: 0,
    py: 0,
    pr: '32px !important',
    boxSizing: 'border-box',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    '& em': {
      fontStyle: 'normal',
      display: 'inline-flex',
      alignItems: 'center',
      lineHeight: 1,
      minHeight: '100%',
    },
  },
  '& .MuiInputBase-root:hover .MuiSelect-select:not(.Mui-disabled)': {
    bgcolor: TASK_FORM_PILL_OUTLINED_BG_HOVER,
    borderColor: TASK_FORM_PILL_OUTLINE_BORDER_HOVER,
  },
  '& .MuiSelect-icon': {
    right: 8,
    color: 'text.secondary',
    fontSize: TASK_FORM_ICON_SIZE,
  },
};

export const taskFormReadOnlyBodyLineSx = {
  ...taskFormBodyTextSx,
  color: 'text.primary',
  textAlign: 'left',
};

export const taskFormReadOnlyMetaLineSx = {
  ...taskFormPillTextSx,
  color: 'text.primary',
  textAlign: 'left',
};

export const taskFormReadOnlySeparatorSx = {
  ...taskFormCaptionTextSx,
  px: 0.5,
  userSelect: 'none',
};

export const taskFormPickerPopoverPaperSx = {
  borderRadius: 2,
  bgcolor: 'background.default',
  boxShadow: (t) => t.shadows[8],
  mt: 0.5,
  overflow: 'hidden',
};

export const taskFormAllDaySwitchGroupSx = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.75,
  alignSelf: 'center',
};

export const taskFormAllDaySwitchControlSx = {
  mx: -0.5,
  '& .MuiSwitch-switchBase.Mui-checked': {
    color: 'warning.main',
    '& + .MuiSwitch-track': {
      bgcolor: (theme) => alpha(theme.palette.warning.main, 0.45),
      opacity: 1,
    },
  },
  '& .MuiSwitch-switchBase.Mui-checked.Mui-disabled': {
    color: (theme) => alpha(theme.palette.warning.main, 0.55),
    '& + .MuiSwitch-track': {
      bgcolor: (theme) => alpha(theme.palette.warning.main, 0.28),
      opacity: 1,
    },
  },
};

// tareaForm aliases (prefer tareaForm* in new code)
export { taskFormTitleTextSx as tareaFormTitleTextSx };
export { taskFormBodyTextSx as tareaFormBodyTextSx };
export { taskFormPillTextSx as tareaFormPillTextSx };
export { taskFormCaptionTextSx as tareaFormCaptionTextSx };
export { taskFormFieldInputSx as tareaFormFieldInputSx };
export { taskFormSwitchLabelSx as tareaFormSwitchLabelSx };
export { taskFormErrorTextSx as tareaFormErrorTextSx };
export { taskFormPillIconSx as tareaFormPillIconSx };
export { taskFormPillChevronSx as tareaFormPillChevronSx };
export { taskFormActionIconSx as tareaFormActionIconSx };
export { taskFormSubtaskCheckIconSx as tareaFormSubtaskCheckIconSx };
export { taskFormInlineAttachmentIconSx as tareaFormInlineAttachmentIconSx };
export { taskFormPillRowSx as tareaFormPillRowSx };
export { taskFormScheduleStackSx as tareaFormScheduleStackSx };
export { taskFormScheduleExpandedContentSx as tareaFormScheduleExpandedContentSx };
export { taskFormScheduleDatePillResponsiveSx as tareaFormScheduleDatePillResponsiveSx };
export { taskFormScheduleControlsRowSx as tareaFormScheduleControlsRowSx };
export { taskFormScheduleRecurrenceWrapSx as tareaFormScheduleRecurrenceWrapSx };
export { taskFormRowContentIndent as tareaFormRowContentIndent };
export { taskFormSubtaskRowSx as tareaFormSubtaskRowSx };
export { taskFormSubtaskListSx as tareaFormSubtaskListSx };
export { taskFormObjetivoSubtareasSectionSx as tareaFormObjetivoSubtareasSectionSx };
export { taskFormObjetivoSubtareasContentSx as tareaFormObjetivoSubtareasContentSx };
export { taskFormObjetivoSubtareasPillSelectSx as tareaFormObjetivoSubtareasPillSelectSx };
export { taskFormTimeSeparatorSx as tareaFormTimeSeparatorSx };
export { taskFormChipSx as tareaFormChipSx };
export { taskFormDialogPaperSx as tareaFormDialogPaperSx };
export { getTaskFormDialogSx as getTareaFormDialogSx };
export { taskFormGooglePaperSx as tareaFormGooglePaperSx };
export { taskFormTitleFieldSx as tareaFormTitleFieldSx };
export { taskFormStandardFieldSx as tareaFormStandardFieldSx };
export { taskFormRowIconSx as tareaFormRowIconSx };
export { taskFormPrimaryTextSx as tareaFormPrimaryTextSx };
export { taskFormSecondaryTextSx as tareaFormSecondaryTextSx };
export { taskFormRowIconColumnSx as tareaFormRowIconColumnSx };
export { taskFormHeaderActionIconSx as tareaFormHeaderActionIconSx };
export { taskFormHeaderActionColumnSx as tareaFormHeaderActionColumnSx };
export { taskFormRowActionColumnSx as tareaFormRowActionColumnSx };
export { taskFormRowWithActionSx as tareaFormRowWithActionSx };
export { taskFormRowContentGutterSx as tareaFormRowContentGutterSx };
export { taskFormHeaderIconSpacerSx as tareaFormHeaderIconSpacerSx };
export { taskFormHeaderActionSpacerSx as tareaFormHeaderActionSpacerSx };
export { taskFormHeaderContentRowSx as tareaFormHeaderContentRowSx };
export { taskFormSaveButtonSx as tareaFormSaveButtonSx };
export { taskFormPillOutlinedSx as tareaFormPillOutlinedSx };
export { taskFormPillSolidSx as tareaFormPillSolidSx };
export { taskFormFixedPillSx as tareaFormFixedPillSx };
export { taskFormDatePillSx as tareaFormDatePillSx };
export { taskFormDatePillColumnSx as tareaFormDatePillColumnSx };
export { taskFormSchedulePillButtonSx as tareaFormSchedulePillButtonSx };
export { taskFormSettingsPillButtonSx as tareaFormSettingsPillButtonSx };
export { taskFormSettingsPillSx as tareaFormSettingsPillSx };
export { taskFormFixedSelectPillSx as tareaFormFixedSelectPillSx };
export { taskFormGrowingSelectPillSx as tareaFormGrowingSelectPillSx };
export { taskFormPillSelectFieldSx as tareaFormPillSelectFieldSx };
export { taskFormReadOnlyBodyLineSx as tareaFormReadOnlyBodyLineSx };
export { taskFormReadOnlyMetaLineSx as tareaFormReadOnlyMetaLineSx };
export { taskFormReadOnlySeparatorSx as tareaFormReadOnlySeparatorSx };
export { taskFormPickerPopoverPaperSx as tareaFormPickerPopoverPaperSx };
export { taskFormAllDaySwitchGroupSx as tareaFormAllDaySwitchGroupSx };
export { taskFormAllDaySwitchControlSx as tareaFormAllDaySwitchControlSx };
export { TASK_FORM_TITLE_FONT_SIZE as TAREA_FORM_TITLE_FONT_SIZE };
export { TASK_FORM_TITLE_LINE_HEIGHT as TAREA_FORM_TITLE_LINE_HEIGHT };
export { TASK_FORM_TITLE_FONT_WEIGHT as TAREA_FORM_TITLE_FONT_WEIGHT };
export { TASK_FORM_BODY_FONT_SIZE as TAREA_FORM_BODY_FONT_SIZE };
export { TASK_FORM_BODY_LINE_HEIGHT as TAREA_FORM_BODY_LINE_HEIGHT };
export { TASK_FORM_PILL_FONT_SIZE as TAREA_FORM_PILL_FONT_SIZE };
export { TASK_FORM_PILL_LINE_HEIGHT as TAREA_FORM_PILL_LINE_HEIGHT };
export { TASK_FORM_PILL_FONT_WEIGHT as TAREA_FORM_PILL_FONT_WEIGHT };
export { TASK_FORM_CAPTION_FONT_SIZE as TAREA_FORM_CAPTION_FONT_SIZE };
export { TASK_FORM_CAPTION_LINE_HEIGHT as TAREA_FORM_CAPTION_LINE_HEIGHT };
export { TASK_FORM_BUTTON_FONT_SIZE as TAREA_FORM_BUTTON_FONT_SIZE };
export { TASK_FORM_BUTTON_FONT_WEIGHT as TAREA_FORM_BUTTON_FONT_WEIGHT };
export { TASK_FORM_ICON_SIZE as TAREA_FORM_ICON_SIZE };
export { TASK_FORM_PILL_ICON_SIZE as TAREA_FORM_PILL_ICON_SIZE };
export { TASK_FORM_CHEVRON_ICON_SIZE as TAREA_FORM_CHEVRON_ICON_SIZE };
export { TASK_FORM_ACTION_ICON_SIZE as TAREA_FORM_ACTION_ICON_SIZE };
export { TASK_FORM_SUBTASK_CHECK_ICON_SIZE as TAREA_FORM_SUBTASK_CHECK_ICON_SIZE };
export { TASK_FORM_INLINE_ATTACHMENT_ICON_SIZE as TAREA_FORM_INLINE_ATTACHMENT_ICON_SIZE };
export { TASK_FORM_PILL_HEIGHT as TAREA_FORM_PILL_HEIGHT };
export { TASK_FORM_PILL_BORDER_RADIUS as TAREA_FORM_PILL_BORDER_RADIUS };
export { TASK_FORM_PILL_CHIP_BORDER_RADIUS as TAREA_FORM_PILL_CHIP_BORDER_RADIUS };
export { TASK_FORM_PILL_GAP as TAREA_FORM_PILL_GAP };
export { TASK_FORM_STANDARD_PILL_WIDTH as TAREA_FORM_STANDARD_PILL_WIDTH };
export { TASK_FORM_OBJETIVO_PILL_MAX_WIDTH as TAREA_FORM_OBJETIVO_PILL_MAX_WIDTH };
export { TASK_FORM_PILL_BORDER_WIDTH as TAREA_FORM_PILL_BORDER_WIDTH };
export { TASK_FORM_PILL_OUTLINE_BORDER as TAREA_FORM_PILL_OUTLINE_BORDER };
export { TASK_FORM_PILL_OUTLINE_BORDER_HOVER as TAREA_FORM_PILL_OUTLINE_BORDER_HOVER };
export { TASK_FORM_PILL_OUTLINED_BG as TAREA_FORM_PILL_OUTLINED_BG };
export { TASK_FORM_PILL_OUTLINED_BG_HOVER as TAREA_FORM_PILL_OUTLINED_BG_HOVER };
export { TASK_FORM_PILL_FILL_BG as TAREA_FORM_PILL_FILL_BG };
export { TASK_FORM_PILL_FILL_BG_HOVER as TAREA_FORM_PILL_FILL_BG_HOVER };
export { TASK_FORM_ROW_MIN_HEIGHT as TAREA_FORM_ROW_MIN_HEIGHT };
export { TASK_FORM_ROW_PY as TAREA_FORM_ROW_PY };
export { TASK_FORM_ROW_GAP as TAREA_FORM_ROW_GAP };
export { TASK_FORM_ROW_ICON_TOP_OFFSET as TAREA_FORM_ROW_ICON_TOP_OFFSET };
export { TASK_FORM_HORIZONTAL_PX as TAREA_FORM_HORIZONTAL_PX };
export { TASK_FORM_ICON_COLUMN_WIDTH as TAREA_FORM_ICON_COLUMN_WIDTH };
export { TASK_FORM_HEADER_ACTION_GUTTER as TAREA_FORM_HEADER_ACTION_GUTTER };
export { TASK_FORM_HEADER_ACTION_GAP as TAREA_FORM_HEADER_ACTION_GAP };
export { TASK_FORM_HEADER_ACTION_COLUMN_WIDTH as TAREA_FORM_HEADER_ACTION_COLUMN_WIDTH };
export { TASK_FORM_ACTION_COLUMN_WIDTH as TAREA_FORM_ACTION_COLUMN_WIDTH };
export { TASK_FORM_TIPO_EVENTO_TAREA as TAREA_FORM_TIPO_EVENTO_TAREA };
export { TASK_FORM_TIPO_ALL as TAREA_FORM_TIPO_ALL };
export { TASK_FORM_ESTADO_OPTIONS as TAREA_FORM_ESTADO_OPTIONS };
export { TASK_FORM_ESTADO_CANCELADA_OPTION as TAREA_FORM_ESTADO_CANCELADA_OPTION };
export { TASK_FORM_OBJETIVO_ESTADO_OPTIONS as TAREA_FORM_OBJETIVO_ESTADO_OPTIONS };
