import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Stack,
  TextField,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material';
import { startOfDay } from 'date-fns';
import { useTaskSchedule } from '@shared/hooks/useTaskSchedule';
import {
  TareaFormRow,
  TareaFormHeaderContentRow,
  TareaFormObjetivoSummary,
  TareaFormOwnersRow,
  tareaFormStandardFieldSx,
  tareaFormFieldInputSx,
  tareaFormActionIconSx,
  tareaFormObjetivoSubtareasSectionSx,
  tareaFormObjetivoSubtareasContentSx,
  tareaFormSubtaskRowSx,
  tareaFormSubtaskListSx,
  taskFormSubtaskCheckIconSx,
} from '@shared/components/forms/tareaFormUi';
import { TareaFormIcons } from '@shared/components/forms/tareaFormIcons';
import TareaFormDescriptionField from '@shared/components/forms/TareaFormDescriptionField';
import TareaFormScheduleSummary from './fields/TareaFormScheduleSummary';
import { findObjetivoById } from './buildTareaPayload';

function mapObjetivoOptions(objetivos) {
  return (objetivos || []).map((obj) => ({
    value: obj._id || obj.id,
    label: obj.nombre || obj.titulo,
  }));
}

/**
 * Campos avanzados compartidos entre TareaForm y AgendaQuickCreate (expandido).
 * @param {'full'|'compact'} variant - full: formulario diálogo; compact: solo metadatos (quick expand)
 */
