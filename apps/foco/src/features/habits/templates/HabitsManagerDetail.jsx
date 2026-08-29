import React from 'react';
import { Box, Button, Fade, IconButton, Skeleton, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  HabitFormTitleField,
  taskFormSaveButtonSx,
} from '@shared/components/forms/tareaFormUi';
import { DEFAULT_HABIT_ICON } from '@shared/utils/habitIcons';
import HabitFormFields from '@shared/components/habits/HabitFormFields.jsx';
import HabitFormMetaRows from '@shared/components/habits/HabitFormMetaRows.jsx';
import { DEFAULT_HABIT_CONFIG, HABIT_SECTION_OPTIONS } from '@shared/habits/form';

function EmptyDetail({ onAddClick }) {
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
        Selecciona un hábito de la lista o crea uno nuevo
      </Typography>
      <Button size="small" variant="outlined" onClick={onAddClick} sx={{ textTransform: 'none' }}>
        Agregar hábito
      </Button>
    </Box>
  );
}

export default function HabitsManagerDetail({
  mode,
  habit,
  editDraft,
  formData,
  errors = {},
  currentSection,
  sectionOptions = HABIT_SECTION_OPTIONS,
  onCreateSection,
  createSectionLabel = 'Nuevo grupo',
  loading,
  saving = false,
  isDirty = false,
  canDelete = true,
  onFormChange,
  onDraftChange,
  onSectionChange,
  onConfigChange,
  onSaveCreate,
  onSaveEdit,
  onDelete,
  onAddClick,
  habits = {},
  customSections = [],
  habitChains = [],
  chainConfig = { enabled: false, linkedSteps: [], chainId: null },
  onChainConfigChange,
  onSectionRenameSave,
  onRoutineRenameSave,
}) {
  if (mode === 'empty') {
    return <EmptyDetail onAddClick={onAddClick} />;
  }

  if (loading && mode === 'edit' && !habit) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Skeleton variant="text" width="60%" height={32} />
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={180} />
      </Box>
    );
  }

  const isCreate = mode === 'create';
  const draft = isCreate ? formData : editDraft;
  const config = isCreate
    ? (formData?.config || DEFAULT_HABIT_CONFIG)
    : (editDraft?.config || DEFAULT_HABIT_CONFIG);
  const activeSection = isCreate ? (formData?.section || currentSection) : (editDraft?.section || currentSection);
  const currentHabitId = isCreate ? null : (habit?.id || null);
  const saveActive = isCreate ? Boolean((draft?.label || '').trim()) : isDirty;

  const handleSectionChange = (newSection) => {
    if (isCreate) {
      onSectionChange?.(newSection);
    } else {
      onDraftChange?.({ section: newSection });
    }
  };

  const metaProps = {
    section: activeSection,
    onSectionChange: handleSectionChange,
    sectionOptions,
    sectionError: errors.section,
    onCreateSection,
    createSectionLabel,
    chainConfig,
    onChainConfigChange,
    habitChains,
    habits,
    currentSection: activeSection,
    currentHabitId,
    customSections,
    chainError: errors.chain,
    showRowIcons: false,
  };

  return (
    <Fade in key={isCreate ? 'create' : habit?.id}>
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
          <HabitFormTitleField
            value={draft?.label || ''}
            onChange={(e) => {
              if (isCreate) {
                onFormChange?.({ label: e.target.value });
              } else {
                onDraftChange?.({ label: e.target.value });
              }
            }}
            icon={draft?.icon || DEFAULT_HABIT_ICON}
            onIconChange={(icon) => {
              if (isCreate) {
                onFormChange?.({ icon });
              } else {
                onDraftChange?.({ icon });
              }
            }}
            placeholder="Nombre del hábito"
            error={!!errors.label}
            iconError={!!errors.icon}
            helperText={errors.label || (isCreate ? 'El ID se genera automáticamente' : undefined)}
            autoFocus={isCreate}
          />
        </Box>

        <Box sx={{ px: 2, pb: 0.5 }}>
          <HabitFormMetaRows
            {...metaProps}
            showGroupDivider={false}
            showRoutine
            showFieldLabels
            enablePillRename
            onSectionRenameSave={onSectionRenameSave}
            onRoutineRenameSave={onRoutineRenameSave}
            routinePickerInline={false}
          />
        </Box>

        <Box sx={{ px: 2, pb: 1 }}>
          <HabitFormFields
            section={activeSection}
            onSectionChange={handleSectionChange}
            config={config}
            onConfigChange={onConfigChange}
            errors={errors}
            showSection={false}
            showIconPicker={false}
            showCadence
            hideCadenceTopDivider
          />
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
          {!isCreate && (
            <IconButton
              color="error"
              size="small"
              onClick={() => onDelete?.(habit?.id)}
              disabled={!canDelete || saving}
              aria-label="Eliminar hábito"
              sx={{ flexShrink: 0 }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          )}
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            variant="contained"
            disabled={!saveActive || saving}
            onClick={isCreate ? onSaveCreate : onSaveEdit}
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
            {isCreate ? 'Agregar hábito' : 'Guardar cambios'}
          </Button>
        </Box>
      </Box>
    </Fade>
  );
}
