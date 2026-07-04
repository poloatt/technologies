import React, { useRef, useState } from 'react';
import { es } from 'date-fns/locale';
import { Box, IconButton, Stack } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  TareaFormRow,
  TareaFormPillButton,
  tareaFormDatePillSx,
  tareaFormHeaderActionIconSx,
  tareaFormPillIconSx,
  tareaFormRowActionColumnSx,
  tareaFormRowContentGutterSx,
  tareaFormBodyTextSx,
  taskFormScheduleExpandedContentSx,
} from './tareaFormUi';
import { TareaFormIcons } from './tareaFormIcons';
import { formatDeadlinePill } from '../../utils/tareaFormDateUtils';
import { PickerPopover, PopoverInlineDatePicker } from './tareaFormPickers';

export function TareaFormDeadlineClearButton({ onClear, sx }) {
  const handleClick = (event) => {
    event.stopPropagation();
    onClear?.();
  };

  return (
    <IconButton
      size="small"
      onClick={handleClick}
      aria-label="Quitar fecha límite"
      sx={{
        ...tareaFormRowActionColumnSx,
        ...tareaFormHeaderActionIconSx(),
        '&:hover:not(:disabled)': {
          bgcolor: 'transparent',
          color: 'text.primary',
        },
        ...sx,
      }}
    >
      <CloseIcon sx={tareaFormPillIconSx} />
    </IconButton>
  );
}

function DeadlinePickerPopover({ anchorRef, open, onClose, value, onChange }) {
  return (
    <PickerPopover
      open={open}
      anchorEl={anchorRef.current}
      onClose={onClose}
    >
      <PopoverInlineDatePicker
        value={value}
        onChange={(v) => {
          onChange?.(v);
          onClose();
        }}
      />
    </PickerPopover>
  );
}

export function TareaFormDeadlineRow({
  value,
  onChange,
  placeholder = 'Agregar fecha límite...',
  showClear = true,
  endTimeSlot = null,
  embeddedInSummary = false,
}) {
  const anchorRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const displayValue = formatDeadlinePill(value);

  const handleClear = () => {
    onChange?.(null);
    setPickerOpen(false);
  };

  const rowBody = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        width: '100%',
        minWidth: 0,
        flexWrap: 'wrap',
        ...(embeddedInSummary ? taskFormScheduleExpandedContentSx : tareaFormRowContentGutterSx),
      }}
    >
      {value ? (
        <Stack
          direction="row"
          flexWrap="wrap"
          alignItems="center"
          gap={0.75}
          useFlexGap
          sx={{ flex: 1, minWidth: 0 }}
        >
          <TareaFormPillButton
            ref={anchorRef}
            variant="schedule"
            onClick={() => setPickerOpen(true)}
            aria-label="Cambiar fecha límite"
            sx={tareaFormDatePillSx}
          >
            {displayValue}
          </TareaFormPillButton>
          {endTimeSlot}
        </Stack>
      ) : (
        <Box
          ref={anchorRef}
          component="button"
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label={placeholder}
          sx={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'none',
            p: 0,
            m: 0,
            textAlign: 'left',
            cursor: 'pointer',
            color: 'text.secondary',
            font: 'inherit',
            ...tareaFormBodyTextSx,
            '&:hover': { opacity: 0.88 },
          }}
        >
          {placeholder}
        </Box>
      )}
      {showClear && value && !endTimeSlot ? (
        <TareaFormDeadlineClearButton onClear={handleClear} />
      ) : null}
    </Box>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      {embeddedInSummary ? (
        rowBody
      ) : (
        <TareaFormRow icon={TareaFormIcons.deadline} showDivider={false} align="center">
          {rowBody}
        </TareaFormRow>
      )}

      <DeadlinePickerPopover
        anchorRef={anchorRef}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={value}
        onChange={onChange}
      />
    </LocalizationProvider>
  );
}

export function TareaFormDeadlinePill({
  value,
  onChange,
  placeholder = 'Agregar fecha límite',
  showClear = true,
}) {
  const anchorRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const displayValue = formatDeadlinePill(value);

  const handleClear = () => {
    onChange?.(null);
    setPickerOpen(false);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <>
        <TareaFormPillButton
          ref={anchorRef}
          variant="schedule"
          onClick={() => setPickerOpen(true)}
          aria-label={value ? 'Cambiar fecha límite' : placeholder}
          sx={{
            ...tareaFormDatePillSx,
            ...(!value ? { color: 'text.secondary' } : null),
          }}
        >
          {displayValue || placeholder}
        </TareaFormPillButton>

        {showClear && value ? (
          <TareaFormDeadlineClearButton onClear={handleClear} />
        ) : null}
      </>

      <DeadlinePickerPopover
        anchorRef={anchorRef}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={value}
        onChange={onChange}
      />
    </LocalizationProvider>
  );
}

export default function TareaFormDeadlineField({
  variant = 'row',
  ...props
}) {
  if (variant === 'pill') {
    return <TareaFormDeadlinePill {...props} />;
  }
  return <TareaFormDeadlineRow {...props} />;
}
