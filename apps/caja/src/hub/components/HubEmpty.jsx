import React from 'react';
import { Typography } from '@mui/material';

export default function HubEmpty({ children, sx }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ px: 0.125, ...sx }}>
      {children}
    </Typography>
  );
}
