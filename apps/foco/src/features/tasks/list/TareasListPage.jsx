import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { getTaskHorizonCopy } from '@shared/copy/agendaTerminology';
import { hubSectionTitleSx } from '@shared/styles/hubSectionStyles';
import AgendaCalendarPage from '../../agenda/AgendaCalendarPage';
import TareasTable from './TareasTable';
import TareaDetailPopup from './TareaDetailPopup';
import { useTareasPageController } from './useTareasPageController';
import { useTareasPageView } from './useTareasPageView';
import TareasPageOverlays from './TareasPageOverlays';

function TaskHorizonColumnHeader({ view }) {
  const copy = getTaskHorizonCopy(view);
  return (
    <Box sx={{ mb: 1, px: { xs: 0.5, sm: 0 }, flexShrink: 0 }}>
      <Typography variant="subtitle2" sx={{ ...hubSectionTitleSx, mb: 0 }}>
        {copy.label}
      </Typography>
    </Box>
  );
}

const scrollContainerSx = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  pt: { xs: 1, sm: 0.5 },
  pb: 0,
  px: { xs: 0, sm: 1 },
  overflow: 'hidden',
};

const scrollableColumnSx = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minHeight: 0,
};

const columnSx = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
};

function taskKey(tarea) {
  return String(tarea?._id ?? tarea?.id ?? '');
}

export function TareasListPage() {
  const pageView = useTareasPageView();
  const controller = useTareasPageController();
  const [desktopOpenTask, setDesktopOpenTask] = useState(null);

  const {
    loading,
    objetivos,
    refetchObjetivos,
    isMobile,
    agendaView,
    tareasAgenda,
    tareasAhora,
    tareasLuego,
    tareasTableCommonProps,
    isFormOpen,
    setIsFormOpen,
    editingTarea,
    isGoogleTasksConfigOpen,
    setIsGoogleTasksConfigOpen,
    selectedTareas,
    handleDeactivateMultiSelect,
    handleFormSubmit,
    createWithHistory,
    updateWithHistory,
    deleteWithHistory,
  } = controller;

  const closeDesktopTask = useCallback(() => setDesktopOpenTask(null), []);

  const openFromAhora = useCallback((tarea) => {
    setDesktopOpenTask({ tarea, sourceView: 'ahora' });
  }, []);

  const openFromLuego = useCallback((tarea) => {
    setDesktopOpenTask({ tarea, sourceView: 'luego' });
  }, []);

  const openKey = desktopOpenTask ? taskKey(desktopOpenTask.tarea) : null;
  const openSource = desktopOpenTask?.sourceView ?? null;

  const resolvedDesktopTarea = useMemo(() => {
    if (!openKey || !openSource || !desktopOpenTask) return null;
    const list = openSource === 'ahora' ? tareasAhora : tareasLuego;
    const fresh = (Array.isArray(list) ? list : []).find((t) => taskKey(t) === openKey);
    return fresh || desktopOpenTask.tarea;
  }, [openKey, openSource, desktopOpenTask, tareasAhora, tareasLuego]);

  // Cerrar si la tarea ya no está en la lista.
  useEffect(() => {
    if (isMobile || !openKey || !openSource) return undefined;
    const list = openSource === 'ahora' ? tareasAhora : tareasLuego;
    const exists = (Array.isArray(list) ? list : []).some((t) => taskKey(t) === openKey);
    if (!exists) setDesktopOpenTask(null);
    return undefined;
  }, [isMobile, openKey, openSource, tareasAhora, tareasLuego]);

  useEffect(() => {
    if (isMobile) setDesktopOpenTask(null);
  }, [isMobile]);

  const detailOnLeft = !isMobile && openSource === 'luego';
  const detailOnRight = !isMobile && openSource === 'ahora';

  const detailPopupSharedProps = useMemo(() => ({
    objetivos,
    onSubmit: tareasTableCommonProps.onSubmit,
    onObjetivosUpdate: tareasTableCommonProps.onObjetivosUpdate,
    onDelete: tareasTableCommonProps.onDelete,
    updateWithHistory: tareasTableCommonProps.updateWithHistory,
    onUpdateEstado: tareasTableCommonProps.onUpdateEstado,
    onRefreshData: tareasTableCommonProps.onRefreshData,
  }), [objetivos, tareasTableCommonProps]);

  if (pageView === 'agenda') {
    return <AgendaCalendarPage />;
  }

  const renderDesktopDetail = (sourceView) => (
    <TareaDetailPopup
      open
      onClose={closeDesktopTask}
      tarea={resolvedDesktopTarea}
      isMobile={false}
      agendaView={sourceView}
      desktopHalfScreen
      embedded
      {...detailPopupSharedProps}
    />
  );

  return (
    <Box
      sx={{
        px: { xs: 1, sm: 2, md: 3 },
        width: '100%',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          width: '100%',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={scrollContainerSx}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress />
            </Box>
          ) : isMobile ? (
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <TareasTable {...tareasTableCommonProps} tareas={tareasAgenda} agendaView={agendaView} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <Box sx={columnSx}>
                {detailOnLeft ? (
                  renderDesktopDetail('luego')
                ) : (
                  <>
                    <TaskHorizonColumnHeader view="ahora" />
                    <Box sx={scrollableColumnSx}>
                      <TareasTable
                        {...tareasTableCommonProps}
                        tareas={tareasAhora}
                        agendaView="ahora"
                        suppressDetailPopup
                        onOpenTarea={openFromAhora}
                      />
                    </Box>
                  </>
                )}
              </Box>

              <Box sx={{ width: '1px', bgcolor: 'divider', flexShrink: 0, alignSelf: 'stretch' }} />

              <Box sx={columnSx}>
                {detailOnRight ? (
                  renderDesktopDetail('ahora')
                ) : (
                  <>
                    <TaskHorizonColumnHeader view="luego" />
                    <Box sx={scrollableColumnSx}>
                      <TareasTable
                        {...tareasTableCommonProps}
                        tareas={tareasLuego}
                        agendaView="luego"
                        suppressDetailPopup
                        onOpenTarea={openFromLuego}
                      />
                    </Box>
                  </>
                )}
              </Box>
            </Box>
          )}
        </Box>

        <TareasPageOverlays
          isMobile={isMobile}
          isFormOpen={isFormOpen}
          setIsFormOpen={setIsFormOpen}
          editingTarea={editingTarea}
          objetivos={objetivos}
          refetchObjetivos={refetchObjetivos}
          handleFormSubmit={handleFormSubmit}
          createWithHistory={createWithHistory}
          updateWithHistory={updateWithHistory}
          deleteWithHistory={deleteWithHistory}
          isGoogleTasksConfigOpen={isGoogleTasksConfigOpen}
          setIsGoogleTasksConfigOpen={setIsGoogleTasksConfigOpen}
          selectedTareas={selectedTareas}
          onDeactivateMultiSelect={handleDeactivateMultiSelect}
        />
      </Box>
    </Box>
  );
}

export default TareasListPage;
