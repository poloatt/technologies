import React, { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { FinanzasSectionNav } from '../finanzas';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';

export default function Inversiones() {
  useEffect(() => {
    const handleHeaderAdd = (e) => {
      if (e.detail?.type === 'inversiones') {
        alert('La función de agregar inversión está en construcción.');
      }
    };
    window.addEventListener('headerAddButtonClicked', handleHeaderAdd);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAdd);
  }, []);

  return (
    <Box sx={cajaPageLayoutSx}>
      <FinanzasSectionNav variant="strip" />

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
        <TrendingUpIcon sx={{ fontSize: 64, color: 'primary.main' }} />
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Próximamente podrás gestionar tu portafolio aquí. Usa las tarjetas de arriba para volver a otras secciones.
        </Typography>
      </Box>
    </Box>
  );
}
