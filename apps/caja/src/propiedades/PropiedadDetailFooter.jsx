import React from 'react';
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import {
  EditOutlined as EditIcon,
  DeleteOutlined as DeleteIcon,
} from '@mui/icons-material';
import {
  propiedadDetailFooterSx,
  propiedadDetailFooterActionSx,
  propiedadDetailCloseButtonSx,
} from './propiedadDetailStyles';

export default function PropiedadDetailFooter({ onEdit, onDelete, onClose }) {
  return (
    <Box sx={propiedadDetailFooterSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <Tooltip title="Editar">
          <IconButton
            size="small"
            onClick={onEdit}
            aria-label="Editar propiedad"
            sx={propiedadDetailFooterActionSx}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Eliminar">
          <IconButton
            size="small"
            onClick={onDelete}
            aria-label="Eliminar propiedad"
            sx={{
              ...propiedadDetailFooterActionSx,
              '&:hover': { bgcolor: 'action.hover', color: 'error.main' },
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Button onClick={onClose} sx={propiedadDetailCloseButtonSx}>
        Cerrar
      </Button>
    </Box>
  );
}
