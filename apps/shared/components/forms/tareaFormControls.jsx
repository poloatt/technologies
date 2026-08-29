import React, { useState } from 'react';
import {
  Box,
  Chip,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  AttachFile as AttachFileIcon,
  KeyboardArrowDown as ChevronDownIcon,
} from '@mui/icons-material';
import { TareaFormIcons } from './tareaFormIcons';
import { getEstadoColor } from '../common/StatusSystem';
import {
  TASK_FORM_ICON_SIZE,
  TASK_FORM_PILL_GAP,
  TASK_FORM_PILL_OUTLINE_BORDER,
  TASK_FORM_PILL_OUTLINE_BORDER_HOVER,
  TASK_FORM_PILL_OUTLINED_BG,
  TASK_FORM_PILL_OUTLINED_BG_HOVER,
  TASK_FORM_PILL_FILL_BG,
  TASK_FORM_ESTADO_OPTIONS,
  TASK_FORM_TIPO_ALL,
  TASK_FORM_TIPO_EVENTO_TAREA,
  TASK_FORM_STANDARD_PILL_WIDTH,
  TASK_FORM_OBJETIVO_PILL_MAX_WIDTH,
  taskFormChipSx,
  taskFormSettingsPillSx,
  taskFormHeaderActionColumnSx,
  taskFormHeaderActionIconSx,
  taskFormPillIconSx,
  taskFormPillChevronSx,
  taskFormPillSolidSx,
  taskFormFixedPillSx,
  taskFormSchedulePillButtonSx,
  taskFormSettingsPillButtonSx,
  taskFormAllDaySwitchControlSx,
  taskFormAllDaySwitchGroupSx,
  taskFormSwitchLabelSx,
  taskFormTipoFloatingLabelSx,
} from './tareaFormTokens';

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

