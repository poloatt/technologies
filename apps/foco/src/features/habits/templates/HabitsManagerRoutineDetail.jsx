import React from 'react';
import { Box, Button, Fade, IconButton, Skeleton, TextField, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  TareaFormHeaderTitleRow,
  taskFormSaveButtonSx,
  taskFormTitleFieldSx,
} from '@shared/components/forms/tareaFormUi';
import HabitChainAfterPicker from '@shared/components/habits/HabitChainAfterPicker.jsx';
import { normalizeHabitStep } from '@shared/habits';

function EmptyRoutineDetail() {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        textAlign: 'center',
        gap: 1.5,
        minHeight: 200,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Selecciona una rutina de la lista
      </Typography>
    </Box>
  );
}

export default function HabitsManagerRoutineDetail({
  chainId,
  draft,
  habits = {},
  customSections = [],
  loading = false,
  saving = false,
  isDirty = false,
  canDelete = true,
  onDraftChange,
  onSave,
  onDelete,
  errors = {},
}) {
  if (!chainId || !draft) {
    return <EmptyRoutineDetail />;
  }

  if (loading && !draft) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Skeleton variant="text" width="60%" height={32} />
        <Skeleton variant="rounded" height={180} />
      </Box>
    );
  }

  const steps = (draft.steps || []).map(normalizeHabitStep).filter(Boolean);
  const saveActive = isDirty && (draft.label || '').trim() && steps.length >= 2;

  return (
    <Fade in key={chainId}>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflowY: 'auto',
          borderLeft: { xs: 0, md: 1 },
          borderTop: { xs: 1, md: 0 },
          borderColor: 'divider',
        }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
          <TareaFormHeaderTitleRow>
            <TextField
              variant="standard"
              fullWidth
              placeholder="Nombre de la rutina"
              value={draft.label || ''}
              onChange={(event) => onDraftChange?.({ label: event.target.value })}
              error={!!errors.label}
              helperText={errors.label}
              sx={{ flex: 1, minWidth: 0, ...taskFormTitleFieldSx }}
            />
          </TareaFormHeaderTitleRow>
        </Box>

        <Box sx={{ px: 2, pb: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              mb: 0.25,
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.03em',
            }}
          >
            Hábitos de la rutina
          </Typography>
          <HabitChainAfterPicker
            habits={habits}
            customSections={customSections}
            linkedSteps={steps}
            onChange={(linkedSteps) => onDraftChange?.({ steps: linkedSteps })}
            flat
          />
          {errors.steps && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
              {errors.steps}
            </Typography>
          )}
        </Box>

        <Box sx={{ flex: 1, minHeight: 0 }} />

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1.5,
            mt: 'auto',
            borderTop: 1,
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <IconButton
            color="error"
            size="small"
            onClick={() => onDelete?.(chainId)}
            disabled={!canDelete || saving}
            aria-label="Eliminar rutina"
            sx={{ flexShrink: 0 }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            variant="contained"
            disabled={!saveActive || saving}
            onClick={onSave}
            sx={{
              ...taskFormSaveButtonSx,
              textTransform: 'none',
              ...(saveActive
                ? {
                  bgcolor: '#ffffff',
                  color: '#202124',
                  opacity: 1,
                  boxShadow: (theme) => theme.shadows[2],
                  '&:hover': {
                    bgcolor: '#f1f3f4',
                    boxShadow: (theme) => theme.shadows[3],
                  },
                }
                : {
                  bgcolor: 'action.hover',
                  color: 'text.disabled',
                  opacity: 0.45,
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    boxShadow: 'none',
                  },
                }),
              '&.Mui-disabled': {
                bgcolor: 'action.hover',
                color: 'text.disabled',
                opacity: 0.45,
              },
            }}
          >
            Guardar cambios
          </Button>
        </Box>
      </Box>
    </Fade>
  );
}
