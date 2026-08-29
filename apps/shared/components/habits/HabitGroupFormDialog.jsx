import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
} from '@mui/material';
import { useResponsive } from '@shared/hooks';
import { DEFAULT_HABIT_ICON } from '@shared/utils/habitIcons';
import { Z_INDEX } from '@shared/config/uiConstants';
import {
  tareaFormDialogPaperSx,
  TareaFormHeader,
  TareaFormFooter,
  HabitFormTitleField,
} from '@shared/components/forms/tareaFormUi';

export default function HabitGroupFormDialog({
  open,
  onClose,
  onSave,
  saving = false,
  mode = 'create',
  initialSection = null,
  zIndex = Z_INDEX.modalOverlay,
}) {
  const { isMobile } = useResponsive();
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState(DEFAULT_HABIT_ICON);
  const [errors, setErrors] = useState({});
  const isEdit = mode === 'edit';

  useEffect(() => {
    if (!open) return;
    if (isEdit && initialSection) {
      setLabel(initialSection.label || '');
      setIcon(initialSection.icon || DEFAULT_HABIT_ICON);
    } else {
      setLabel('');
      setIcon(DEFAULT_HABIT_ICON);
    }
    setErrors({});
  }, [open, isEdit, initialSection]);

  const handleSave = async () => {
    const nextErrors = {};
    const trimmedLabel = (label || '').trim();

    if (!trimmedLabel) {
      nextErrors.label = 'El nombre es requerido';
    }
    if (!icon) {
      nextErrors.icon = 'Debe seleccionar un icono';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSave?.({ label: trimmedLabel, icon });
  };

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
          {isEdit ? 'Editar grupo' : 'Nuevo grupo'}
        </Typography>
      </TareaFormHeader>

      <DialogContent sx={{ pt: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <HabitFormTitleField
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            icon={icon}
            onIconChange={setIcon}
            placeholder="Nombre del grupo"
            error={Boolean(errors.label)}
            helperText={errors.label}
            iconError={Boolean(errors.icon)}
            required
            autoFocus
          />
        </Box>
      </DialogContent>

      <TareaFormFooter
        onCancel={onClose}
        showCancel
        onSave={handleSave}
        cancelLabel="Cancelar"
        saveLabel={isEdit ? 'Guardar cambios' : 'Agregar grupo'}
        saving={saving}
      />
    </Dialog>
  );
}
