import React from 'react';
import { Box, Button, IconButton } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { taskFormSaveButtonSx } from '@shared/components/forms/tareaFormUi';

function saveButtonSx(saveActive) {
  return {
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
  };
}

export default function HabitsManagerActionFooter({
  managerMode = 'habits',
  detailMode = 'empty',
  saving = false,
  saveActive = false,
  canDelete = true,
  onSave,
  onDelete,
  saveLabel = 'Guardar cambios',
  deleteAriaLabel = 'Eliminar',
}) {
  if (detailMode === 'empty') {
    return null;
  }

  const showDelete = detailMode === 'edit';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1.5,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
        flexShrink: 0,
        pb: 'max(12px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {showDelete && (
        <IconButton
          color="error"
          size="small"
          onClick={onDelete}
          disabled={!canDelete || saving}
          aria-label={deleteAriaLabel}
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
        onClick={onSave}
        sx={saveButtonSx(saveActive)}
      >
        {managerMode === 'habits' && detailMode === 'create' ? 'Agregar hábito' : saveLabel}
      </Button>
    </Box>
  );
}
