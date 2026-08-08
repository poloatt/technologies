import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Stack,
  Tooltip
} from '@mui/material';
import {
  Task as TaskIcon,
  Schedule as ScheduleIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Google as GoogleIcon,
} from '@mui/icons-material';
import { StatusChip } from '../propiedades/PropiedadStyles';
import { getEstadoColor, getEstadoText, getStatusIconComponent } from '../common/StatusSystem';

const ObjetivoCard = ({ objetivo, onEdit, onDelete }) => {
  const googleListId = objetivo?.googleTasksSync?.googleTaskListId;
  const googleLinked = Boolean(googleListId);

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Typography variant="h6" component="div">
          {objetivo.titulo}
        </Typography>
        <StatusChip customcolor={getEstadoColor(objetivo.estado, 'OBJETIVO')}>
          {getStatusIconComponent(objetivo.estado, 'OBJETIVO')}
          <span>{getEstadoText(objetivo.estado, 'OBJETIVO')}</span>
        </StatusChip>
      </Box>

      {objetivo.descripcion && (
        <Typography variant="body2" color="text.secondary">
          {objetivo.descripcion}
        </Typography>
      )}

      {googleLinked && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <GoogleIcon sx={{ fontSize: 16, color: 'success.main' }} />
          <Typography variant="caption" color="text.secondary">
            Vinculado a Google Tasks
            {googleListId ? ` · ${String(googleListId).slice(0, 10)}…` : ''}
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TaskIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {Array.isArray(objetivo.tareas) ? objetivo.tareas.length : 0} tareas
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ScheduleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {new Date(objetivo.fechaInicio).toLocaleDateString()}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mt: 'auto', pt: 1 }}>
        <Tooltip title="Editar">
          <IconButton 
            onClick={onEdit}
            size="small"
            sx={{ 
              color: 'text.secondary',
              '&:hover': { color: 'primary.main', backgroundColor: 'transparent' }
            }}
          >
            <EditIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Eliminar">
          <IconButton 
            onClick={onDelete}
            size="small"
            sx={{ 
              color: 'text.secondary',
              '&:hover': { color: 'error.main', backgroundColor: 'transparent' }
            }}
          >
            <DeleteIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Stack>
  );
};

export default ObjetivoCard; 
