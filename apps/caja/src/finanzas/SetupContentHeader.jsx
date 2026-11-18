import React from 'react';
import { Box, Button, Typography } from '@mui/material';

/**
 * Cabecera compacta para setups (Cuentas / Monedas) dentro del popup o página.
 */
export default function SetupContentHeader({
  hint,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  children,
}) {
  return (
    <Box sx={{ mb: 1.5 }}>
      {hint ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1.25, lineHeight: 1.45 }}
        >
          {hint}
        </Typography>
      ) : null}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        {primaryLabel && onPrimary ? (
          <Button
            variant="contained"
            size="small"
            onClick={onPrimary}
            sx={{ textTransform: 'none', borderRadius: 1 }}
          >
            {primaryLabel}
          </Button>
        ) : null}
        {secondaryLabel && onSecondary ? (
          <Button
            variant="outlined"
            size="small"
            onClick={onSecondary}
            sx={{ textTransform: 'none', borderRadius: 1 }}
          >
            {secondaryLabel}
          </Button>
        ) : null}
        {children}
      </Box>
    </Box>
  );
}
