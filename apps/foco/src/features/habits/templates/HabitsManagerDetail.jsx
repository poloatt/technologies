import React from 'react';
import {
  Box,
  Button,
  Fade,
  Skeleton,
  Typography,
} from '@mui/material';
import {
  TareaFormFooter,
  HabitFormTitleField,
} from '@shared/components/forms/tareaFormUi';
import { DEFAULT_HABIT_ICON } from '@shared/utils/habitIcons';
import HabitFormFields from '@shared/components/habits/HabitFormFields.jsx';
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
  onCancelCreate,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onAddClick,
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
        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
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
            showSection
            section={isCreate ? (formData?.section || currentSection) : (editDraft?.section || currentSection)}
            onSectionChange={(newSection) => {
              if (isCreate) {
                onSectionChange?.(newSection);
              } else {
                onDraftChange?.({ section: newSection });
              }
            }}
            sectionOptions={sectionOptions}
            sectionError={errors.section}
            onCreateSection={onCreateSection}
            createSectionLabel={createSectionLabel}
          />
        </Box>

        <Box sx={{ px: 1, pb: 2, flex: 1 }}>
          <HabitFormFields
            section={isCreate ? (formData?.section || currentSection) : (editDraft?.section || currentSection)}
            onSectionChange={(newSection) => {
              if (isCreate) {
                onSectionChange?.(newSection);
              } else {
                onDraftChange?.({ section: newSection });
              }
            }}
            config={config}
            onConfigChange={onConfigChange}
            errors={errors}
            showSection={false}
            showIconPicker={false}
            showCadence
          />
        </Box>

        <Box sx={{ px: 0, pb: 0, mt: 'auto', borderTop: 1, borderColor: 'divider' }}>
          {isCreate ? (
            <TareaFormFooter
              onSave={onSaveCreate}
              saveLabel="Agregar hábito"
              saving={loading}
              showCancel
              onCancel={onCancelCreate}
              cancelLabel="Cancelar"
            />
          ) : (
            <TareaFormFooter
              onSave={onSaveEdit}
              saveLabel="Guardar cambios"
              saving={saving}
              disabled={!isDirty}
              showCancel={isDirty}
              onCancel={onCancelEdit}
              cancelLabel="Descartar"
              leftAction={(
                <Button
                  color="error"
                  size="small"
                  onClick={() => onDelete?.(habit?.id)}
                  disabled={!canDelete || saving}
                  sx={{ textTransform: 'none' }}
                >
                  Eliminar hábito
                </Button>
              )}
            />
          )}
        </Box>
      </Box>
    </Fade>
  );
}
