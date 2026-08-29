import React from 'react';
import { Button } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

export default function HabitsManagerMobileChangeButton({
  onClick,
  expanded = false,
  label = 'Cambiar',
}) {
  return (
    <Button
      size="small"
      onClick={onClick}
      endIcon={(
        expanded
          ? <ExpandLessIcon sx={{ fontSize: '1.1rem !important' }} />
          : <ExpandMoreIcon sx={{ fontSize: '1.1rem !important' }} />
      )}
      sx={{
        textTransform: 'none',
        flexShrink: 0,
        minWidth: 'auto',
        px: 1,
        mt: 0.75,
      }}
    >
      {label}
    </Button>
  );
}
