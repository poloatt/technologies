import React from 'react';
import {
  Box,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  AttachFile as AttachFileIcon,
  KeyboardArrowDown as ChevronDownIcon,
} from '@mui/icons-material';
import { TareaFormIcons } from './tareaFormIcons';
import { getEstadoColor } from '../common/StatusSystem';
import {
  TASK_FORM_ICON_SIZE,
  TASK_FORM_PILL_BORDER_WIDTH,
  TASK_FORM_PILL_GAP,
  TASK_FORM_PILL_HEIGHT,
  TASK_FORM_PILL_OUTLINE_BORDER,
  TASK_FORM_PILL_OUTLINE_BORDER_HOVER,
  TASK_FORM_PILL_OUTLINED_BG,
  TASK_FORM_PILL_OUTLINED_BG_HOVER,
  TASK_FORM_PILL_BORDER_RADIUS,
  TASK_FORM_ESTADO_OPTIONS,
  TASK_FORM_TIPO_ALL,
  TASK_FORM_TIPO_EVENTO_TAREA,
  taskFormChipSx,
  taskFormGrowingSelectPillSx,
  taskFormSettingsPillSx,
  taskFormHeaderActionColumnSx,
  taskFormHeaderActionIconSx,
  taskFormPillIconSx,
  taskFormPillOutlinedSx,
  taskFormPillSelectFieldSx,
  taskFormPillSolidSx,
  taskFormSchedulePillButtonSx,
  taskFormSettingsPillButtonSx,
  taskFormAllDaySwitchControlSx,
  taskFormAllDaySwitchGroupSx,
  taskFormSwitchLabelSx,
} from './tareaFormTokens';

const TASK_FORM_CREATE_OPTION = '__task_form_create__';
const TASK_FORM_TIPO_SEGMENT_PADDING_X = 1.25;

const taskFormPriorityToggleIconSx = (isHigh) =>
  taskFormHeaderActionIconSx(isHigh ? 'error.main' : 'text.secondary');

const taskFormHeaderActionIconHoverSx = (isHigh = false) => ({
  bgcolor: 'transparent',
  color: isHigh ? 'error.main' : 'text.primary',
  ...(isHigh ? { opacity: 0.85 } : null),
});

export function TareaFormPriorityToggle({
  prioridad = 'BAJA',
  checked,
  onChange,
  readOnly = false,
  disabled = false,
  hideWhenLow = false,
  sx,
}) {
  const isHigh = checked ?? prioridad === 'ALTA';

  if (readOnly && hideWhenLow && !isHigh) {
    return null;
  }

  const iconSx = taskFormPriorityToggleIconSx(isHigh);
  const icon = <TareaFormIcons.prioridad sx={taskFormPillIconSx} />;

  if (readOnly) {
    return (
      <Box
        component="span"
        aria-label="Prioridad alta"
        sx={{
          ...taskFormHeaderActionColumnSx,
          ...iconSx,
          pointerEvents: 'none',
          ...sx,
        }}
      >
        {icon}
      </Box>
    );
  }

  return (
    <IconButton
      size="small"
      onClick={() => onChange?.(isHigh ? 'BAJA' : 'ALTA')}
      disabled={disabled}
      aria-label={isHigh ? 'Quitar prioridad alta' : 'Marcar prioridad alta'}
      aria-pressed={isHigh}
      sx={{
        ...taskFormHeaderActionColumnSx,
        ...iconSx,
        '&:hover:not(:disabled)': taskFormHeaderActionIconHoverSx(isHigh),
        ...sx,
      }}
    >
      {icon}
    </IconButton>
  );
}

export function TareaFormAttachButton({ onChange, disabled = false, sx }) {
  return (
    <Box
      component="label"
      sx={{
        ...taskFormHeaderActionColumnSx,
        cursor: disabled ? 'default' : 'pointer',
        ...sx,
      }}
    >
      <IconButton
        component="span"
        size="small"
        disabled={disabled}
        aria-label="Adjuntar"
        tabIndex={-1}
        sx={{
          ...taskFormHeaderActionIconSx(),
          '&:hover:not(:disabled)': taskFormHeaderActionIconHoverSx(),
        }}
      >
        <AttachFileIcon sx={taskFormPillIconSx} />
      </IconButton>
      <input type="file" hidden multiple onChange={onChange} disabled={disabled} />
    </Box>
  );
}

TareaFormPriorityToggle.isButtonComponent = true;
TareaFormAttachButton.isButtonComponent = true;

