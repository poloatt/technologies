import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
} from '@mui/material';
import { useResponsive } from '@shared/hooks';
import { Z_INDEX } from '@shared/config/uiConstants';
import {
  tareaFormDialogPaperSx,
  TareaFormHeader,
  TareaFormFooter,
  TareaFormHeaderTitleRow,
  taskFormTitleFieldSx,
} from '@shared/components/forms/tareaFormUi';

export default function HabitRoutineFormDialog({
  open,
  onClose,
  onSave,
  saving = false,
  mode = 'create',
  initialLabel = '',
  zIndex = Z_INDEX.modalOverlay,
}) {
  const { isMobile } = useResponsive();
  const [label, setLabel] = useState('');
  const [errors, setErrors] = useState({});
  const isEdit = mode === 'edit';

  useEffect(() => {
    if (!open) return;
    setLabel(isEdit ? (initialLabel || '') : '');
    setErrors({});
  }, [open, isEdit, initialLabel]);

  const handleSave = async () => {
    const trimmedLabel = (label || '').trim();
    const nextErrors = {};

    if (!trimmedLabel) {
      nextErrors.label = 'El nombre es requerido';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSave?.({ label: trimmedLabel });
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
          {isEdit ? 'Editar rutina' : 'Nueva rutina'}
        </Typography>
      </TareaFormHeader>

      <DialogContent sx={{ pt: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
        </Box>
      </DialogContent>

      <TareaFormFooter
        pinned
        onCancel={onClose}
        showCancel
        onSave={handleSave}
        cancelLabel="Cancelar"
        saveLabel={isEdit ? 'Guardar cambios' : 'Crear rutina'}
        saving={saving}
      />
    </Dialog>
  );
}
