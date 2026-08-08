import React, { useEffect, useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableContainer,
  Paper,
  Box,
  Stack,
} from '@mui/material';
import { useResponsive } from '@shared/hooks';
import { isToday, isThisWeek, isThisMonth, addMonths, isBefore } from 'date-fns';
import TareaDetailPopup from './TareaDetailPopup';
import TareaActionsPopover from './TareaActionsPopover';
import { HabitCarouselAhora, HabitCarouselLuego } from '../../habits';
import {
  getAgendaBucket,
  getAgendaSortKey,
  isTaskArchived,
  isTaskCompleted,
  isTaskCancelled,
  parseTaskDate,
} from '@shared/utils/agendaRules';
import { CADENCIA_WEEK_STARTS_ON } from '@shared/habits';
import { normalizeTaskList } from '@shared/utils/taskListUtils';
import { TaskRow, TaskGroupSection } from '@shared/components/tasks';
import {
  getTaskSurfaceTokens,
  getTaskListStackSx,
} from '@shared/styles/taskListStyles';

const WEEK_OPTS = { weekStartsOn: CADENCIA_WEEK_STARTS_ON };

const getPeriodo = (tarea, isArchive = false, agendaView = 'ahora') => {
  if (isArchive) {
    const fechaReferencia = parseTaskDate(
      tarea?.fechaVencimiento || tarea?.fechaFin || tarea?.vencimiento || tarea?.dueDate || tarea?.fecha ||
      tarea?.fechaInicio || tarea?.inicio || tarea?.start
    );

    if (!fechaReferencia) return 'SIN FECHA';
    if (isToday(fechaReferencia)) return 'HOY';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isBefore(fechaReferencia, today) && isThisWeek(fechaReferencia, WEEK_OPTS)) return 'ESTA SEMANA';
    if (isBefore(fechaReferencia, today) && isThisMonth(fechaReferencia)) return 'ESTE MES';
    if (isBefore(fechaReferencia, addMonths(today, -3))) return 'ÚLTIMO TRIMESTRE';
    if (isBefore(fechaReferencia, addMonths(today, -12))) return 'ÚLTIMO AÑO';
    return 'MÁS ANTIGUO';
  }

  const isCompleted = isTaskCompleted(tarea);
  if (!isCompleted && agendaView === 'ahora') {
    const fechaVencimiento = parseTaskDate(tarea?.fechaVencimiento || tarea?.fechaFin || tarea?.vencimiento || tarea?.dueDate);
    if (fechaVencimiento) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const vencimiento = new Date(fechaVencimiento);
      vencimiento.setHours(0, 0, 0, 0);
      if (vencimiento < today) return 'RETRASADAS';
    }
  }

  return getAgendaBucket(tarea, agendaView);
};

const ordenarTareas = (tareas) => tareas.sort((a, b) => {
  const aRef = getAgendaSortKey(a);
  const bRef = getAgendaSortKey(b);
  if (!aRef && !bRef) return 0;
  if (!aRef) return 1;
  if (!bRef) return -1;
  return aRef - bRef;
});

const listScrollSx = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  '&::-webkit-scrollbar': { width: { xs: '4px', sm: '8px' } },
  '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.1)' },
  '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' },
  '&::-webkit-scrollbar-thumb:hover': { backgroundColor: 'rgba(0,0,0,0.3)' },
};

