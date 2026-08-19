import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import { CommonDetails, CommonConstruction } from '@shared/components/common';
import { FinanzasSectionNav } from '../finanzas';
import { cajaPageLayoutSx } from '../navigation/cajaPageLayoutSx';

export function Deudores() {
  useEffect(() => {
    const handleHeaderAdd = (e) => {
      if (e.detail?.type === 'deudores') {
        alert('La función de agregar deudor está en construcción.');
      }
    };
    window.addEventListener('headerAddButtonClicked', handleHeaderAdd);
    return () => window.removeEventListener('headerAddButtonClicked', handleHeaderAdd);
  }, []);

  return (
    <Box sx={cajaPageLayoutSx}>
      <FinanzasSectionNav variant="strip" />

      <CommonDetails>
        <CommonConstruction />
      </CommonDetails>
    </Box>
  );
}

export default Deudores;
