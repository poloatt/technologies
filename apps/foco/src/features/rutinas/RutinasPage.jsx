import React from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import RutinaTable from './RutinaTable';
import { RutinaForm } from './dialogs/RutinaForm';
import { HabitsManager } from '../habits/manager';
import HabitFormDialog from '@shared/components/HabitFormDialog';
import HubSectionShell from '@shared/components/hub/HubSectionShell';
import { useRutinasPageController } from './hooks/useRutinasPageController';
import {
  rutinaPageMainSx,
  getRutinaPageContentShellSx,
  rutinaPageScrollSx,
  rutinaPageLoaderSx,
  rutinaEmptyStatePaperSx,
  rutinaErrorStatePaperSx,
} from '@shared/styles/rutinaPageStyles';
import { RUTINA_NAVIGATION_BAR_CONFIG } from '@shared/config/uiConstants';
import {
  CalendarMonthOutlined as DateIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

const rutinaHubShellBodySx = {
  pt: 0,
  py: 0.75,
  gap: 0.75,
  minHeight: 0,
  px: 0,
};

function EmptyStateMessage({ error, isFuture = false }) {
  if (error) {
    return (
      <Paper elevation={0} sx={rutinaErrorStatePaperSx}>
        <InfoIcon color="error" />
        <Typography variant="body2">{error}</Typography>
      </Paper>
    );
  }

  if (!isFuture) {
    return (
      <Box sx={rutinaPageLoaderSx}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Preparando el registro del día…
        </Typography>
      </Box>
    );
  }

  return (
    <Paper elevation={0} sx={rutinaEmptyStatePaperSx}>
      <DateIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.7 }} />
      <Typography variant="h6">
        Aún no hay registro para este día
      </Typography>
      <Typography variant="body2" color="text.secondary">
        El registro diario se crea automáticamente. Puedes agregar hábitos con el botón + de la barra superior.
      </Typography>
    </Paper>
  );
}

const RutinasWithContext = () => {
  const {
    rutina,
    rutinas,
    loading,
    error,
    editMode,
    rutinaToEdit,
    currentPage,
    totalPages,
    habitsManagerOpen,
    setHabitsManagerOpen,
    habitFormOpen,
    setHabitFormOpen,
    handleCloseForm,
    isViewingFutureWithoutRecord,
    isMobileOrTablet,
    scrollBottomPadding,
  } = useRutinasPageController();

  return (
    <Box component="main" className="page-main-content" sx={rutinaPageMainSx}>
      <Box sx={{ ...getRutinaPageContentShellSx(isMobileOrTablet), pb: { xs: 10, sm: 4 }, py: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <Box sx={rutinaPageScrollSx(isMobileOrTablet, scrollBottomPadding, RUTINA_NAVIGATION_BAR_CONFIG.height)}>
          {loading && (
            <Box sx={rutinaPageLoaderSx}>
              <CircularProgress />
            </Box>
          )}

          {!loading && !rutina && !editMode && (
            <HubSectionShell
              title="Rutinas"
              iconKey="fitnessCenter"
              shellSx={{ width: '100%' }}
              bodySx={{ ...rutinaHubShellBodySx, pt: 0 }}
            >
              <EmptyStateMessage
                error={error}
                isFuture={isViewingFutureWithoutRecord}
              />
            </HubSectionShell>
          )}

          {!loading && !editMode && rutina && (
            <HubSectionShell
              headerContent={<></>}
              shellSx={{ width: '100%' }}
              bodySx={rutinaHubShellBodySx}
            >
              <RutinaTable
                rutina={{
                  ...rutina,
                  _page: currentPage,
                  _totalPages: totalPages,
                }}
                rutinas={rutinas}
                loading={loading}
                currentPage={currentPage}
                totalPages={totalPages}
              />
            </HubSectionShell>
          )}

          {editMode && (
            <RutinaForm
              open
              onClose={handleCloseForm}
              initialData={rutinaToEdit}
              isEditing={!!rutinaToEdit}
            />
          )}
        </Box>
      </Box>

      <HabitsManager
        open={habitsManagerOpen}
        onClose={() => setHabitsManagerOpen(false)}
      />

      <HabitFormDialog
        open={habitFormOpen}
        onClose={() => setHabitFormOpen(false)}
      />
    </Box>
  );
};

const Rutinas = () => <RutinasWithContext />;

export default Rutinas;
