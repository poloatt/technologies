import React, { useState, useEffect } from 'react';
import {
  Grid,
  Box,
  Typography,
  Paper,
  IconButton,
  Collapse,
  Stack,
  Divider,
  Chip,
  LinearProgress,
  Checkbox,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  EditOutlined as EditIcon,
  DeleteOutlined as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CompletedIcon,
  RadioButtonUnchecked as PendingIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
} from '@mui/icons-material';
 import { TableContainer, Table, TableBody } from '@mui/material';
import { EmptyState } from '@shared/components/common';
import clienteAxios from '@shared/config/axios';
import { useSnackbar } from 'notistack';
import TareaActions from '../tasks/components/TareaActions';
import { TaskRow } from '@shared/components/tasks';
import TareaDetailPopup from '../tasks/list/TareaDetailPopup';
import { buildTareaPayload } from '../tasks/form';
import { addDays, addWeeks, addMonths, isWeekend, startOfMonth } from 'date-fns';
import { useResponsive } from '@shared/hooks';
import { useValuesVisibility } from '@shared/context';
import { getEstadoColor } from '@shared/components/common/StatusSystem';
import { isTaskCompleted } from '@shared/utils/agendaRules';

const ObjetivoItem = ({ 
  objetivo, 
  onEdit, 
  onDelete, 
  onUpdateTarea, 
  onAddTarea,
  onLoadObjetivoTareas,
  showValues, 
  updateWithHistory, 
  updateTareaWithHistory,
  isMultiSelectMode,
  isSelected,
  onSelect,
  objetivos = [],
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const { isMobile } = useResponsive();
  const { maskText } = useValuesVisibility();
  const [expanded, setExpanded] = useState(false);
  const [tareasLoading, setTareasLoading] = useState(false);
  const [openTareaId, setOpenTareaId] = useState(null);
  const tareas = Array.isArray(objetivo.tareas) ? objetivo.tareas : [];
  const [anchorEl, setAnchorEl] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [longPressActivated, setLongPressActivated] = useState(false);
  const objetivoId = objetivo._id || objetivo.id;

  const handleMenuClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = (event) => {
    event?.stopPropagation();
    setAnchorEl(null);
  };

  // Handlers para selección múltiple
  const handleLongPressStart = (event) => {
    event.preventDefault();
    setLongPressActivated(false);
    const timer = setTimeout(() => {
      if (onSelect) {
        onSelect(objetivoId);
        setLongPressActivated(true);
      }
    }, 500); // 500ms para presión larga
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setLongPressActivated(false);
  };

  const handleClick = (event) => {
    // Si el click viene del checkbox, no hacer nada adicional
    if (event.target.closest('.MuiCheckbox-root')) {
      return;
    }
    
    // Si estamos en modo selección múltiple, manejar selección
    if (isMultiSelectMode && onSelect) {
      event.preventDefault();
      onSelect(objetivoId);
      return;
    }
    
    // Si hay objetivos seleccionados, manejar como selección múltiple
    if (isSelected) {
      event.preventDefault();
      onSelect(objetivoId);
      return;
    }
    
    // Si la presión larga ya se activó, no hacer nada más
    if (longPressActivated) {
      event.preventDefault();
      return;
    }
    
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded && onLoadObjetivoTareas && tareas.length === 0) {
      setTareasLoading(true);
      Promise.resolve(onLoadObjetivoTareas(objetivoId)).finally(() => setTareasLoading(false));
    }
  };

  const handleEdit = (event) => {
    event.stopPropagation();
    onEdit(objetivo);
    handleMenuClose();
  };

  const handleDelete = (event) => {
    event.stopPropagation();
    onDelete(objetivoId);
    handleMenuClose();
  };

  const handleTareaDetailSubmit = async (formData, tarea) => {
    if (!tarea) return;

    try {
      const datosAEnviar = buildTareaPayload(formData, { editingTarea: tarea, objetivos });
      const updated = await updateTareaWithHistory(tarea._id, datosAEnviar, tarea);
      if (onUpdateTarea) onUpdateTarea(updated);
      enqueueSnackbar('Tarea actualizada exitosamente', { variant: 'success' });
    } catch (error) {
      console.error('Error al guardar tarea:', error);
      enqueueSnackbar(
        error.response?.data?.error || 'Error al guardar la tarea',
        { variant: 'error' },
      );
    }
  };

  const handleInlineEdit = async (updates) => {
    try {
      const updated = await updateWithHistory(objetivo._id || objetivo.id, updates, objetivo);
      // Actualizar estado local si es necesario
      // ...
      enqueueSnackbar('objetivo actualizado exitosamente', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Error al actualizar el objetivo', { variant: 'error' });
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        backgroundColor: 'background.paper',
        position: 'relative',
        border: isSelected ? '2px solid' : '1px solid',
        borderColor: isSelected ? 'primary.main' : 'transparent',
        borderRadius: 1,
        // Animación sutil cuando hay selecciones activas pero este objetivo no está seleccionado
        ...(isMultiSelectMode && !isSelected && {
          animation: 'subtlePulse 3s infinite'
        }),
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: 'primary.main'
        }
      }}
    >
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'action.hover'
          }
        }}
        onClick={handleClick}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
      >
        {/* Checkbox para selección múltiple */}
        {isMultiSelectMode && (
          <Checkbox
            checked={isSelected}
            onChange={() => onSelect && onSelect(objetivoId)}
            size="small"
            sx={{
              padding: 0.5,
              color: 'text.secondary',
              '&.Mui-checked': {
                color: 'primary.main'
              }
            }}
          />
        )}
        
        <IconButton
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
            {objetivo.nombre}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {objetivo.descripcion}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            label={tareasLoading ? '…' : `${tareas.filter((t) => !t.completada).length}`}
            sx={{
              height: 20,
              backgroundColor: 'grey.800',
              '& .MuiChip-label': {
                px: 1,
                fontSize: '0.75rem'
              }
            }}
          />
          <IconButton
            size="small"
            onClick={handleMenuClick}
            sx={{ color: 'text.secondary' }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          sx: {
            backgroundColor: 'background.paper',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 'none',
            '& .MuiMenuItem-root': {
              fontSize: '0.875rem',
              py: 1,
              px: 2,
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }
          }
        }}
      >
        <MenuItem onClick={() => {
          handleMenuClose();
          onAddTarea(objetivo);
        }}>
          <AddIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
          Nueva Tarea
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <EditIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
          Editar
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <DeleteIcon fontSize="small" sx={{ mr: 1, color: '#8B0000' }} />
          Eliminar
        </MenuItem>
      </Menu>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider />
        <Box sx={{ 
          p: 2, 
          maxHeight: '300px', 
          overflowY: 'auto',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0,0,0,0.1)',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: 'rgba(0,0,0,0.3)',
          },
        }}>
          {tareasLoading ? (
            <Typography variant="body2" color="text.secondary" align="center">
              Cargando tareas…
            </Typography>
          ) : tareas.length > 0 ? (
            <>
            <TableContainer component={Box} sx={{ width: '100%' }}>
              <Table sx={{ width: '100%' }} size="small">
                <TableBody>
              {[...tareas]
                    .filter(t => !t.completada)
                .sort((a, b) => {
                      const estadoOrden = { 'EN_PROGRESO': 0, 'PENDIENTE': 1, 'COMPLETADA': 2 };
                  if (estadoOrden[a.estado] !== estadoOrden[b.estado]) {
                    return estadoOrden[a.estado] - estadoOrden[b.estado];
                  }
                  const fechaA = a.fechaVencimiento ? new Date(a.fechaVencimiento) : new Date(a.fechaInicio);
                  const fechaB = b.fechaVencimiento ? new Date(b.fechaVencimiento) : new Date(b.fechaInicio);
                  return fechaA - fechaB;
                })
                .map((tarea) => (
                      <TaskRow
                    key={tarea._id || tarea.id}
                    tarea={tarea}
                        onDelete={() => {}}
                        onUpdateEstado={onUpdateTarea}
                        isArchive={false}
                    showValues={showValues}
                        updateWithHistory={updateTareaWithHistory}
                        isMultiSelectMode={false}
                        selectedTareas={[]}
                        onSelectTarea={() => {}}
                        onActivateMultiSelect={() => {}}
                        objetivos={objetivos}
                        onToggleOpen={(id) => setOpenTareaId((prev) => (prev === id ? null : id))}
                        isMobile={isMobile}
                  />
                ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TareaDetailPopup
              open={!!openTareaId}
              onClose={() => setOpenTareaId(null)}
              tarea={tareas.find((t) => String(t._id || t.id) === String(openTareaId))}
              isMobile={isMobile}
              desktopHalfScreen={false}
              objetivos={objetivos}
              onSubmit={handleTareaDetailSubmit}
              onDelete={() => {}}
              updateWithHistory={updateTareaWithHistory}
              onUpdateEstado={onUpdateTarea}
            />
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" align="center">
              No hay tareas asignadas a este objetivo
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

const ObjetivosGrid = ({ 
  objetivos = [], 
  onEdit, 
  onDelete, 
  onAdd, 
  onUpdateTarea, 
  onAddTarea,
  onLoadObjetivoTareas,
  showValues, 
  updateWithHistory, 
  updateTareaWithHistory,
  isMultiSelectMode,
  selectedObjetivos,
  onSelectobjetivo
}) => {
  const { maskText } = useValuesVisibility();

  if (!objetivos.length) {
    return (
      <Box sx={{ p: 2 }}>
        <EmptyState onAdd={onAdd} />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {objetivos.map((objetivo) => (
        <ObjetivoItem
          key={objetivo._id || objetivo.id}
          objetivo={objetivo}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdateTarea={onUpdateTarea}
          onAddTarea={onAddTarea}
          onLoadObjetivoTareas={onLoadObjetivoTareas}
          showValues={showValues}
          updateWithHistory={updateWithHistory}
          updateTareaWithHistory={updateTareaWithHistory}
          isMultiSelectMode={isMultiSelectMode}
          isSelected={selectedObjetivos?.includes(objetivo._id || objetivo.id) || false}
          onSelect={onSelectobjetivo}
          objetivos={objetivos}
        />
      ))}
    </Stack>
  );
};

export default ObjetivosGrid;

// Definiciones de animaciones CSS para selección múltiple
const styles = `
  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
    100% {
      opacity: 1;
    }
  }
  
  @keyframes subtlePulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.9;
    }
    100% {
      opacity: 1;
    }
  }
`;

// Inyectar estilos en el documento
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
} 