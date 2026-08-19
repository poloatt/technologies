import React from 'react';
import {
  Box,
  Typography,
  Grid
} from '@mui/material';
import InquilinoCard from './InquilinoCard';

const InquilinoList = ({ 
  inquilinos = [], 
  onEdit, 
  onDelete,
  onCreateContract
}) => {
  if (inquilinos.length === 0) {
    return (
      <Box 
        sx={{ 
          textAlign: 'center', 
          py: 4,
          color: 'text.secondary'
        }}
      >
        <Typography>No hay inquilinos registrados</Typography>
      </Box>
    );
  }

  // Ordenar inquilinos por estado (activos primero, luego inactivos)
  const inquilinosOrdenados = [...inquilinos].sort((a, b) => {
    const estadoA = a.estado || 'PENDIENTE';
    const estadoB = b.estado || 'PENDIENTE';
    const orden = {
      'ACTIVO': 0,
      'RESERVADO': 1,
      'PENDIENTE': 2,
      'INACTIVO': 3,
      'SIN_CONTRATO': 4
    };
    return (orden[estadoA] ?? 99) - (orden[estadoB] ?? 99);
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {inquilinosOrdenados.map((inquilino) => (
        <InquilinoCard
          key={inquilino._id}
          inquilino={inquilino}
          onEdit={onEdit}
          onDelete={onDelete}
          onCreateContract={onCreateContract}
        />
      ))}
    </Box>
  );
};

export default InquilinoList; 
