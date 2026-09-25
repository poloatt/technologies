import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import RutinaDayView from './RutinaDayView';
import { RutinaForm } from './dialogs/RutinaForm';
import { HabitsManager } from '../habits/manager';
import HabitFormDialog from '@shared/components/HabitFormDialog';
import { useRutinasPageController } from './hooks/useRutinasPageController';
import {
  rutinaPageMainSx,
  getRutinaPageContentShellSx,
  rutinaPageScrollSx,
  rutinaPageLoaderSx,
  rutinaErrorStatePaperSx,
} from '@shared/styles/rutinaPageStyles';
import { RUTINA_NAVIGATION_BAR_CONFIG } from '@shared/config/uiConstants';
import { Info as InfoIcon } from '@mui/icons-material';
import clienteAxios from '@shared/config/axios';
import { DietHabitCaptionProvider } from './dietHabitCaptionContext';

function PageStatusMessage({ error }) {
  if (error) {
    return (
      <Paper elevation={0} sx={rutinaErrorStatePaperSx}>
        <InfoIcon color="error" />
        <Typography variant="body2">{error}</Typography>
      </Paper>
    );
  }

  return (
    <Box sx={rutinaPageLoaderSx}>
      <CircularProgress size={32} />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
        Preparando el registro del día…
      </Typography>
    </Box>
  );
}

const RutinasWithContext = () => {
  const {
    effectiveRutina,
    rutinaReadOnly,
    isPreview,
    error,
    editMode,
    rutinaToEdit,
    habitsManagerOpen,
    setHabitsManagerOpen,
    habitFormOpen,
    setHabitFormOpen,
    handleCloseForm,
    isMobileOrTablet,
  } = useRutinasPageController();
  const [dietCaptions, setDietCaptions] = useState({});

  useEffect(() => {
    const fecha = effectiveRutina?.fecha;
    if (!fecha) {
      setDietCaptions({});
      return undefined;
    }
    let cancelled = false;
    clienteAxios.get('/api/dietas/habit-captions', { params: { fecha } })
      .then((response) => {
        if (!cancelled) setDietCaptions(response.data?.captions || {});
      })
      .catch(() => {
        if (!cancelled) setDietCaptions({});
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveRutina?.fecha]);

  // Mantener el día anterior mientras carga el siguiente (evita flash de spinner).
  const showRutinaContent = Boolean(effectiveRutina) && !editMode;
  const showStatus = !showRutinaContent && !editMode;

  return (
    <Box component="main" className="page-main-content" sx={rutinaPageMainSx}>
      <Box sx={{
        ...getRutinaPageContentShellSx(isMobileOrTablet),
        flex: 1,
        minHeight: 0,
        py: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
      >
        <Box sx={rutinaPageScrollSx(isMobileOrTablet, undefined, RUTINA_NAVIGATION_BAR_CONFIG.height)}>
          {showStatus && <PageStatusMessage error={error} />}

          {showRutinaContent && (
            <DietHabitCaptionProvider captions={dietCaptions}>
              <RutinaDayView
                rutina={effectiveRutina}
                readOnly={rutinaReadOnly}
                isPreview={isPreview}
              />
            </DietHabitCaptionProvider>
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
