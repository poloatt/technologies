import React, { useState, useEffect } from 'react';
import {
  TableRow,
  TableCell,
  Box,
  Typography,
  Checkbox,
} from '@mui/material';
import { useResponsive } from '../../hooks';
import { useValuesVisibility } from '../../context/ValuesVisibilityContext';
import {
  formatTaskCardSchedule,
  isTaskCompleted,
  parseTaskDate,
} from '../../utils/agendaRules';
import {
  getTaskSurfaceTokens,
  getTaskEstadoTokens,
  getTaskRowSx,
  getTaskRowTitleSx,
  getTaskRowScheduleSx,
  getTaskRowCellPadding,
} from '../../styles/taskListStyles';
import { ensureTaskListAnimations } from './taskListAnimations';

ensureTaskListAnimations();

/**
 * Fila de tarea reutilizable (lista, objetivos, archivo).
 * Mobile y desktop comparten el mismo componente; el padding/tipografía responde a `isMobile`.
 * Click: abrir detalle. Click derecho (desktop) / long-press (móvil-tablet): listón de acciones.
 */
export function TaskRow({
  tarea,
  isArchive = false,
  showValues,
  isMultiSelectMode = false,
  selectedTareas = [],
  onSelectTarea,
  onToggleOpen,
  onOpenActions,
  agendaView = 'ahora',
  isMobile: isMobileProp,
}) {
  const [estadoLocal, setEstadoLocal] = useState(tarea.estado);
  const [prioridadLocal, setPrioridadLocal] = useState(tarea.prioridad);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [longPressActivated, setLongPressActivated] = useState(false);
  const [showMultiSelectHint, setShowMultiSelectHint] = useState(false);
  const { isMobile: isMobileResponsive, isMobileOrTablet, theme } = useResponsive();
  const isMobile = isMobileProp ?? isMobileResponsive;
  const { maskText } = useValuesVisibility();

  const taskId = tarea._id || tarea.id;
  const isSelected = selectedTareas.includes(taskId);
  const hasSelections = selectedTareas.length > 0;
  const completed = isTaskCompleted(tarea);

  useEffect(() => {
    setEstadoLocal(tarea.estado);
    setPrioridadLocal(tarea.prioridad);
  }, [tarea]);

  useEffect(() => () => {
    if (longPressTimer) clearTimeout(longPressTimer);
  }, [longPressTimer]);

  useEffect(() => {
    const handleShowMultiSelectHint = (event) => {
      const { active } = event.detail;
      setShowMultiSelectHint(active);
      if (active) {
        setTimeout(() => setShowMultiSelectHint(false), 5000);
      }
    };
    window.addEventListener('showMultiSelectHint', handleShowMultiSelectHint);
    return () => window.removeEventListener('showMultiSelectHint', handleShowMultiSelectHint);
  }, []);

  const openActionsFromEvent = (event) => {
    if (typeof onOpenActions !== 'function') return;
    onOpenActions(tarea, event.currentTarget);
  };

  const clearLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setIsLongPressing(false);
    setLongPressActivated(false);
  };

  const handleTouchStart = (event) => {
    if (!isMobileOrTablet || hasSelections) return;
    setIsLongPressing(true);
    setLongPressActivated(false);
    const target = event.currentTarget;
    const timer = setTimeout(() => {
      setLongPressActivated(true);
      if (typeof onOpenActions === 'function') {
        onOpenActions(tarea, target);
      } else {
        onSelectTarea?.(taskId);
      }
    }, 350);
    setLongPressTimer(timer);
  };

  const handleContextMenu = (event) => {
    if (typeof onOpenActions !== 'function') return;
    event.preventDefault();
    event.stopPropagation();
    clearLongPress();
    openActionsFromEvent(event);
  };

  const handleRowClick = (e) => {
    if (e.target.closest('.MuiCheckbox-root')) return;

    if (isMultiSelectMode || hasSelections) {
      e.stopPropagation();
      onSelectTarea?.(taskId);
      return;
    }
    if (longPressActivated || isLongPressing || longPressTimer) {
      e.stopPropagation();
      return;
    }
    onToggleOpen?.(taskId);
  };

  const isRetrasada = (() => {
    if (completed) return false;
    const fechaVencimiento = parseTaskDate(
      tarea?.fechaVencimiento || tarea?.fechaFin || tarea?.vencimiento || tarea?.dueDate,
    );
    if (!fechaVencimiento) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const vencimiento = new Date(fechaVencimiento);
    vencimiento.setHours(0, 0, 0, 0);
    return vencimiento < today;
  })();

  const estadoParaColor = isRetrasada ? 'RETRASADA' : estadoLocal;
  const estadoTokens = getTaskEstadoTokens(theme, estadoParaColor);
  const selectionAccent = theme.palette.info.main;
  const { hoverBg, layoutDividerColor, surfaceBg } = getTaskSurfaceTokens(theme);
  const cellPad = getTaskRowCellPadding(isMobile);

  return (
    <TableRow
      sx={getTaskRowSx({
        theme,
        isMobile,
        estadoColor: estadoTokens.main,
        selectionAccent,
        isLongPressing,
        isSelected,
        hasSelections,
        showMultiSelectHint,
        surfaceBg,
        hoverBg,
        layoutDividerColor,
      })}
      onClick={handleRowClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      <TableCell sx={cellPad}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.5 : 0.75, minHeight: 0 }}>
          {hasSelections && (
            <Checkbox
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onSelectTarea?.(taskId);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              size={isMobile ? 'medium' : 'small'}
              sx={{
                padding: isMobile ? 0.25 : 0.125,
                color: 'text.secondary',
                '&.Mui-checked': { color: selectionAccent },
                ...(isMobile && {
                  '& .MuiSvgIcon-root': { fontSize: '1.5rem' },
                }),
              }}
            />
          )}
          {prioridadLocal === 'ALTA' && (
            <Typography
              color="error"
              sx={{
                fontWeight: 700,
                fontSize: isMobile ? '0.75rem' : '0.85rem',
                lineHeight: 1,
              }}
            >
              !
            </Typography>
          )}
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
            <Typography sx={getTaskRowTitleSx(isMobile, completed)}>
              {showValues ? tarea.titulo : maskText(tarea.titulo)}
              {(tarea.serieId || tarea.esRecurrente || tarea.virtual) && (
                <Typography component="span" variant="caption" sx={{ ml: 0.5, opacity: 0.7 }}>
                  ↻
                </Typography>
              )}
            </Typography>
          </Box>
        </Box>
      </TableCell>
      <TableCell align="right" sx={{ ...cellPad, width: isMobile ? 84 : 120 }}>
        <Typography sx={getTaskRowScheduleSx(isMobile)}>
          {formatTaskCardSchedule(tarea, { isMobile })}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

export default TaskRow;