export function TareaFormPillSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar',
  error,
  helperText,
  required,
  emptyLabel = 'Sin objetivo',
  onCreate,
  createLabel = 'Nuevo objetivo',
  pillWidth = 'fixed',
  showEmptyOption = true,
}) {
  const selectPillSx = pillWidth === 'grow'
    ? taskFormGrowingSelectPillSx
    : taskFormSettingsPillSx;

  const handleChange = (event) => {
    if (event.target.value === TASK_FORM_CREATE_OPTION) {
      onCreate?.();
      return;
    }
    onChange?.(event);
  };

  return (
    <TextField
      select
      variant="standard"
      value={value || ''}
      onChange={handleChange}
      error={!!error}
      helperText={helperText || error}
      required={required}
      SelectProps={{
        displayEmpty: true,
        IconComponent: ChevronDownIcon,
      }}
      InputProps={{
        disableUnderline: true,
      }}
      sx={[
        taskFormPillSelectFieldSx,
        {
          '& .MuiSelect-select': {
            ...selectPillSx,
            color: value ? 'text.primary' : 'text.secondary',
          },
        },
      ]}
    >
      {showEmptyOption ? (
        <MenuItem value="">
          <em>{emptyLabel}</em>
        </MenuItem>
      ) : null}
      {options.map((opt) => (
        <MenuItem key={opt.value} value={opt.value}>
          {opt.label}
        </MenuItem>
      ))}
      {onCreate ? (
        <MenuItem
          value={TASK_FORM_CREATE_OPTION}
          sx={{
            color: 'primary.main',
            fontWeight: 500,
            borderTop: 1,
            borderColor: 'divider',
            mt: 0.5,
          }}
        >
          {createLabel}
        </MenuItem>
      ) : null}
    </TextField>
  );
}

export function TareaFormTipoSelector({
  value,
  onChange,
  options = TASK_FORM_TIPO_EVENTO_TAREA,
  readOnly = false,
  disabled = false,
  sx,
}) {
  const isInteractive = !readOnly && !disabled && typeof onChange === 'function';

  return (
    <Box
      role="group"
      aria-label="Tipo"
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        width: '100%',
        height: TASK_FORM_PILL_HEIGHT,
        minHeight: TASK_FORM_PILL_HEIGHT,
        borderRadius: TASK_FORM_PILL_BORDER_RADIUS,
        border: `${TASK_FORM_PILL_BORDER_WIDTH} solid ${TASK_FORM_PILL_OUTLINE_BORDER}`,
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...(readOnly || disabled ? { pointerEvents: 'none', opacity: readOnly ? 0.92 : 0.45 } : null),
        ...sx,
      }}
    >
      {options.map((segment, index) => {
        const selected = value === segment.value;
        const isLast = index === options.length - 1;

        return (
          <Box
            key={segment.value}
            component={isInteractive ? 'button' : 'span'}
            type={isInteractive ? 'button' : undefined}
            onClick={isInteractive ? () => onChange(segment.value) : undefined}
            aria-label={segment.label}
            aria-pressed={selected}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'stretch',
              width: '100%',
              minWidth: 0,
              minHeight: TASK_FORM_PILL_HEIGHT,
              height: '100%',
              px: TASK_FORM_TIPO_SEGMENT_PADDING_X,
              py: 0,
              m: 0,
              border: 'none',
              borderRight: isLast
                ? 'none'
                : `${TASK_FORM_PILL_BORDER_WIDTH} solid ${TASK_FORM_PILL_OUTLINE_BORDER}`,
              boxSizing: 'border-box',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              fontSize: taskFormPillOutlinedSx.fontSize,
              lineHeight: 1,
              fontWeight: selected ? 500 : 400,
              bgcolor: selected ? 'action.selected' : 'transparent',
              color: selected ? 'text.primary' : 'text.secondary',
              cursor: isInteractive ? 'pointer' : 'default',
              transition: 'background-color 0.15s ease',
              fontFamily: 'inherit',
              '&:hover': isInteractive
                ? { bgcolor: selected ? 'action.selected' : TASK_FORM_PILL_OUTLINED_BG_HOVER }
                : undefined,
            }}
          >
            {segment.label}
          </Box>
        );
      })}
    </Box>
  );
}