export default function TareaFormAdvancedFields({
  formData,
  setFormData,
  errors = {},
  objetivos: objetivosProp,
  Objetivos: ObjetivosProp,
  objetivoId = null,
  variant = 'full',
  showDescription = variant === 'full',
  showSchedule = variant === 'full',
  showSettings = true,
  showObjetivo = true,
  showSubtareas = true,
  showVencimiento = true,
  showRecurrenceInSettings = true,
  onCreateObjetivo,
  onToggleSubtarea,
  onDelegateRequest,
  currentUserId = null,
  showOwners = true,
  showGoogleSyncToggle = false,
  onToggleGoogleSync,
}) {
  const objetivos = objetivosProp ?? ObjetivosProp ?? [];
  const [newSubtarea, setNewSubtarea] = useState('');
  const tipo = formData.tipo === 'EVENTO' ? 'EVENTO' : 'TAREA';

  const handleChange = (field) => (event) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleObjetivoChange = (event) => {
    const nextObjetivoId = event.target.value;
    const objetivo = findObjetivoById(objetivos, nextObjetivoId);
    const listId = objetivo?.googleTasksSync?.googleTaskListId || null;

    setFormData((prev) => {
      const syncEnabled = prev.googleTasksSync?.enabled;
      return {
        ...prev,
        objetivo: nextObjetivoId || null,
        googleTasksSync: {
          ...(prev.googleTasksSync || {}),
          ...(listId ? { googleTaskListId: listId } : {}),
          ...(syncEnabled
            ? { needsSync: true, syncStatus: 'pending' }
            : {}),
        },
      };
    });
  };

  const handleAddSubtarea = () => {
    if (!newSubtarea.trim()) return;
    setFormData((prev) => ({
      ...prev,
      subtareas: [
        ...(prev.subtareas || []),
        {
          titulo: newSubtarea.trim(),
          completada: false,
          orden: (prev.subtareas?.length || 0) + 1,
        },
      ],
    }));
    setNewSubtarea('');
  };

  const handleDeleteSubtarea = (index) => {
    setFormData((prev) => ({
      ...prev,
      subtareas: prev.subtareas.filter((_, i) => i !== index),
    }));
  };

  const handleLocalToggleSubtarea = (index) => {
    setFormData((prev) => ({
      ...prev,
      subtareas: prev.subtareas.map((st, i) =>
        (i === index ? { ...st, completada: !st.completada } : st),
      ),
    }));
  };

  const handleToggleSubtareaClick = (index) => {
    if (onToggleSubtarea) {
      onToggleSubtarea(index);
    } else {
      handleLocalToggleSubtarea(index);
    }
  };

  const lockedObjetivoId = objetivoId || null;
  const canEditObjetivo = showObjetivo && !lockedObjetivoId && tipo !== 'EVENTO';
  const objetivoValue = (() => {
    const currentValue = lockedObjetivoId || formData.objetivo || '';
    const exists = (objetivos || []).some((p) => (p._id || p.id) === currentValue);
    return exists ? currentValue : (lockedObjetivoId || '');
  })();

  const lockedObjetivo = lockedObjetivoId
    ? findObjetivoById(objetivos, lockedObjetivoId)
    : null;
  const lockedObjetivoLabel = lockedObjetivo?.nombre || lockedObjetivo?.titulo || null;

  const subtareas = formData.subtareas || [];
  const objetivoOptions = mapObjetivoOptions(objetivos);

  const {
    scheduleStart,
    scheduleEnd,
    scheduleDay,
    scheduleDuration,
    scheduleAllDay,
    applySchedule,
  } = useTaskSchedule({
    fechaInicio: formData.fechaInicio,
    fechaFin: formData.fechaFin,
    allDay: formData.allDay,
    onScheduleChange: (update) => {
      setFormData((prev) => ({
        ...prev,
        allDay: update.allDay,
        fechaInicio: update.fechaInicio,
        fechaFin: update.fechaFin,
      }));
    },
  });

  const scheduleBlock = (
    <TareaFormScheduleSummary
      day={scheduleDay}
      onDayChange={(v) => applySchedule({ nextDay: startOfDay(v) })}
      time={scheduleStart}
      onTimeChange={(v) => applySchedule({ nextTime: v, nextAllDay: false })}
      allDay={scheduleAllDay}
      onAllDayChange={(checked) => applySchedule({ nextAllDay: checked })}
      fechaInicio={scheduleStart}
      fechaFin={scheduleEnd}
      durationMin={scheduleDuration}
      onDurationChange={(mins) => applySchedule({ nextDuration: mins, nextAllDay: false })}
      showDeadline={showVencimiento}
      deadline={formData.fechaVencimiento}
      onDeadlineChange={(v) => setFormData((prev) => ({ ...prev, fechaVencimiento: v }))}
      recurrenceRrule={formData.rrule}
      onRecurrenceChange={(rr) => setFormData((prev) => ({ ...prev, rrule: rr }))}
      showRecurrence={showRecurrenceInSettings}
      errors={errors}
    />
  );

  const showSubtareasUi = showSubtareas && tipo !== 'EVENTO';
  const hasSubtareas = subtareas.length > 0;

  const subtareaInput = (
    <TextField
      variant="standard"
      fullWidth
      placeholder="Agregar subtarea..."
      value={newSubtarea}
      onChange={(e) => setNewSubtarea(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAddSubtarea();
        }
      }}
      sx={{
        flex: 1,
        minWidth: 0,
        width: '100%',
        ...tareaFormStandardFieldSx,
        '& .MuiInputBase-input': {
          ...tareaFormFieldInputSx,
          color: newSubtarea ? 'text.primary' : 'text.secondary',
        },
      }}
    />
  );

  const subtareaComposerRow = (
    <TareaFormRow icon={TareaFormIcons.subtarea} showDivider={false} align="center">
      <Box sx={tareaFormObjetivoSubtareasContentSx}>
        <TareaFormHeaderContentRow>
          {subtareaInput}
        </TareaFormHeaderContentRow>
      </Box>
    </TareaFormRow>
  );

  const showObjetivoSummary = canEditObjetivo || Boolean(lockedObjetivoLabel) || tipo === 'EVENTO' || showSubtareasUi;
  const objetivoMetaBlock = (showSettings || showObjetivoSummary) && (
    <TareaFormObjetivoSummary
      estado={formData.estado}
      onEstadoChange={handleChange('estado')}
      showEstado={showSettings}
      showObjetivo={canEditObjetivo || Boolean(lockedObjetivoLabel)}
      objetivoValue={objetivoValue}
      onObjetivoChange={canEditObjetivo ? handleObjetivoChange : undefined}
      objetivoOptions={objetivoOptions}
      objetivoLabel={lockedObjetivoLabel || undefined}
      emptyObjetivoLabel="Sin objetivo"
      onCreateObjetivo={canEditObjetivo ? onCreateObjetivo : undefined}
      createObjetivoLabel="Nuevo objetivo"
      showSubtareas={showSubtareasUi}
      subtareasCount={subtareas.length}
      emptySubtareasLabel="Sin subtareas"
      subtareaComposer={!hasSubtareas ? subtareaInput : null}
      errors={errors}
      defaultExpanded={Boolean(errors.objetivo)}
    />
  );

  const subtareasListBlock = showSubtareasUi && hasSubtareas && (
    <>
      <Stack spacing={0.5} sx={tareaFormSubtaskListSx}>
        {subtareas.map((subtarea, index) => (
          <Box
            key={subtarea._id || `sub-${index}`}
            sx={tareaFormSubtaskRowSx}
          >
            <IconButton
              size="small"
              onClick={() => handleToggleSubtareaClick(index)}
              sx={{
                p: 0.5,
                color: subtarea.completada ? 'success.main' : 'text.secondary',
                '& .MuiSvgIcon-root': taskFormSubtaskCheckIconSx,
              }}
            >
              <TareaFormIcons.completed />
            </IconButton>
            <TextField
              value={subtarea.titulo}
              variant="standard"
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  subtareas: prev.subtareas.map((st, i) =>
                    (i === index ? { ...st, titulo: e.target.value } : st),
                  ),
                }));
              }}
              sx={{
                flex: 1,
                minWidth: 0,
                ...tareaFormStandardFieldSx,
                '& .MuiInputBase-input': {
                  ...tareaFormFieldInputSx,
                  textDecoration: subtarea.completada ? 'line-through' : 'none',
                  color: subtarea.completada ? 'text.secondary' : 'text.primary',
                },
              }}
            />
            <IconButton
              size="small"
              onClick={() => handleDeleteSubtarea(index)}
              sx={{
                p: 0.5,
                color: 'error.main',
                '& .MuiSvgIcon-root': tareaFormActionIconSx,
              }}
            >
              <TareaFormIcons.close />
            </IconButton>
          </Box>
        ))}
      </Stack>
      {subtareaComposerRow}
    </>
  );

  const ownersBlock = showOwners ? (
    <TareaFormOwnersRow
      owners={formData.owners}
      creatorId={formData.usuario?._id || formData.usuario}
      currentUserId={currentUserId}
      onAddOwner={typeof onDelegateRequest === 'function' ? onDelegateRequest : undefined}
      readOnly={typeof onDelegateRequest !== 'function'}
    />
  ) : null;

  const googleSyncToggle = showGoogleSyncToggle
    && tipo !== 'EVENTO'
    && String(formData.tipo || '').toUpperCase() !== 'HABITO' ? (
    <FormControlLabel
      sx={{ mx: 0, mt: 0.5, alignItems: 'center' }}
      control={(
        <Switch
          size="small"
          checked={Boolean(formData.googleTasksSync?.enabled)}
          onChange={() => {
            if (typeof onToggleGoogleSync === 'function') {
              onToggleGoogleSync();
              return;
            }
            setFormData((prev) => {
              const nextEnabled = !prev.googleTasksSync?.enabled;
              return {
                ...prev,
                googleTasksSync: {
                  ...(prev.googleTasksSync || {}),
                  enabled: nextEnabled,
                  needsSync: nextEnabled ? true : Boolean(prev.googleTasksSync?.needsSync),
                  syncStatus: nextEnabled ? 'pending' : (prev.googleTasksSync?.syncStatus || 'synced'),
                },
              };
            });
          }}
        />
      )}
      label={(
        <Typography variant="body2" color="text.secondary">
          Sincronizar con Google Tasks
        </Typography>
      )}
    />
  ) : null;

  const metaSubtareasSection = (objetivoMetaBlock || subtareasListBlock || ownersBlock || googleSyncToggle) && (
    <Box sx={tareaFormObjetivoSubtareasSectionSx}>
      {ownersBlock}
      {objetivoMetaBlock}
      {subtareasListBlock}
      {googleSyncToggle}
    </Box>
  );

  if (variant === 'compact') {
    return (
      <>
        {ownersBlock}
        {objetivoMetaBlock}
        {subtareasListBlock}
      </>
    );
  }

  return (
    <>
      {showDescription && (
        <TareaFormDescriptionField
          value={formData.descripcion}
          onChange={handleChange('descripcion')}
        />
      )}

      {showSchedule && scheduleBlock}
      {metaSubtareasSection}
    </>
  );
}
