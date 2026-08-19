import React from 'react';
import { Box, Typography } from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { InventarioSectionNav } from '../inventario';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';

export default function Autos() {
  return (
    <Box sx={cajaPageLayoutSx}>
      <InventarioSectionNav variant="strip" />

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          gap: 2,
        }}
      >
        <DirectionsCarIcon sx={{ fontSize: 64, color: 'primary.main' }} />
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Próximamente podrás gestionar tu flota desde aquí. Usa las tarjetas de arriba para volver a otras secciones.
        </Typography>
      </Box>
    </Box>
  );
}
