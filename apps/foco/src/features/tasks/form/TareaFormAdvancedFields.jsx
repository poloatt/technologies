import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Stack,
  TextField,
} from '@mui/material';
import { startOfDay } from 'date-fns';
import { useTaskSchedule } from '@shared/hooks/useTaskSchedule';
import {
  TareaFormRow,
  TareaFormPillSelect,
  TareaFormHeaderContentRow,
  tareaFormStandardFieldSx,
  tareaFormFieldInputSx,
  tareaFormActionIconSx,
  tareaFormObjetivoSubtareasSectionSx,
  tareaFormObjetivoSubtareasContentSx,
  tareaFormObjetivoSubtareasPillSelectSx,
  tareaFormSubtaskRowSx,
  tareaFormSubtaskListSx,
  taskFormSubtaskCheckIconSx,
} from '@shared/components/forms/tareaFormUi';
import { TareaFormIcons } from '@shared/components/forms/tareaFormIcons';
import TareaFormDescriptionField from '@shared/components/forms/TareaFormDescriptionField';
import TareaFormScheduleSummary from './fields/TareaFormScheduleSummary';
import { TareaFormSettingsRow } from '@shared/components/forms/tareaFormUi';
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
    const objetivoId = event.target.value;
    const objetivo = findObjetivoById(objetivos, objetivoId);
    const listId = objetivo?.googleTasksSync?.googleTaskListId || null;

    setFormData((prev) => {
      const syncEnabled = prev.googleTasksSync?.enabled;
      return {
        ...prev,
        objetivo: objetivoId || null,
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

  const objetivoValue = (() => {
    const currentValue = formData.objetivo || '';
    const exists = (objetivos || []).some((p) => (p._id || p.id) === currentValue);
    return exists ? currentValue : '';
  })();

  const subtareas = formData.subtareas || [];
  const objetivoOptions = mapObjetivoOptions(objetivos);

  // --- Horario (fecha + hora inicio/fin + todo el día) ---
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
      errors={errors}
    />
  );

  const settingsBlock = (
    <TareaFormSettingsRow
      estado={formData.estado}
      onEstadoChange={handleChange('estado')}
      showPrioridad={false}
      showRecurrence={false}
      tipo={tipo}
      errors={errors}
    />
  );

  const objetivoBlock = showObjetivo && !objetivoId && tipo !== 'EVENTO' && (
    <TareaFormRow icon={TareaFormIcons.objetivo} showDivider={false} align="center">
      <Box sx={[tareaFormObjetivoSubtareasContentSx, tareaFormObjetivoSubtareasPillSelectSx]}>
        <TareaFormPillSelect
          value={objetivoValue}
          onChange={handleObjetivoChange}
          options={objetivoOptions}
          emptyLabel="Sin objetivo"
          error={errors.objetivo}
          required
          pillWidth="grow"
          onCreate={onCreateObjetivo}
          createLabel="Nuevo objetivo"
        />
      </Box>
    </TareaFormRow>
  );

  const subtareasBlock = showSubtareas && tipo !== 'EVENTO' && (
    <>
      <TareaFormRow icon={TareaFormIcons.subtarea} showDivider={false} align="center">
        <Box sx={tareaFormObjetivoSubtareasContentSx}>
          <TareaFormHeaderContentRow>
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
                ...tareaFormStandardFieldSx,
                '& .MuiInputBase-input': {
                  ...tareaFormFieldInputSx,
                  color: newSubtarea ? 'text.primary' : 'text.secondary',
                },
              }}
            />
          </TareaFormHeaderContentRow>
        </Box>
      </TareaFormRow>
      {subtareas.length > 0 && (
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
      )}
    </>
  );

  const objetivoSubtareasSection = (objetivoBlock || subtareasBlock) && (
    <Box sx={tareaFormObjetivoSubtareasSectionSx}>
      {objetivoBlock}
      {subtareasBlock}
    </Box>
  );

  if (variant === 'compact') {
    return (
      <>
        {showSettings && (
          <TareaFormSettingsRow
            estado={formData.estado}
            onEstadoChange={handleChange('estado')}
            showPrioridad={false}
            showRecurrence={showRecurrenceInSettings}
            recurrenceRrule={formData.rrule}
            onRecurrenceChange={(rr) => setFormData((prev) => ({ ...prev, rrule: rr }))}
            tipo={tipo}
            errors={errors}
          />
        )}
        {objetivoSubtareasSection}
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
      {showSettings && settingsBlock}
      {objetivoSubtareasSection}
    </>
  );
}
