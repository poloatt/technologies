import React, { useState } from 'react';
import { Menu, MenuItem, TextField, Box } from '@mui/material';
import { KeyboardArrowDown as ChevronDownIcon } from '@mui/icons-material';
import { TareaFormPillButton, tareaFormPillChevronSx } from './tareaFormUi';

const PRESETS = [
  { id: 'none', label: 'No se repite', rrule: null },
  { id: 'daily', label: 'Cada día', rrule: 'FREQ=DAILY;INTERVAL=1' },
  { id: 'every-n', label: 'Cada X días', rrule: 'every-n' },
  { id: 'weekly', label: 'Cada semana', rrule: 'FREQ=WEEKLY;INTERVAL=1' },
  { id: 'monthly', label: 'Cada mes', rrule: 'FREQ=MONTHLY;INTERVAL=1' },
  { id: 'yearly', label: 'Cada año', rrule: 'FREQ=YEARLY;INTERVAL=1' },
  { id: 'custom', label: 'Personalizado (RRULE)', rrule: 'custom' },
];

export function labelForRrule(rrule) {
  if (!rrule) return 'No se repite';
  const found = PRESETS.find((p) => p.rrule === rrule);
  if (found) return found.label;
  const everyNDays = String(rrule).match(/^FREQ=DAILY;INTERVAL=(\d+)$/i);
  if (everyNDays) {
    const interval = Number(everyNDays[1]);
    if (interval <= 1) return 'Cada día';
    return `Cada ${interval} días`;
  }
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
  const [everyNOpen, setEveryNOpen] = useState(false);
  const [everyN, setEveryN] = useState(2);
  const [customRrule, setCustomRrule] = useState(
    value && !PRESETS.some((p) => p.rrule === value) ? value : 'FREQ=WEEKLY;INTERVAL=1',
  );

  const open = Boolean(anchor);

  const handleSelect = (preset) => {
    setAnchor(null);
    if (preset.id === 'custom') {
      setEveryNOpen(false);
      setCustomOpen(true);
      return;
    }
    if (preset.id === 'every-n') {
      setCustomOpen(false);
      setEveryNOpen(true);
      onChange?.(`FREQ=DAILY;INTERVAL=${Math.max(2, Number(everyN) || 2)}`);
      return;
    }
    setCustomOpen(false);
    setEveryNOpen(false);
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

      {everyNOpen && (
        <Box sx={{ width: '100%', flexBasis: '100%' }}>
          <TextField
            size="small"
            type="number"
            label="Cada cuántos días"
            value={everyN}
            onChange={(e) => {
              const next = Math.max(2, Math.min(365, Number(e.target.value) || 2));
              setEveryN(next);
              onChange?.(`FREQ=DAILY;INTERVAL=${next}`);
            }}
            inputProps={{ min: 2, max: 365 }}
            sx={{ mt: 0.5, maxWidth: 180 }}
          />
        </Box>
      )}

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
