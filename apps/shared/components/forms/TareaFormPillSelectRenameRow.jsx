import React, { useCallback, useEffect, useState } from 'react';
import { Box, IconButton, TextField } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { TareaFormPillSelect } from './tareaFormControls';
import {
  TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
  TASK_FORM_HEADER_ACTION_GAP,
  taskFormFieldInputSx,
} from './tareaFormTokens';

const pillRenameActionSx = (saving = false) => ({
  width: TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
  height: TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
  minWidth: TASK_FORM_HEADER_ACTION_COLUMN_WIDTH,
  flexShrink: 0,
  p: 0,
  borderRadius: '50%',
  border: '1px solid',
  borderColor: 'divider',
  color: 'text.secondary',
  bgcolor: 'transparent',
  transition: 'color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease',
  opacity: saving ? 0.6 : 1,
  '&:hover:not(:disabled)': {
    bgcolor: 'action.hover',
    borderColor: 'text.secondary',
    color: 'text.primary',
  },
});

/**
 * Pill select con edición inline del nombre: icono edit → campo texto → tick guardar.
 */
export default function TareaFormPillSelectRenameRow({
  renameValue = '',
  canRename = false,
  onRenameSave,
  renamePlaceholder = 'Nombre',
  renameDisabled = false,
  pillSelectProps = {},
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(renameValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(renameValue);
    }
  }, [renameValue, editing]);

  const handleStartEdit = useCallback(() => {
    setDraft(renameValue);
    setEditing(true);
  }, [renameValue]);

  const handleCancelEdit = useCallback(() => {
    setDraft(renameValue);
    setEditing(false);
  }, [renameValue]);

  const handleSave = useCallback(async () => {
    const trimmed = (draft || '').trim();
    if (!trimmed || trimmed === (renameValue || '').trim()) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onRenameSave?.(trimmed);
      setEditing(false);
    } catch {
      // mantener modo edición si falla
    } finally {
      setSaving(false);
    }
  }, [draft, onRenameSave, renameValue]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelEdit();
    }
  }, [handleCancelEdit, handleSave]);

  const showAction = canRename && !renameDisabled && !pillSelectProps.disabled;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: TASK_FORM_HEADER_ACTION_GAP,
        width: '100%',
        minWidth: 0,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <TextField
            variant="standard"
            fullWidth
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={renamePlaceholder}
            autoFocus
            disabled={saving}
            sx={{
              '& .MuiInput-input': taskFormFieldInputSx,
            }}
          />
        ) : (
          <TareaFormPillSelect {...pillSelectProps} />
        )}
      </Box>

      {showAction && (
        <IconButton
          size="small"
          onClick={editing ? handleSave : handleStartEdit}
          disabled={saving || (editing && !(draft || '').trim())}
          aria-label={editing ? 'Guardar nombre' : 'Editar nombre'}
          sx={pillRenameActionSx(saving)}
        >
          {editing ? (
            <CheckIcon sx={{ fontSize: 18 }} />
          ) : (
            <EditOutlinedIcon sx={{ fontSize: 18 }} />
          )}
        </IconButton>
      )}
    </Box>
  );
}
