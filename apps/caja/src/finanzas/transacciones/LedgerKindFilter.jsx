import { useState } from 'react';
import { Box, Checkbox, Popover, Typography } from '@mui/material';
import { FilterList as FilterListIcon } from '@mui/icons-material';
import { toggleAllKinds, toggleKindId } from './ledgerKindFilters';
import { FONT_SIZE } from '@shared/tipografia';

export default function LedgerKindFilter({ options, enabledIds, onChange }) {
  const [anchor, setAnchor] = useState(null);
  const open = Boolean(anchor);
  const selected = enabledIds == null ? options.map((option) => option.id) : enabledIds;
  const allOn = selected.length === options.length;
  const someOn = selected.length > 0 && !allOn;
  const filtered = enabledIds != null && enabledIds.length !== options.length;

  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label="Filtrar tipos"
        aria-expanded={open}
        aria-pressed={filtered}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          appearance: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          m: 0,
          p: 0,
          border: 0,
          borderRadius: 0,
          bgcolor: 'transparent',
          color: filtered ? 'text.primary' : 'text.secondary',
          cursor: 'pointer',
          flex: '0 0 auto',
          '&:hover': { color: 'text.primary' },
        }}
      >
        <FilterListIcon sx={{ fontSize: 18 }} />
      </Box>
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              minWidth: 220,
              py: 0.5,
              bgcolor: 'background.default',
              backgroundImage: 'none',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            },
          },
        }}
      >
        <FilterRow
          label="Todos"
          checked={allOn}
          indeterminate={someOn}
          onChange={() => onChange(toggleAllKinds(options, enabledIds))}
        />
        {options.map((option) => (
          <FilterRow
            key={option.id}
            label={option.label}
            checked={selected.includes(option.id)}
            onChange={() => onChange(toggleKindId(options, enabledIds, option.id))}
          />
        ))}
      </Popover>
    </>
  );
}

function FilterRow({ label, checked, indeterminate = false, onChange }) {
  return (
    <Box
      component="label"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.25,
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Checkbox
        size="small"
        checked={checked}
        indeterminate={indeterminate}
        onChange={onChange}
        sx={{ p: 0.5 }}
      />
      <Typography sx={{ fontSize: FONT_SIZE.md, fontWeight: 600, color: 'text.primary' }}>
        {label}
      </Typography>
    </Box>
  );
}
