import React from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useKeyboardInset, useResponsive } from '@shared/hooks';
import { keyboardAwareFooterSx } from './keyboardAwareFooterSx';
import {
  TASK_FORM_ROW_GAP,
  TASK_FORM_ROW_MIN_HEIGHT,
  TASK_FORM_ROW_PY,
  TASK_FORM_HORIZONTAL_PX,
  TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
  TASK_FORM_PILL_HEIGHT,
  taskFormBodyTextSx,
  taskFormCaptionTextSx,
  taskFormHeaderContentRowSx,
  taskFormPillTextSx,
  taskFormReadOnlyBodyLineSx,
  taskFormReadOnlyMetaLineSx,
  taskFormReadOnlySeparatorSx,
  taskFormRowIconColumnSx,
  taskFormRowIconSx,
  taskFormSaveButtonSx,
  taskFormSchedulePillButtonSx,
  taskFormSettingsPillButtonSx,
} from './tareaFormTokens';

export function TareaFormPrimaryLine({ children, onClick, sx }) {
  const content = (
    <Typography variant="body2" sx={{ ...taskFormBodyTextSx, ...sx }}>
      {children}
    </Typography>
  );
  if (onClick) {
    return (
      <Box
        component="button"
        type="button"
        onClick={onClick}
        sx={{
          border: 'none',
          background: 'none',
          p: 0,
          m: 0,
          textAlign: 'left',
          cursor: 'pointer',
          color: 'text.primary',
          font: 'inherit',
          width: '100%',
          '&:hover': { opacity: 0.85 },
        }}
      >
        {content}
      </Box>
    );
  }
  return content;
}

export function TareaFormSecondaryLine({ children, sx }) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: 'block', ...taskFormCaptionTextSx, mt: 0.25, ...sx }}
    >
      {children}
    </Typography>
  );
}

export function TareaFormRow({ icon: Icon, children, showDivider = false, align = 'flex-start', compact = false }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        gap: Icon ? TASK_FORM_ROW_GAP : 0,
        py: compact ? 0 : TASK_FORM_ROW_PY,
        minHeight: compact ? TASK_FORM_PILL_HEIGHT : TASK_FORM_ROW_MIN_HEIGHT,
        borderBottom: showDivider ? 1 : 0,
        borderColor: 'divider',
      }}
    >
      {Icon ? (
        <Box sx={taskFormRowIconColumnSx(align)}>
          <Icon sx={taskFormRowIconSx} />
        </Box>
      ) : null}
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

export function TareaFormHeaderTitleRow({ children, action, leading, sx }) {
  const hasAction = action != null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: leading ? TASK_FORM_ROW_GAP : 0,
        width: '100%',
        ...sx,
      }}
    >
      {leading ? (
        <Box
          sx={{
            width: 40,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mt: 0.75,
          }}
        >
          {leading}
        </Box>
      ) : null}
      <Box sx={{
        ...(hasAction ? taskFormHeaderContentRowSx : { flex: 1, minWidth: 0, width: '100%' }),
        flex: 1,
        minWidth: 0,
      }}>
        {hasAction ? (
          <>
            {children}
            {action}
          </>
        ) : children}
      </Box>
    </Box>
  );
}

export function TareaFormHeaderContentRow({ children, action, sx }) {
  const hasAction = action != null;

  return (
    <Box sx={{
      ...(hasAction ? taskFormHeaderContentRowSx : { width: '100%', minWidth: 0 }),
      ...sx,
    }}>
      {hasAction ? (
        <>
          {children}
          {action}
        </>
      ) : children}
    </Box>
  );
}

export function TareaFormHeader({
  onClose,
  closeLabel = 'Cerrar',
  children,
  sx,
}) {
  const hasClose = Boolean(onClose);

  return (
    <Box
      sx={{
        position: 'relative',
        pl: TASK_FORM_HORIZONTAL_PX,
        pr: hasClose
          ? (theme) => `calc(${theme.spacing(TASK_FORM_HORIZONTAL_PX)} + ${TASK_FORM_HEADER_ACTION_COLUMN_WIDTH}px)`
          : TASK_FORM_HORIZONTAL_PX,
        pt: 1.5,
        pb: 0.5,
        ...sx,
      }}
    >
      {hasClose && (
        <IconButton
          size="small"
          onClick={onClose}
          aria-label={closeLabel}
          sx={{
            position: 'absolute',
            top: (theme) => theme.spacing(1.5),
            right: (theme) => theme.spacing(TASK_FORM_HORIZONTAL_PX),
            zIndex: 2,
            width: TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
            height: TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
            p: 0,
            color: 'text.secondary',
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
      {children}
    </Box>
  );
}

export function TareaFormFooter({
  onSave,
  saveLabel = 'Guardar',
  saving = false,
  disabled = false,
  leftAction,
  onCancel,
  cancelLabel = 'Cancelar',
  showCancel = false,
  keyboardAware = true,
  pinned = false,
}) {
  const { isMobile } = useResponsive();
  const keyboardEnabled = keyboardAware && isMobile;
  const { inset, isKeyboardOpen } = useKeyboardInset({ enabled: keyboardEnabled });

  return (
    <Box
      sx={keyboardAwareFooterSx({
        inset,
        isKeyboardOpen,
        pinned,
        sx: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 1,
          px: TASK_FORM_HORIZONTAL_PX,
          py: 1.5,
          mt: pinned ? 0 : 0.5,
          ...(pinned
            ? {
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              pb: 'max(12px, env(safe-area-inset-bottom, 0px))',
            }
            : {}),
        },
      })}
    >
      {leftAction && <Box sx={{ mr: 'auto' }}>{leftAction}</Box>}
      {showCancel && onCancel && (
        <Button
          size="small"
          onClick={onCancel}
          sx={{ textTransform: 'none', color: 'text.secondary', mr: 'auto', ...taskFormPillTextSx }}
        >
          {cancelLabel}
        </Button>
      )}
      <Button
        size="small"
        variant="contained"
        disabled={disabled || saving}
        onClick={onSave}
        sx={taskFormSaveButtonSx}
      >
        {saveLabel}
      </Button>
    </Box>
  );
}

export function TareaFormSectionLabel({ children }) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: 'block', mb: 0.5, ...taskFormCaptionTextSx }}
    >
      {children}
    </Typography>
  );
}

export function TareaFormReadOnlyLine({ children, component = 'span', variant = 'meta', sx }) {
  const variantSx = variant === 'body' ? taskFormReadOnlyBodyLineSx : taskFormReadOnlyMetaLineSx;

  return (
    <Typography
      component={component}
      variant="body2"
      sx={{ ...variantSx, ...sx }}
    >
      {children}
    </Typography>
  );
}

export function TareaFormReadOnlySeparator({ children = '·' }) {
  return (
    <Typography component="span" variant="body2" sx={taskFormReadOnlySeparatorSx}>
      {children}
    </Typography>
  );
}

export function TareaFormReadOnlyPill({ children, variant = 'settings', sx }) {
  if (variant === 'flat') {
    return <TareaFormReadOnlyLine sx={sx}>{children}</TareaFormReadOnlyLine>;
  }

  const variantSx = variant === 'schedule'
    ? taskFormSchedulePillButtonSx
    : taskFormSettingsPillButtonSx;

  return (
    <Box
      component="span"
      sx={{
        ...variantSx,
        cursor: 'default',
        pointerEvents: 'none',
        '&:hover': { bgcolor: variantSx.bgcolor },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
