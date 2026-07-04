import React, { useState } from 'react';
import { Menu, MenuItem, TextField, Box } from '@mui/material';
import { KeyboardArrowDown as ChevronDownIcon } from '@mui/icons-material';
import { TareaFormPillButton, tareaFormPillChevronSx } from './tareaFormUi';

const PRESETS = [
  { id: 'none', label: 'No se repite', rrule: null },
  { id: 'daily', label: 'Cada día', rrule: 'FREQ=DAILY;INTERVAL=1' },
  { id: 'weekly', label: 'Cada semana', rrule: 'FREQ=WEEKLY;INTERVAL=1' },
  { id: 'monthly', label: 'Cada mes', rrule: 'FREQ=MONTHLY;INTERVAL=1' },
  { id: 'yearly', label: 'Cada año', rrule: 'FREQ=YEARLY;INTERVAL=1' },
  { id: 'custom', label: 'Personalizado (RRULE)', rrule: 'custom' },
];

export function labelForRrule(rrule) {
  if (!rrule) return 'No se repite';
  const found = PRESETS.find((p) => p.rrule === rrule);
  if (found) return found.label;
  return 'Recurrencia personalizada';
}

export default function TareaFormRecurrencePicker({
  value,
  onChange,
  disabled,
  variant = 'settings',
}) {
  const [anchor, setAnchor] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customRrule, setCustomRrule] = useState(
    value && !PRESETS.some((p) => p.rrule === value) ? value : 'FREQ=WEEKLY;INTERVAL=1',
  );

  const open = Boolean(anchor);

  const handleSelect = (preset) => {
    setAnchor(null);
    if (preset.id === 'custom') {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    onChange?.(preset.rrule);
  };

  return (
    <>
      <TareaFormPillButton
        variant={variant}
        disabled={disabled}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label="Cadencia"
      >
        {labelForRrule(value)}
        <ChevronDownIcon sx={tareaFormPillChevronSx} />
      </TareaFormPillButton>

      <Menu anchorEl={anchor} open={open} onClose={() => setAnchor(null)}>
        {PRESETS.map((p) => (
          <MenuItem key={p.id} onClick={() => handleSelect(p)}>
            {p.label}
          </MenuItem>
        ))}
      </Menu>

      {customOpen && (
        <Box sx={{ width: '100%', flexBasis: '100%' }}>
          <TextField
            size="small"
            fullWidth
            label="RRULE"
            value={customRrule}
            onChange={(e) => setCustomRrule(e.target.value)}
            onBlur={() => onChange?.(customRrule.replace(/^RRULE:/, ''))}
            sx={{ mt: 0.5, maxWidth: 320 }}
            helperText="Ej: FREQ=WEEKLY;INTERVAL=1;BYDAY=MO"
          />
        </Box>
      )}
    </>
  );
}
