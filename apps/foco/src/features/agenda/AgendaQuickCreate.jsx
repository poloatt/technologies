import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Collapse,
  Popover,
  Stack,
  SwipeableDrawer,
  TextField,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { addMinutes, endOfDay, setHours, setMinutes, startOfDay } from 'date-fns';
import { mergeDateAndTimeFromDay as mergeDateAndTime } from '@shared/utils/tareaFormDateUtils';
import { useTaskSchedule } from '@shared/hooks/useTaskSchedule';
import {
  TareaFormRow,
  TareaFormTipoSelector,
  TAREA_FORM_TIPO_ALL,
  TareaFormHeader,
  TareaFormFooter,
  TareaFormPillSelect,
  tareaFormGooglePaperSx,
  tareaFormTitleFieldSx,
  tareaFormPillTextSx,
  TareaFormHeaderTitleRow,
  HabitFormTitleField,
  tareaFormObjetivoSubtareasContentSx,
  TAREA_FORM_HEADER_ACTION_GUTTER,
  TASK_FORM_HORIZONTAL_PX,
  TareaFormAttachmentsSection,
  useTareaFormAttachments,
} from '@shared/components/forms/tareaFormUi';
import { TareaFormIcons } from '@shared/components/forms/tareaFormIcons';
import TareaFormDescriptionField from '@shared/components/forms/TareaFormDescriptionField';
import TareaFormScheduleSummary from '../tasks/form/fields/TareaFormScheduleSummary';
import TareaFormAdvancedFields from '../tasks/form/TareaFormAdvancedFields';
import TareaActions from '../tasks/components/TareaActions';
import HabitFormFields from '@shared/components/habits/HabitFormFields.jsx';
import HabitGroupFormDialog from '@shared/components/habits/HabitGroupFormDialog';
import { useHabitSectionCreateOption } from '@shared/hooks';
import { useHabitFormState } from '../habits/templates/useHabitFormState';
import { useQuickCreateAdvancedAdapter } from './useQuickCreateFormState';

const INITIAL_ADVANCED = {
  descripcion: '',
  estado: 'PENDIENTE',
  prioridad: 'BAJA',
  fechaVencimiento: null,
  rrule: null,
  objetivo: '',
  subtareas: [],
  archivos: [],
};

function defaultStartAt(selectedDate) {
  const now = new Date();
  const day = startOfDay(selectedDate || now);
  return setMinutes(setHours(day, now.getHours()), 0);
}

