import React, { useId, useState } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { KeyboardArrowDown as ChevronDownIcon } from '@mui/icons-material';
import { getHabitIconGroups, getHabitIconOptions, getIconByName } from '@shared/utils/habitIcons';
import { PickerPopover } from './tareaFormPickers';
import {
  TASK_FORM_ICON_SIZE,
  taskFormErrorTextSx,
  taskFormFixedSelectPillSx,
  taskFormPillIconSx,
} from './tareaFormTokens';

const GRID_COLUMNS = 6;
const ICON_CELL_SIZE = 40;

function HabitIconPickerGrid({
  listId,
  ariaLabel,
  groups,
  value,
  onSelect,
}) {
  return (
    <Box
      id={listId}
      role="listbox"
      aria-label={ariaLabel}
      sx={{
        maxHeight: 360,
        overflowY: 'auto',
        py: 0.5,
      }}
    >
      {groups.map((group) => (
        <Box key={group.id} sx={{ px: 1.5, pt: group.id === groups[0]?.id ? 1 : 1.25, pb: 0.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              fontWeight: 600,
              fontSize: '0.68rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              mb: 0.75,
            }}
          >
            {group.label}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${ICON_CELL_SIZE}px)`,
              gap: 0.5,
            }}
          >
            {group.icons.map(({ name, label }) => {
              const IconComp = getIconByName(name);
              if (!IconComp) return null;
              const selected = value === name;
              return (
                <Tooltip key={name} title={label} arrow placement="top">
                  <IconButton
                    role="option"
                    aria-selected={selected}
                    aria-label={label}
                    size="small"
                    onClick={() => onSelect(name)}
                    sx={{
                      width: ICON_CELL_SIZE,
                      height: ICON_CELL_SIZE,
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: selected ? 'primary.main' : 'transparent',
                      bgcolor: selected ? 'action.selected' : 'transparent',
                      color: selected ? 'primary.main' : 'text.secondary',
                      '&:hover': {
                        bgcolor: 'action.hover',
                        color: 'text.primary',
                      },
                    }}
                  >
                    <IconComp sx={{ fontSize: '1.25rem' }} />
                  </IconButton>
                </Tooltip>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Selector de icono para hábitos.
 * - variant="title": botón compacto junto al título (solo icono).
 * - variant="field": pill con icono + chevron para filas de formulario.
 */
export default function HabitIconPicker({
  value,
  onChange,
  iconGroups = getHabitIconGroups(),
  icons = getHabitIconOptions(),
  variant = 'field',
  error,
  helperText,
  disabled = false,
  ariaLabel = 'Seleccionar icono del hábito',
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const listId = useId();
  const open = Boolean(anchorEl);
  const SelectedIcon = getIconByName(value);

  const groups = iconGroups?.length
    ? iconGroups
    : [{ id: 'all', label: 'Iconos', icons }];

  const handleOpen = (event) => {
    if (disabled) return;
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleSelect = (name) => {
    onChange?.(name);
    handleClose();
  };

  const popover = (
    <PickerPopover open={open} anchorEl={anchorEl} onClose={handleClose}>
      <HabitIconPickerGrid
        listId={listId}
        ariaLabel={ariaLabel}
        groups={groups}
        value={value}
        onSelect={handleSelect}
      />
    </PickerPopover>
  );

  if (variant === 'title') {
    return (
      <>
        <IconButton
          size="small"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={handleOpen}
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            border: 1,
            borderColor: open ? 'primary.main' : error ? 'error.main' : 'divider',
            bgcolor: open ? 'action.selected' : 'transparent',
            color: 'primary.main',
            '&:hover': {
              bgcolor: 'action.hover',
              borderColor: 'primary.main',
            },
          }}
        >
          {SelectedIcon ? (
            <SelectedIcon sx={{ fontSize: '1.35rem' }} />
          ) : (
            <Box sx={{ width: 20, height: 20 }} />
          )}
        </IconButton>
        {popover}
      </>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box
        component="button"
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={handleOpen}
        sx={{
          ...taskFormFixedSelectPillSx,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 0.75,
          minWidth: 72,
          cursor: disabled ? 'not-allowed' : 'pointer',
          border: error ? 1 : undefined,
          borderColor: error ? 'error.main' : undefined,
          opacity: disabled ? 0.5 : 1,
          font: 'inherit',
          color: 'text.primary',
          '&:hover': disabled ? {} : { bgcolor: 'action.hover' },
        }}
      >
        {SelectedIcon ? (
          <SelectedIcon sx={{ ...taskFormPillIconSx, fontSize: TASK_FORM_ICON_SIZE }} />
        ) : (
          <Box sx={{ width: TASK_FORM_ICON_SIZE, height: TASK_FORM_ICON_SIZE }} />
        )}
        <ChevronDownIcon sx={{ fontSize: '1.1rem', color: 'text.secondary', flexShrink: 0 }} />
      </Box>
      {popover}
      {(error || helperText) && (
        <Typography
          variant="caption"
          color={error ? 'error' : 'text.secondary'}
          sx={{ ...taskFormErrorTextSx, mt: 0.5, display: 'block' }}
        >
          {error || helperText}
        </Typography>
      )}
    </Box>
  );
}