export function TaskFormEstadoRow({
  value,
  onChange,
  options = TASK_FORM_ESTADO_OPTIONS,
  entityType = 'TAREA',
  readOnly = false,
  disabled = false,
  sx,
}) {
  const isInteractive = !readOnly && !disabled && typeof onChange === 'function';
  const currentValue = value || options[0]?.value || 'PENDIENTE';

  return (
    <Box
      role="group"
      aria-label="Estado"
      sx={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'center',
        gap: TASK_FORM_PILL_GAP,
        width: '100%',
        minWidth: 0,
        ...(readOnly || disabled ? { pointerEvents: 'none', opacity: readOnly ? 0.92 : 0.45 } : null),
        ...sx,
      }}
    >
      {options.map((opt) => {
        const selected = currentValue === opt.value;
        const estadoBorderColor = getEstadoColor(opt.value, entityType);

        return (
          <Box
            key={opt.value}
            component={isInteractive ? 'button' : 'span'}
            type={isInteractive ? 'button' : undefined}
            onClick={isInteractive ? () => onChange(opt.value) : undefined}
            aria-label={opt.label}
            aria-pressed={selected}
            sx={{
              ...taskFormSettingsPillSx,
              flex: '1 1 0',
              minWidth: 0,
              width: 'auto',
              maxWidth: 'none',
              justifyContent: 'center',
              textAlign: 'center',
              px: 1,
              fontWeight: selected ? 500 : 400,
              bgcolor: selected ? 'action.selected' : TASK_FORM_PILL_OUTLINED_BG,
              color: selected ? 'text.primary' : 'text.secondary',
              borderColor: selected ? estadoBorderColor : TASK_FORM_PILL_OUTLINE_BORDER,
              cursor: isInteractive ? 'pointer' : 'default',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              '&:hover': isInteractive
                ? {
                  bgcolor: selected ? 'action.selected' : TASK_FORM_PILL_OUTLINED_BG_HOVER,
                  borderColor: selected ? estadoBorderColor : TASK_FORM_PILL_OUTLINE_BORDER_HOVER,
                }
                : undefined,
            }}
          >
            {opt.label}
          </Box>
        );
      })}
    </Box>
  );
}

export function TaskTipoChips({ value, onChange, options, sx }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: TASK_FORM_PILL_GAP, ...sx }}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Chip
            key={opt.value}
            label={opt.label}
            size="small"
            onClick={() => onChange(opt.value)}
            variant={selected ? 'filled' : 'outlined'}
            sx={{
              ...taskFormChipSx,
              fontWeight: selected ? 500 : 400,
              borderColor: selected ? 'transparent' : TASK_FORM_PILL_OUTLINE_BORDER,
              bgcolor: selected ? 'action.selected' : 'transparent',
              color: selected ? 'text.primary' : 'text.secondary',
              '&:hover': {
                bgcolor: selected ? 'action.selected' : TASK_FORM_PILL_OUTLINED_BG_HOVER,
                borderColor: selected ? 'transparent' : TASK_FORM_PILL_OUTLINE_BORDER,
              },
            }}
          />
        );
      })}
    </Box>
  );
}

export const TareaFormPillButton = React.forwardRef(function TareaFormPillButton(
  {
    children,
    onClick,
    disabled = false,
    variant = 'schedule',
    component = 'button',
    sx,
    'aria-label': ariaLabel,
  },
  ref,
) {
  const variantSx = variant === 'solid'
    ? taskFormPillSolidSx
    : variant === 'settings'
      ? taskFormSettingsPillButtonSx
      : taskFormSchedulePillButtonSx;

  return (
    <Box
      ref={ref}
      component={component}
      type={component === 'button' ? 'button' : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={component === 'button' ? disabled : undefined}
      aria-label={ariaLabel}
      aria-disabled={component !== 'button' && disabled ? true : undefined}
      sx={{ ...variantSx, ...sx }}
    >
      {children}
    </Box>
  );
});

export function TareaFormAllDaySwitch({
  checked,
  onChange,
  label = 'Todo el día',
  disabled = false,
  readOnly = false,
  hideWhenOff = false,
  sx,
}) {
  if (readOnly && hideWhenOff && !checked) {
    return null;
  }

  const labelColor = disabled && !readOnly ? 'text.disabled' : 'text.primary';
  const isInteractive = !readOnly && !disabled && typeof onChange === 'function';

  return (
    <FormControlLabel
      labelPlacement="start"
      label={(
        <Typography component="span" sx={taskFormSwitchLabelSx} color={labelColor}>
          {label}
        </Typography>
      )}
      control={(
        <Switch
          size="small"
          checked={checked}
          onChange={isInteractive ? (e) => onChange(e.target.checked) : undefined}
          disabled={disabled || readOnly}
          inputProps={{
            'aria-label': checked ? 'Quitar todo el día' : label,
          }}
          sx={taskFormAllDaySwitchControlSx}
        />
      )}
      sx={{
        m: 0,
        mx: 0,
        flexShrink: 0,
        gap: 0.75,
        alignItems: 'center',
        cursor: isInteractive ? 'pointer' : 'default',
        userSelect: 'none',
        ...taskFormAllDaySwitchGroupSx,
        ...sx,
      }}
    />
  );
}
