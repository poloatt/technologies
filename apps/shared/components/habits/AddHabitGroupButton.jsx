import React from 'react';
import { Box, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { hubSectionBg } from '../../styles/hubSectionStyles';

const addGroupButtonSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.75,
  px: 1.25,
  py: 1,
  borderRadius: 1.5,
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.875rem',
  color: 'text.secondary',
  border: '1px dashed',
  borderColor: 'divider',
  bgcolor: hubSectionBg,
  '&:hover': {
    bgcolor: 'action.hover',
    borderColor: 'primary.main',
    color: 'primary.main',
  },
};

export default function AddHabitGroupButton({ onClick, fullWidth = true, sx }) {
  return (
    <Button
      variant="text"
      onClick={onClick}
      startIcon={<AddIcon fontSize="small" />}
      aria-label="Agregar grupo"
      fullWidth={fullWidth}
      sx={{ ...addGroupButtonSx, ...sx }}
    >
      Agregar grupo
    </Button>
  );
}

export function AddHabitGroupButtonWrap({ children, sx }) {
  return (
    <Box sx={{ mt: 0.5, ...sx }}>
      {children}
    </Box>
  );
}