export function TareaFormTipoSelector({
  value,
  onChange,
  options = TASK_FORM_TIPO_EVENTO_TAREA,
  readOnly = false,
  disabled = false,
  sx,
}) {
  const isInteractive = !readOnly && !disabled && typeof onChange === 'function';
  const selectedOption =
    options.find((segment) => segment.value === value)
    || options.find((segment) => segment.value === 'TAREA')
    || options[0];

  if (readOnly) {
    return (
      <Typography
        component="span"
        aria-label={`Tipo: ${selectedOption?.label || ''}`}
        sx={{
          ...taskFormTipoFloatingLabelSx,
          ...(disabled ? { opacity: 0.45 } : null),
          ...sx,
        }}
      >
        {selectedOption?.label}
      </Typography>
    );
  }

  return (
    <Box
      role="group"
      aria-label="Tipo"
      sx={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'center',
        gap: TASK_FORM_PILL_GAP,
        width: '100%',
        minWidth: 0,
        ...(disabled ? { pointerEvents: 'none', opacity: 0.45 } : null),
        ...sx,
      }}
    >
      {options.map((segment) => {
        const selected = value === segment.value;

        return (
          <Box
            key={segment.value}
            component={isInteractive ? 'button' : 'span'}
            type={isInteractive ? 'button' : undefined}
            onClick={isInteractive ? () => onChange(segment.value) : undefined}
            aria-label={segment.label}
            aria-pressed={selected}
            sx={{
              ...taskFormSettingsPillSx,
              flex: '1 1 0',
              minWidth: 0,
              width: 'auto',
              maxWidth: 'none',
              justifyContent: 'center',
              textAlign: 'center',
              px: 1.25,
              fontWeight: selected ? 500 : 400,
              bgcolor: selected ? TASK_FORM_PILL_FILL_BG : TASK_FORM_PILL_OUTLINED_BG,
              color: selected ? 'text.primary' : 'text.secondary',
              borderColor: selected ? TASK_FORM_PILL_OUTLINE_BORDER_HOVER : TASK_FORM_PILL_OUTLINE_BORDER,
              cursor: isInteractive ? 'pointer' : 'default',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              '&:hover': isInteractive
                ? {
                  bgcolor: selected ? TASK_FORM_PILL_FILL_BG : TASK_FORM_PILL_OUTLINED_BG_HOVER,
                  borderColor: TASK_FORM_PILL_OUTLINE_BORDER_HOVER,
                }
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
  const theme = useTheme();
  const isInteractive = !readOnly && !disabled && typeof onChange === 'function';
  const currentValue = value || options[0]?.value || 'PENDIENTE';
  const isDark = theme.palette.mode === 'dark';

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
        const estadoMain = getEstadoColor(opt.value, entityType) || theme.palette.text.secondary;
        const softBg = selected
          ? alpha(estadoMain, isDark ? 0.14 : 0.10)
          : TASK_FORM_PILL_OUTLINED_BG;
        const softBorder = selected
          ? alpha(estadoMain, isDark ? 0.42 : 0.32)
          : TASK_FORM_PILL_OUTLINE_BORDER;

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
              bgcolor: softBg,
              color: selected ? 'text.primary' : 'text.secondary',
              borderColor: softBorder,
              cursor: isInteractive ? 'pointer' : 'default',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              '&:hover': isInteractive
                ? {
                  bgcolor: selected ? alpha(estadoMain, isDark ? 0.18 : 0.14) : TASK_FORM_PILL_OUTLINED_BG_HOVER,
                  borderColor: selected
                    ? alpha(estadoMain, isDark ? 0.55 : 0.42)
                    : TASK_FORM_PILL_OUTLINE_BORDER_HOVER,
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

/**
 * Select estilo pill (mismo patrón que cadencia): cápsula + menú.
 * Mejor que MUI Select para la estética del form; el collapse de fecha
 * queda reservado a editores multi-campo.
 */
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
  disabled = false,
  variant = 'settings',
}) {
  const [anchor, setAnchor] = useState(null);
  const open = Boolean(anchor);

  const selected = options.find((opt) => String(opt.value) === String(value ?? ''));
  const hasValue = value !== null && value !== undefined && value !== '';
  const label = selected?.label
    || (hasValue ? String(value) : null)
    || emptyLabel
    || placeholder;

  const emitChange = (nextValue) => {
    onChange?.({ target: { value: nextValue } });
  };

  const close = () => setAnchor(null);

  const widthSx = pillWidth === 'grow' || pillWidth === 'full'
    ? {
      width: '100%',
      maxWidth: pillWidth === 'full' ? '100%' : TASK_FORM_OBJETIVO_PILL_MAX_WIDTH,
      minWidth: 0,
      justifyContent: 'space-between',
    }
    : {
      ...taskFormFixedPillSx,
      justifyContent: 'space-between',
    };

  return (
    <Box
      sx={{
        width: pillWidth === 'grow' || pillWidth === 'full' ? '100%' : 'auto',
        maxWidth: pillWidth === 'grow' ? TASK_FORM_OBJETIVO_PILL_MAX_WIDTH : undefined,
        minWidth: 0,
      }}
    >
      <TareaFormPillButton
        variant={variant}
        disabled={disabled}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        sx={{
          ...widthSx,
          color: hasValue ? 'text.primary' : 'text.secondary',
          ...(error ? { borderColor: 'error.main' } : null),
        }}
      >
        <Box
          component="span"
          sx={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'left',
          }}
        >
          {label}
          {required && !hasValue ? ' *' : ''}
        </Box>
        <ChevronDownIcon sx={taskFormPillChevronSx} />
      </TareaFormPillButton>

      {(helperText || error) ? (
        <Typography
          variant="caption"
          color={error ? 'error' : 'text.secondary'}
          sx={{ mt: 0.5, display: 'block', px: 0.5 }}
        >
          {helperText || error}
        </Typography>
      ) : null}

      <Menu
        anchorEl={anchor}
        open={open}
        onClose={close}
        disablePortal
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: Math.max(TASK_FORM_STANDARD_PILL_WIDTH, anchor?.offsetWidth || 0),
              maxHeight: 320,
            },
          },
        }}
      >
        {showEmptyOption ? (
          <MenuItem
            selected={!hasValue}
            onClick={() => {
              close();
              emitChange('');
            }}
          >
            <em style={{ fontStyle: 'normal' }}>{emptyLabel}</em>
          </MenuItem>
        ) : null}
        {options.map((opt) => (
          <MenuItem
            key={opt.value}
            selected={String(opt.value) === String(value ?? '')}
            onClick={() => {
              close();
              emitChange(opt.value);
            }}
          >
            {opt.label}
          </MenuItem>
        ))}
        {onCreate ? (
          <MenuItem
            onClick={() => {
              close();
              onCreate();
            }}
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
      </Menu>
    </Box>
  );
}

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
