import React from 'react';
import { Box, Popover, TextField } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { taskFormPickerPopoverPaperSx } from './tareaFormTokens';

const inlinePickerBoxSx = {
  '& .MuiPickersPopper-root': {
    position: 'relative !important',
    transform: 'none !important',
    inset: 'unset !important',
  },
  '& .MuiPaper-root': {
    boxShadow: 'none',
    backgroundImage: 'none',
  },
};

const hiddenPickerInputSx = {
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: 1,
  p: 0,
  m: 0,
  border: 0,
};

export function PickerPopover({ open, anchorEl, onClose, children }) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      disablePortal
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      PaperProps={{ sx: taskFormPickerPopoverPaperSx }}
    >
      {children}
    </Popover>
  );
}

export function PopoverInlineDatePicker({ value, onChange }) {
  return (
    <Box sx={inlinePickerBoxSx}>
      <DatePicker
        value={value}
        onChange={onChange}
        views={['year', 'month', 'day']}
        openTo="day"
        open
        renderInput={(params) => (
          <TextField {...params} sx={hiddenPickerInputSx} tabIndex={-1} aria-hidden />
        )}
        PopperProps={{ disablePortal: true }}
        componentsProps={{ actionBar: { actions: [] } }}
      />
    </Box>
  );
}

export function PopoverInlineTimePicker({ value, onChange }) {
  return (
    <Box sx={inlinePickerBoxSx}>
      <TimePicker
        value={value}
        onChange={onChange}
        ampm={false}
        minutesStep={5}
        views={['hours', 'minutes']}
        open
        renderInput={(params) => (
          <TextField {...params} sx={hiddenPickerInputSx} tabIndex={-1} aria-hidden />
        )}
        PopperProps={{ disablePortal: true }}
        componentsProps={{ actionBar: { actions: [] } }}
      />
    </Box>
  );
}
