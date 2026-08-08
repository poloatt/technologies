import React, { useState } from 'react';
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
import { HabitCarouselAhora, HabitCarouselLuego } from '../../habits';
import {
  getAgendaBucket,
  getAgendaSortKey,
  isTaskCompleted,
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
}) => {
  const [openTareaId, setOpenTareaId] = useState(null);
  const { isMobile, theme } = useResponsive();
  const { layoutBg, surfaceBg } = getTaskSurfaceTokens(theme);
  const stackTokens = getTaskListStackSx(isMobile);
  const shouldShowRutinas = showHabitCarousel && !isArchive && (agendaView === 'ahora' || agendaView === 'luego');

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

  const handleToggleTarea = (tareaId) => {
    setOpenTareaId((prevId) => (prevId === tareaId ? null : tareaId));
  };

  const tareasAMostrar = normalizeTaskList(
    isArchive
      ? (Array.isArray(tareas) ? tareas.filter((tarea) => isTaskCompleted(tarea)) : [])
      : (Array.isArray(tareas)
        ? tareas.filter((tarea) => showCompleted || !isTaskCompleted(tarea))
        : []),
  );

  const taskRowKey = (tarea) => String(tarea?._id ?? tarea?.id ?? '');
  const desktopHalfScreen = !isMobile && !isArchive;
  const openTarea = openTareaId
    ? tareasAMostrar.find((t) => String(t._id || t.id) === String(openTareaId))
    : null;

  const renderTaskPopup = () => (
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

  const commonRowProps = {
    isArchive,
    showValues,
    isMultiSelectMode,
    selectedTareas,
    onSelectTarea,
    onToggleOpen: handleToggleTarea,
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

  if (!groupingEnabled) {
    return (
      <>
        <Stack spacing={stackTokens.spacing} sx={{ pb: stackTokens.pb }}>
          {shouldShowRutinas && renderHabitCarousel()}
          {renderTaskTable(tareasAMostrar)}
        </Stack>
        {renderTaskPopup()}
      </>
    );
  }

  const tareasAgrupadas = tareasAMostrar.reduce((grupos, tarea) => {
    const periodo = getPeriodo(tarea, isArchive, agendaView);
    if (!grupos[periodo]) grupos[periodo] = [];
    grupos[periodo].push(tarea);
    return grupos;
  }, {});

  Object.keys(tareasAgrupadas).forEach((periodo) => {
    tareasAgrupadas[periodo] = ordenarTareas(tareasAgrupadas[periodo]);
  });

  const ordenPeriodosArchivo = ['HOY', 'ESTA SEMANA', 'ESTE MES', 'ÚLTIMO TRIMESTRE', 'ÚLTIMO AÑO', 'MÁS ANTIGUO', 'SIN FECHA'];
  const ordenPeriodosActivasAhora = ['RETRASADAS', 'HOY', 'MAÑANA', 'ESTA SEMANA', 'ESTE MES', 'PRÓXIMO TRIMESTRE', 'ESTE AÑO', 'MÁS ADELANTE', 'SIN FECHA'];
  const ordenPeriodosActivasLuego = ['ESTA SEMANA', 'ESTE MES', 'PRÓXIMO MES', 'PRÓXIMO TRIMESTRE', 'ESTE AÑO', 'MÁS ADELANTE', 'SIN FECHA'];
  const ordenPeriodosActivas = agendaView === 'luego' ? ordenPeriodosActivasLuego : ordenPeriodosActivasAhora;
  const ordenPeriodos = isArchive ? ordenPeriodosArchivo : ordenPeriodosActivas;
  const periodosOrdenados = Object.keys(tareasAgrupadas).sort(
    (a, b) => ordenPeriodos.indexOf(a) - ordenPeriodos.indexOf(b),
  );

  return (
    <>
      <Stack spacing={stackTokens.spacing} sx={{ pb: stackTokens.pb }}>
        {shouldShowRutinas && renderHabitCarousel()}

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
      {renderTaskPopup()}
    </>
  );
};

export default TareasTable;
