import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
} from '@mui/material';
import { useResponsive } from '@shared/hooks';
import { DEFAULT_HABIT_ICON } from '@shared/utils/habitIcons';
import { Z_INDEX } from '@shared/config/uiConstants';
import {
  tareaFormDialogPaperSx,
  TareaFormHeader,
  TareaFormFooter,
  TareaFormTipoSelector,
  HabitFormTitleField,
  TareaFormHeaderTitleRow,
  taskFormTitleFieldSx,
} from '@shared/components/forms/tareaFormUi';

const CREATE_TYPE_OPTIONS = [
  { value: 'habits', label: 'Hábito' },
  { value: 'routines', label: 'Rutina' },
];

export default function HabitsManagerCreateDialog({
  open,
  onClose,
  onSave,
  saving = false,
  initialType = 'habits',
  defaultSection = 'bodyCare',
  sectionOptions = [],
  onCreateSection,
  createSectionLabel = 'Nuevo grupo',
  zIndex = Z_INDEX.modalOverlay,
}) {
  const { isMobile } = useResponsive();
  const [type, setType] = useState(initialType);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState(DEFAULT_HABIT_ICON);
  const [section, setSection] = useState(defaultSection);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setLabel('');
    setIcon(DEFAULT_HABIT_ICON);
    setSection(defaultSection);
    setErrors({});
  }, [open, initialType, defaultSection]);

  const handleSave = async () => {
    const trimmedLabel = (label || '').trim();
    const nextErrors = {};

    if (!trimmedLabel) {
      nextErrors.label = 'El nombre es requerido';
    }
    if (type === 'habits' && !icon) {
      nextErrors.icon = 'Debe seleccionar un icono';
    }
    if (type === 'habits' && !section) {
      nextErrors.section = 'Selecciona un grupo';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSave?.({
      type,
      label: trimmedLabel,
      icon,
      section,
    });
  };

  const isHabit = type === 'habits';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="xs"
      sx={{ zIndex }}
      PaperProps={{
        sx: {
          ...tareaFormDialogPaperSx(isMobile),
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <TareaFormHeader onClose={onClose} closeLabel="Cancelar">
        <Typography variant="h6" sx={{ fontWeight: 400, fontSize: '1.125rem', pr: 4 }}>
          {isHabit ? 'Nuevo hábito' : 'Nueva rutina'}
        </Typography>
      </TareaFormHeader>

      <DialogContent sx={{ pt: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TareaFormTipoSelector
            value={type}
            options={CREATE_TYPE_OPTIONS}
            onChange={setType}
          />

          {isHabit ? (
            <HabitFormTitleField
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              icon={icon}
              onIconChange={setIcon}
              placeholder="Nombre del hábito"
              error={Boolean(errors.label)}
              helperText={errors.label}
              iconError={Boolean(errors.icon)}
              section={section}
              onSectionChange={setSection}
              sectionOptions={sectionOptions}
              sectionError={errors.section}
              showSection
              onCreateSection={onCreateSection}
              createSectionLabel={createSectionLabel}
              autoFocus
              required
            />
          ) : (
            <TareaFormHeaderTitleRow>
              <TextField
                variant="standard"
                fullWidth
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Nombre de la rutina"
                error={Boolean(errors.label)}
                helperText={errors.label}
                autoFocus
                sx={{ flex: 1, minWidth: 0, ...taskFormTitleFieldSx }}
              />
            </TareaFormHeaderTitleRow>
          )}
        </Box>
      </DialogContent>

      <TareaFormFooter
        onCancel={onClose}
        showCancel
        onSave={handleSave}
        cancelLabel="Cancelar"
        saveLabel={isHabit ? 'Crear hábito' : 'Crear rutina'}
        saving={saving}
      />
    </Dialog>
  );
}