const TareasTable = ({
  tareas,
  onSubmit,
  onObjetivosUpdate,
  onDelete,
  onUpdateEstado,
  isArchive = false,
  showValues,
  updateWithHistory,
  isMultiSelectMode = false,
  selectedTareas = [],
  onSelectTarea,
  onActivateMultiSelect,
  groupingEnabled = true,
  agendaView = 'ahora',
  showCompleted = false,
  onRefreshData,
  showHabitCarousel = true,
  objetivos = [],
  suppressDetailPopup = false,
  onOpenTarea,
}) => {
  const [openTareaId, setOpenTareaId] = useState(null);
  const [expandedPeriodo, setExpandedPeriodo] = useState(null);
  const [actionsMenu, setActionsMenu] = useState(null); // { tarea, anchorEl }
  const { isMobile, theme } = useResponsive();
  const { layoutBg, surfaceBg } = getTaskSurfaceTokens(theme);
  const stackTokens = getTaskListStackSx(isMobile);
  const shouldShowRutinas = showHabitCarousel && !isArchive && (agendaView === 'ahora' || agendaView === 'luego');
  const groupsCollapsible = !isArchive;

  const renderHabitCarousel = () => (
    <Paper
      elevation={0}
      sx={{
        bgcolor: layoutBg,
        borderRadius: 1.5,
        overflow: 'hidden',
        mx: isMobile ? 0 : 'auto',
        width: '100%',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          px: isMobile ? 0.75 : 2,
          py: isMobile ? 0.75 : 0.5,
          bgcolor: surfaceBg,
        }}
      >
        {agendaView === 'ahora' ? (
          <HabitCarouselAhora
            variant="iconsRow"
            showDividers={false}
            showCompletedToggle
            mobile={isMobile}
            dense={!isMobile}
          />
        ) : (
          <HabitCarouselLuego
            variant="iconsRow"
            showDividers={false}
            showCompletedToggle
            mobile={isMobile}
            dense={!isMobile}
          />
        )}
      </Box>
    </Paper>
  );

  const tareasAMostrar = normalizeTaskList(
    isArchive
      ? (Array.isArray(tareas) ? tareas.filter((tarea) => isTaskArchived(tarea)) : [])
      : (Array.isArray(tareas)
        ? tareas.filter((tarea) => {
          if (isTaskCancelled(tarea)) return false;
          return showCompleted || !isTaskCompleted(tarea);
        })
        : []),
  );

  const handleToggleTarea = (tareaId) => {
    if (typeof onOpenTarea === 'function') {
      const tarea = tareasAMostrar.find((t) => String(t._id || t.id) === String(tareaId));
      if (tarea) onOpenTarea(tarea);
      return;
    }
    setOpenTareaId((prevId) => (prevId === tareaId ? null : tareaId));
  };

  const handleOpenActions = (tarea, anchorEl) => {
    setActionsMenu({ tarea, anchorEl });
  };

  const handleCloseActions = () => setActionsMenu(null);

  const taskRowKey = (tarea) => String(tarea?._id ?? tarea?.id ?? '');
  const desktopHalfScreen = !isMobile && !isArchive;
  const openTarea = !suppressDetailPopup && openTareaId
    ? tareasAMostrar.find((t) => String(t._id || t.id) === String(openTareaId))
    : null;

  const renderTaskPopup = () => {
    if (suppressDetailPopup) return null;
    return (
      <TareaDetailPopup
        open={!!openTarea}
        onClose={() => setOpenTareaId(null)}
        tarea={openTarea}
        isMobile={isMobile}
        agendaView={agendaView}
        desktopHalfScreen={desktopHalfScreen}
        objetivos={objetivos}
        onSubmit={onSubmit}
        onObjetivosUpdate={onObjetivosUpdate}
        onDelete={onDelete}
        updateWithHistory={updateWithHistory}
        onUpdateEstado={onUpdateEstado}
        onRefreshData={onRefreshData}
      />
    );
  };

  const renderActionsPopover = () => (
    <TareaActionsPopover
      open={Boolean(actionsMenu?.anchorEl && actionsMenu?.tarea)}
      anchorEl={actionsMenu?.anchorEl || null}
      onClose={handleCloseActions}
      tarea={actionsMenu?.tarea || null}
      onEdit={(tarea) => {
        handleCloseActions();
        handleToggleTarea(tarea?._id || tarea?.id);
      }}
      onDelete={onDelete}
      updateWithHistory={updateWithHistory}
      onUpdateEstado={onUpdateEstado}
      onRefreshData={onRefreshData}
    />
  );

  const commonRowProps = {
    isArchive,
    showValues,
    isMultiSelectMode,
    selectedTareas,
    onSelectTarea,
    onToggleOpen: handleToggleTarea,
    onOpenActions: handleOpenActions,
    agendaView,
    isMobile,
  };

  const renderTaskTable = (items) => (
    <TableContainer sx={{ bgcolor: layoutBg }}>
      <Table
        size="small"
        sx={{ '& .MuiTableCell-root': { borderBottom: 'none' } }}
      >
        <TableBody>
          {items.map((tarea) => (
            <TaskRow
              key={taskRowKey(tarea)}
              tarea={tarea}
              {...commonRowProps}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const tareasAgrupadas = useMemo(() => {
    const grupos = tareasAMostrar.reduce((acc, tarea) => {
      const periodo = getPeriodo(tarea, isArchive, agendaView);
      if (!acc[periodo]) acc[periodo] = [];
      acc[periodo].push(tarea);
      return acc;
    }, {});

    Object.keys(grupos).forEach((periodo) => {
      grupos[periodo] = ordenarTareas(grupos[periodo]);
    });

    return grupos;
  }, [tareasAMostrar, isArchive, agendaView]);

  const periodosOrdenados = useMemo(() => {
    const ordenPeriodosArchivo = ['HOY', 'ESTA SEMANA', 'ESTE MES', 'ÚLTIMO TRIMESTRE', 'ÚLTIMO AÑO', 'MÁS ANTIGUO', 'SIN FECHA'];
    const ordenPeriodosActivasAhora = ['RETRASADAS', 'HOY', 'MAÑANA', 'ESTA SEMANA', 'ESTE MES', 'PRÓXIMO TRIMESTRE', 'ESTE AÑO', 'MÁS ADELANTE', 'SIN FECHA'];
    const ordenPeriodosActivasLuego = ['ESTA SEMANA', 'ESTE MES', 'PRÓXIMO MES', 'PRÓXIMO TRIMESTRE', 'ESTE AÑO', 'MÁS ADELANTE', 'SIN FECHA'];
    const ordenPeriodosActivas = agendaView === 'luego' ? ordenPeriodosActivasLuego : ordenPeriodosActivasAhora;
    const ordenPeriodos = isArchive ? ordenPeriodosArchivo : ordenPeriodosActivas;
    return Object.keys(tareasAgrupadas).sort(
      (a, b) => ordenPeriodos.indexOf(a) - ordenPeriodos.indexOf(b),
    );
  }, [tareasAgrupadas, agendaView, isArchive]);

  const periodosKey = periodosOrdenados.join('|');

  useEffect(() => {
    if (!groupsCollapsible) {
      setExpandedPeriodo(null);
      return;
    }
    setExpandedPeriodo((prev) => {
      if (periodosOrdenados.length === 0) return null;
      if (prev && periodosOrdenados.includes(prev)) return prev;
      // Ahora: RETRASADAS primero si existe; Luego: el grupo más próximo.
      return periodosOrdenados[0];
    });
  }, [groupsCollapsible, periodosKey, periodosOrdenados]);

  const handleTogglePeriodo = (periodo) => {
    setExpandedPeriodo((prev) => {
      // Acordeón: un grupo a la vez; tocar el abierto lo deja abierto (siempre hay uno).
      if (prev === periodo) return prev;
      return periodo;
    });
  };

  const rootSx = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    height: '100%',
  };

  if (!groupingEnabled) {
    return (
      <>
        <Box sx={rootSx}>
          {shouldShowRutinas && (
            <Box sx={{ flexShrink: 0, pb: stackTokens.spacing }}>
              {renderHabitCarousel()}
            </Box>
          )}
          <Box sx={{ ...listScrollSx, pb: stackTokens.pb }}>
            {renderTaskTable(tareasAMostrar)}
          </Box>
        </Box>
        {renderTaskPopup()}
        {renderActionsPopover()}
      </>
    );
  }

  // Archivo: lista completa scrolleable (sin acordeón).
  if (!groupsCollapsible) {
    return (
      <>
        <Box sx={rootSx}>
          <Box sx={listScrollSx}>
            <Stack spacing={stackTokens.spacing} sx={{ pb: stackTokens.pb }}>
              {periodosOrdenados.map((periodo) => (
                <TaskGroupSection
                  key={periodo}
                  title={periodo}
                  count={tareasAgrupadas[periodo].length}
                  isMobile={isMobile}
                >
                  {renderTaskTable(tareasAgrupadas[periodo])}
                </TaskGroupSection>
              ))}
            </Stack>
          </Box>
        </Box>
        {renderTaskPopup()}
        {renderActionsPopover()}
      </>
    );
  }

  // Activas: carousel fijo + grupos en acordeón.
  // Los encabezados quedan siempre visibles; solo scrollean las tareas del grupo abierto.
  return (
    <>
      <Box sx={rootSx}>
        {shouldShowRutinas && (
          <Box
            sx={{
              flexShrink: 0,
              pb: stackTokens.spacing,
              bgcolor: layoutBg,
              zIndex: 3,
            }}
          >
            {renderHabitCarousel()}
          </Box>
        )}

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: stackTokens.spacing,
          }}
        >
          {periodosOrdenados.map((periodo) => {
            const isExpanded = expandedPeriodo === periodo;
            return (
              <Box
                key={periodo}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: isExpanded ? 1 : '0 0 auto',
                  minHeight: 0,
                  minWidth: 0,
                }}
              >
                <TaskGroupSection
                  title={periodo}
                  count={tareasAgrupadas[periodo].length}
                  isMobile={isMobile}
                  collapsible
                  expanded={isExpanded}
                  onToggle={() => handleTogglePeriodo(periodo)}
                  shellSx={
                    isExpanded
                      ? {
                          flex: 1,
                          minHeight: 0,
                          display: 'flex',
                          flexDirection: 'column',
                        }
                      : undefined
                  }
                  contentSx={
                    isExpanded
                      ? {
                          flex: 1,
                          minHeight: 0,
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          pb: stackTokens.pb,
                          '&::-webkit-scrollbar': { width: { xs: '4px', sm: '8px' } },
                          '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.1)' },
                          '&::-webkit-scrollbar-thumb': {
                            backgroundColor: 'rgba(0,0,0,0.2)',
                            borderRadius: '4px',
                          },
                        }
                      : undefined
                  }
                >
                  {isExpanded ? renderTaskTable(tareasAgrupadas[periodo]) : null}
                </TaskGroupSection>
              </Box>
            );
          })}
        </Box>
      </Box>
      {renderTaskPopup()}
      {renderActionsPopover()}
    </>
  );
};

export default TareasTable;