function QuickCreateShell({
  isMobile,
  open,
  anchorEl,
  onClose,
  expanded,
  children,
}) {
  if (isMobile) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        onOpen={() => {}}
        disableSwipeToOpen
        PaperProps={{
          sx: {
            ...tareaFormGooglePaperSx(true),
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            maxHeight: expanded ? '90vh' : '55vh',
            height: expanded ? '90vh' : 'auto',
            transition: 'max-height 0.25s ease',
          },
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 4,
            borderRadius: 2,
            bgcolor: 'divider',
            mx: 'auto',
            mt: 1,
            mb: 0.5,
            flexShrink: 0,
          }}
        />
        <Box
          sx={{
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {children}
        </Box>
      </SwipeableDrawer>
    );
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      PaperProps={{
        sx: {
          ...tareaFormGooglePaperSx(false),
          mt: 1,
          width: { xs: 'calc(100vw - 24px)', sm: 400 },
          maxWidth: '100vw',
          maxHeight: expanded ? 'calc(100vh - 24px)' : undefined,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box
        sx={{
          overflowY: expanded ? 'auto' : 'visible',
          maxHeight: expanded ? 'calc(100vh - 48px)' : undefined,
        }}
      >
        {children}
      </Box>
    </Popover>
  );
}

export default function AgendaQuickCreate({
  open,
  anchorEl,
  onClose,
  isMobile = false,
  selectedDate,
  initialStart,
  objetivos: objetivosProp,
  Objetivos: ObjetivosProp,
  onSave,
  defaultTipo = 'EVENTO',
}) {
  const objetivos = objetivosProp ?? ObjetivosProp ?? [];
  const titleRef = useRef(null);
  const [titulo, setTitulo] = useState('');
  const [day, setDay] = useState(() => startOfDay(selectedDate || new Date()));
  const [time, setTime] = useState(() => new Date());
  const [allDay, setAllDay] = useState(true);
  const [durationMin, setDurationMin] = useState(60);
  const [objetivo, setObjetivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [advanced, setAdvanced] = useState(INITIAL_ADVANCED);
  const { handleFileChange, removeFile } = useTareaFormAttachments(setAdvanced);
  const [errors, setErrors] = useState({});
  const [tipo, setTipo] = useState(() => {
    if (defaultTipo === 'TAREA') return 'TAREA';
    if (defaultTipo === 'HABITO') return 'HABITO';
    return 'EVENTO';
  });
  const {
    habitSection,
    setHabitSection,
    habitIcon,
    setHabitIcon,
    habitConfig,
    setHabitConfig,
    handleConfigChange: handleHabitConfigChange,
    handleIconChange: handleHabitIconChange,
    resetHabitForm,
  } = useHabitFormState();
  const { sectionOptions, sectionSelectProps, groupDialogProps } = useHabitSectionCreateOption({
    onSectionCreated: setHabitSection,
  });

  const resetForm = useCallback(() => {
    const start = initialStart ? new Date(initialStart) : defaultStartAt(selectedDate);
    const hasExplicitTime = Boolean(initialStart);
    setTitulo('');
    setDay(startOfDay(start));
    setTime(start);
    setAllDay(!hasExplicitTime);
    setDurationMin(60);
    setObjetivo('');
    setExpanded(false);
    setScheduleExpanded(false);
    setAdvanced(INITIAL_ADVANCED);
    setErrors({});
    resetHabitForm();
    if (defaultTipo === 'TAREA') setTipo('TAREA');
    else if (defaultTipo === 'HABITO') setTipo('HABITO');
    else setTipo('EVENTO');
  }, [initialStart, selectedDate, defaultTipo, resetHabitForm]);

  useEffect(() => {
    if (!open) return;
    resetForm();
    const t = window.setTimeout(() => titleRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open, resetForm]);

  const fechaInicioSeed = useMemo(() => {
    if (allDay) return startOfDay(day);
    return mergeDateAndTime(day, time);
  }, [day, time, allDay]);

  const fechaFinSeed = useMemo(() => {
    if (allDay) return endOfDay(day);
    return addMinutes(fechaInicioSeed, durationMin);
  }, [fechaInicioSeed, durationMin, allDay, day]);

  const {
    scheduleStart: fechaInicio,
    scheduleEnd: fechaFin,
    scheduleDay,
    scheduleDuration,
    scheduleAllDay,
    applySchedule,
  } = useTaskSchedule({
    fechaInicio: fechaInicioSeed,
    fechaFin: fechaFinSeed,
    allDay,
    onScheduleChange: (update) => {
      setDay(update.day);
      setTime(update.time);
      setAllDay(update.allDay);
      setDurationMin(update.durationMin);
    },
  });

  const fechaVencimiento = advanced.fechaVencimiento ?? null;

  const advancedFormData = useMemo(() => ({
    tipo,
    descripcion: advanced.descripcion,
    estado: advanced.estado,
    prioridad: advanced.prioridad,
    fechaVencimiento,
    rrule: advanced.rrule,
    objetivo: expanded && tipo === 'TAREA' ? advanced.objetivo : objetivo,
    subtareas: advanced.subtareas,
  }), [tipo, advanced, fechaVencimiento, expanded, objetivo]);

  const setAdvancedFormData = useQuickCreateAdvancedAdapter({
    advanced,
    setAdvanced,
    setErrors,
    tipo,
    objetivo,
    fechaFin,
  });

  const validateSave = () => {
    const trimmed = titulo.trim();
    if (!trimmed) {
      titleRef.current?.focus();
      return false;
    }
    if (tipo === 'TAREA' && !expanded && !objetivo) {
      setErrors({ objetivo: 'El objetivo es requerido' });
      return false;
    }
    if (tipo === 'TAREA' && expanded && !advancedFormData.objetivo) {
      setErrors({ objetivo: 'El objetivo es requerido' });
      return false;
    }
    if (tipo === 'HABITO' && expanded && !habitIcon) {
      setErrors({ icon: 'Selecciona un icono' });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSave = async () => {
    if (!validateSave()) return;

    const trimmed = titulo.trim();
    setSaving(true);
    try {
      if (tipo === 'HABITO') {
        await onSave({
          titulo: trimmed,
          tipo: 'HABITO',
          section: habitSection,
          icon: expanded ? habitIcon : 'Add',
          config: expanded ? habitConfig : DEFAULT_HABIT_CONFIG,
        });
      } else {
        await onSave({
          titulo: trimmed,
          tipo,
          fechaInicio: fechaInicio.toISOString(),
          fechaFin: fechaFin.toISOString(),
          fechaVencimiento: (fechaVencimiento instanceof Date
            ? fechaVencimiento.toISOString()
            : fechaVencimiento) || null,
          objetivo: advancedFormData.objetivo || null,
          descripcion: advancedFormData.descripcion,
          estado: advancedFormData.estado,
          prioridad: advancedFormData.prioridad,
          rrule: advancedFormData.rrule || null,
          subtareas: advancedFormData.subtareas,
          archivos: advanced.archivos || [],
          allDay: scheduleAllDay,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleMoreOptions = () => {
    setExpanded((v) => {
      const next = !v;
      if (next) {
        setScheduleExpanded(true);
        setAdvanced((prev) => ({
          ...prev,
          objetivo: tipo === 'TAREA' ? (objetivo || prev.objetivo) : prev.objetivo,
          fechaVencimiento: prev.fechaVencimiento,
        }));
      } else {
        setScheduleExpanded(false);
      }
      return next;
    });
  };

  const scheduleFieldsExpanded = scheduleExpanded || expanded;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !expanded) {
      e.preventDefault();
      handleSave();
    }
  };

  const titlePlaceholder =
    tipo === 'HABITO' ? 'Nombre del hábito' : 'Agregar título';

  const objetivoOptions = useMemo(
    () => objetivos.map((p) => ({
      value: p._id,
      label: p.nombre || p.titulo || 'Objetivo',
    })),
    [objetivos],
  );

  const moreOptionsLabel = expanded ? 'Menos opciones' : 'Más opciones';

  const shellExpanded = expanded;

  const formBody = (
    <Box sx={{ pb: 0.5 }}>
      <TareaFormHeader onClose={onClose}>
        {tipo !== 'HABITO' && (
          <Box sx={{ mb: 0.5 }}>
            <TareaActions
              variant="form"
              hideEdit
              tarea={{
                tipo,
                prioridad: advanced.prioridad,
                completada: false,
              }}
              onTogglePriority={() => {
                setAdvanced((prev) => ({
                  ...prev,
                  prioridad: prev.prioridad === 'ALTA' ? 'BAJA' : 'ALTA',
                }));
              }}
              onAttach={handleFileChange}
            />
          </Box>
        )}
        <Box sx={{ mb: 1.5, pr: TAREA_FORM_HEADER_ACTION_GUTTER }}>
          <TareaFormTipoSelector
            value={tipo}
            options={TAREA_FORM_TIPO_ALL}
            onChange={(v) => {
              setTipo(v);
              if (v !== 'TAREA') setExpanded(false);
            }}
          />
        </Box>

        {tipo === 'HABITO' ? (
          <HabitFormTitleField
            inputRef={titleRef}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={handleKeyDown}
            icon={habitIcon}
            onIconChange={(name) => handleHabitIconChange(name, (field) => {
              if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
            })}
            placeholder={titlePlaceholder}
            iconError={!!errors.icon}
          />
        ) : (
        <TareaFormHeaderTitleRow>
          <TextField
            inputRef={titleRef}
            fullWidth
            variant="standard"
            placeholder={titlePlaceholder}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={handleKeyDown}
            sx={{ flex: 1, minWidth: 0, ...tareaFormTitleFieldSx }}
          />
        </TareaFormHeaderTitleRow>
        )}
      </TareaFormHeader>

      <Box sx={{ px: TASK_FORM_HORIZONTAL_PX }}>
      {expanded && tipo !== 'HABITO' && (
        <TareaFormDescriptionField
          value={advanced.descripcion}
          onChange={(e) => setAdvanced((prev) => ({ ...prev, descripcion: e.target.value }))}
        />
      )}

      {tipo === 'HABITO' ? (
        <>
          {!expanded && (
            <HabitFormFields
              section={habitSection}
              onSectionChange={setHabitSection}
              icon={habitIcon}
              onIconChange={setHabitIcon}
              config={habitConfig}
              onConfigChange={setHabitConfig}
              errors={errors}
              showIconPicker={false}
              showCadence={false}
            />
          )}
          <Collapse in={expanded} timeout={200}>
            <Box sx={{ pt: expanded ? 0.5 : 0 }}>
              <HabitFormFields
                section={habitSection}
                onSectionChange={setHabitSection}
                icon={habitIcon}
                onIconChange={(name) => handleHabitIconChange(name, (field) => {
                  if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
                })}
                config={habitConfig}
                onConfigChange={handleHabitConfigChange}
                errors={errors}
                showSection
                showIconPicker={false}
                showCadence
                sectionOptions={sectionOptions}
                onCreateSection={sectionSelectProps.onCreate}
                createSectionLabel={sectionSelectProps.createLabel}
              />
            </Box>
          </Collapse>
        </>
      ) : (
        <TareaFormScheduleSummary
          day={scheduleDay}
          onDayChange={(v) => applySchedule({ nextDay: startOfDay(v) })}
          time={fechaInicio}
          onTimeChange={(v) => applySchedule({ nextTime: v, nextAllDay: false })}
          allDay={scheduleAllDay}
          onAllDayChange={(checked) => applySchedule({ nextAllDay: checked })}
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          expanded={scheduleFieldsExpanded}
          onExpandedChange={setScheduleExpanded}
          durationMin={scheduleDuration}
          onDurationChange={(mins) => applySchedule({ nextDuration: mins, nextAllDay: false })}
          showDeadline={scheduleFieldsExpanded}
          deadline={fechaVencimiento}
          onDeadlineChange={(v) => setAdvanced((prev) => ({ ...prev, fechaVencimiento: v }))}
          recurrenceRrule={advanced.rrule}
          onRecurrenceChange={(rr) => setAdvanced((prev) => ({ ...prev, rrule: rr }))}
          showRecurrence={scheduleFieldsExpanded}
          errors={errors}
        />
      )}

      {tipo === 'TAREA' && !expanded && (
        <TareaFormRow icon={TareaFormIcons.objetivo} showDivider={false} align="center">
          <Box sx={tareaFormObjetivoSubtareasContentSx}>
            <TareaFormPillSelect
              value={objetivo}
              onChange={(e) => {
                setObjetivo(e.target.value);
                if (errors.objetivo) setErrors({});
              }}
              options={objetivoOptions}
              emptyLabel="Sin objetivo"
              error={errors.objetivo}
              required
              pillWidth="grow"
            />
          </Box>
        </TareaFormRow>
      )}

      {tipo !== 'HABITO' && (
        <TareaFormAttachmentsSection
          archivos={advanced.archivos}
          onRemove={removeFile}
        />
      )}

      {tipo !== 'HABITO' && (
        <Collapse in={expanded} timeout={200}>
          <Box sx={{ pt: 0.5 }}>
            <TareaFormAdvancedFields
              variant="compact"
              formData={advancedFormData}
              setFormData={setAdvancedFormData}
              errors={errors}
              objetivos={objetivos}
              showSettings={tipo === 'TAREA' ? expanded : true}
              showRecurrenceInSettings={false}
              showObjetivo={tipo === 'TAREA'}
              showSubtareas={tipo === 'TAREA'}
            />
          </Box>
        </Collapse>
      )}

      <TareaFormFooter
        onSave={handleSave}
        saving={saving}
        disabled={!titulo.trim()}
        leftAction={(
          <Button
            size="small"
            color="inherit"
            endIcon={(
              <ExpandMoreIcon
                sx={{
                  transform: expanded ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              />
            )}
            onClick={handleMoreOptions}
            sx={{ textTransform: 'none', color: 'text.secondary', px: 0, ...tareaFormPillTextSx }}
          >
            {moreOptionsLabel}
          </Button>
        )}
      />
      </Box>
    </Box>
  );

  return (
    <>
    <QuickCreateShell
      isMobile={isMobile}
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      expanded={shellExpanded}
    >
      {formBody}
    </QuickCreateShell>
    <HabitGroupFormDialog {...groupDialogProps} />
    </>
  );
}
