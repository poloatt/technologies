import React from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Box
} from '@mui/material';
import EntityActions from '@shared/components/common/CommonActions';

const formatDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const DataCorporalTable = ({ 
  data = [], 
  onEdit, 
  onDelete 
}) => {
  return (
    <TableContainer 
      component={Paper} 
      elevation={0}
      sx={{ 
        borderRadius: 0,
        overflow: 'visible',
        backgroundColor: 'transparent'
      }}
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Fecha</TableCell>
            <TableCell align="right">Peso (kg)</TableCell>
            <TableCell align="right">Masa Muscular (%)</TableCell>
            <TableCell align="right">Grasa (%)</TableCell>
            <TableCell align="right">Estrés</TableCell>
            <TableCell align="right">Sueño (hrs)</TableCell>
            <TableCell align="right">Origen</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row._id}>
              <TableCell>{formatDate(row.fecha)}</TableCell>
              <TableCell align="right">{Number(row.weight).toFixed(1)}</TableCell>
              <TableCell align="right">{Number(row.muscle).toFixed(1)}</TableCell>
              <TableCell align="right">{Number(row.fatPercent).toFixed(1)}</TableCell>
              <TableCell align="right">{row.stress}</TableCell>
              <TableCell align="right">{row.sleep}</TableCell>
              <TableCell align="right">{row.origen === 'samsung' ? 'Reloj' : 'Manual'}</TableCell>
              <TableCell align="right">
                <EntityActions
                  onEdit={() => onEdit(row)}
                  onDelete={() => onDelete(row._id)}
                  itemName="el registro"
                  size="small"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}; 
