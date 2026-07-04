import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { getTaskHorizonCopy } from '@shared/copy/agendaTerminology';
import { hubSectionTitleSx } from '@shared/styles/hubSectionStyles';
import AgendaCalendarPage from '../../agenda/AgendaCalendarPage';
import TareasTable from './TareasTable';
import { useTareasPageController } from './useTareasPageController';
import { useTareasPageView } from './useTareasPageView';
import TareasPageOverlays from './TareasPageOverlays';

function TaskHorizonColumnHeader({ view }) {
  const copy = getTaskHorizonCopy(view);
  return (
    <Box sx={{ mb: 1, px: { xs: 0.5, sm: 0 } }}>
      <Typography variant="subtitle2" sx={{ ...hubSectionTitleSx, mb: 0 }}>
        {copy.label}
      </Typography>
    </Box>
  );
}

const scrollContainerSx = {
  py: { xs: 1, sm: 2 },
  px: { xs: 0, sm: 1 },
  height: { xs: 'calc(100vh - 160px)', sm: 'calc(100vh - 170px)' },
  overflowY: { xs: 'auto', sm: 'hidden' },
  overflowX: 'hidden',
  pb: { xs: 8, sm: 12 },
  '&::-webkit-scrollbar': { width: { xs: '4px', sm: '8px' } },
  '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.1)' },
  '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' },
  '&::-webkit-scrollbar-thumb:hover': { backgroundColor: 'rgba(0,0,0,0.3)' },
};

const scrollableColumnSx = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  minHeight: 0,
  pb: 10,
  '&::-webkit-scrollbar': { width: '8px' },
  '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.1)' },
  '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' },
  '&::-webkit-scrollbar-thumb:hover': { backgroundColor: 'rgba(0,0,0,0.3)' },
};

export function TareasListPage() {
  const pageView = useTareasPageView();
  const controller = useTareasPageController();

  if (pageView === 'agenda') {
    return <AgendaCalendarPage />;
  }

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

  return (
    <Box sx={{ px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
      <Box sx={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={scrollContainerSx}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
              <CircularProgress />
            </Box>
          ) : isMobile ? (
            <TareasTable {...tareasTableCommonProps} tareas={tareasAgenda} agendaView={agendaView} />
          ) : (
            <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0, overflow: 'hidden', height: '100%' }}>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                <TaskHorizonColumnHeader view="ahora" />
                <Box sx={scrollableColumnSx}>
                  <TareasTable
                    {...tareasTableCommonProps}
                    tareas={tareasAhora}
                    agendaView="ahora"
                  />
                </Box>
              </Box>

              <Box sx={{ width: '1px', bgcolor: 'divider', flexShrink: 0 }} />

              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                <TaskHorizonColumnHeader view="luego" />
                <Box sx={scrollableColumnSx}>
                  <TareasTable
                    {...tareasTableCommonProps}
                    tareas={tareasLuego}
                    agendaView="luego"
                  />
                </Box>
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
