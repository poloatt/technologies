import React, { useMemo, useRef, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
} from '@mui/material';
import { addMinutes, differenceInMinutes, isSameDay, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { isSameDayAsToday } from '@shared/utils/agendaRules';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { mergeDateAndTime, formatDatePill, formatTimePill } from '@shared/utils/tareaFormDateUtils';
import {
  TareaFormRow,
  TareaFormAllDaySwitch,
  TareaFormPillButton,
  tareaFormPillRowSx,
  tareaFormScheduleStackSx,
  tareaFormScheduleExpandedContentSx,
  tareaFormScheduleDatePillResponsiveSx,
  tareaFormScheduleControlsRowSx,
  tareaFormScheduleRecurrenceWrapSx,
  tareaFormTimeSeparatorSx,
  TAREA_FORM_PILL_GAP,
} from '@shared/components/forms/tareaFormUi';
import { TareaFormIcons } from '@shared/components/forms/tareaFormIcons';
import { TareaFormDeadlineClearButton, TareaFormDeadlineRow } from '@shared/components/forms/TareaFormDeadlineField';
import TareaFormRecurrencePicker from '@shared/components/forms/TareaFormRecurrencePicker';
import { PickerPopover, PopoverInlineDatePicker, PopoverInlineTimePicker } from '@shared/components/forms/tareaFormPickers';

/**
 * Fecha, hora inicio–fin y todo el día (pills estilo Google Calendar).
 */
export default function TareaFormScheduleFields({
  day,
  onDayChange,
  time,
  onTimeChange,
  allDay,
  onAllDayChange,
  expanded = false,
  showTimeControls = false,
  durationMin = 60,
  onDurationChange,
  showDuration = false,
  showDeadline = false,
  deadline = null,
  onDeadlineChange,
  deadlinePlaceholder = 'Agregar fecha límite',
  showRecurrence = false,
  recurrenceRrule = null,
  onRecurrenceChange,
  errors = {},
  embeddedInSummary = false,
}) {
  const datePillRef = useRef(null);
  const startPillRef = useRef(null);
  const endPillRef = useRef(null);

  const [dateOpen, setDateOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const scheduleToday = isSameDayAsToday(day) || (deadline && isSameDayAsToday(deadline));
  const showTimePills = !allDay && (expanded || showTimeControls || showDuration || scheduleToday);

  const startAt = useMemo(() => mergeDateAndTime(day, time), [day, time]);
  const endAt = useMemo(
    () => addMinutes(startAt, durationMin || 60),
    [startAt, durationMin],
  );

  const showDeadlineRow = showDeadline;
  const endTimeBesideDeadline = showDeadlineRow && Boolean(deadline);
  const showEndTimeOnRow1 = showTimePills && !endTimeBesideDeadline;
  const showRecurrencePicker = showRecurrence && Boolean(onRecurrenceChange);

  const endTimeAt = useMemo(() => {
    if (!deadline) return endAt;
    const hasExplicitTime = deadline.getHours() !== 0 || deadline.getMinutes() !== 0;
    if (hasExplicitTime) return deadline;
    return mergeDateAndTime(startOfDay(deadline), endAt);
  }, [deadline, endAt]);

  const handleEndTimeChange = (newEnd) => {
    if (!newEnd) return;

    if (deadline && onDeadlineChange) {
      onDeadlineChange(mergeDateAndTime(startOfDay(deadline), newEnd));
      if (onDurationChange && isSameDay(startOfDay(deadline), startOfDay(day))) {
        const start = mergeDateAndTime(day, time);
        let mins = differenceInMinutes(newEnd, start);
        if (mins < 5) mins = 5;
        onDurationChange(mins);
      }
      return;
    }

    if (!onDurationChange) return;
    const start = mergeDateAndTime(day, time);
    let mins = differenceInMinutes(newEnd, start);
    if (mins < 5) mins = 5;
    onDurationChange(mins);
  };

  const handleAllDayChange = (checked) => {
    onAllDayChange?.(checked);
    if (checked) {
      setStartOpen(false);
      setEndOpen(false);
    }
  };

  const handleDayChange = (v) => {
    if (!v) return;
    const nextDay = startOfDay(v);
    onDayChange(nextDay);
    setDateOpen(false);
  };

  const handleDeadlineChange = (v) => {
    if (!v) {
      onDeadlineChange?.(null);
      return;
    }
    const preservedTime = deadline || endAt;
    onDeadlineChange?.(mergeDateAndTime(startOfDay(v), preservedTime));
  };

  const scheduleContent = (
    <Stack
      spacing={TAREA_FORM_PILL_GAP}
      sx={{
        ...tareaFormScheduleStackSx,
        ...(embeddedInSummary ? taskFormScheduleExpandedContentSx : { width: '100%', minWidth: 0 }),
      }}
    >
      <Stack
        direction="row"
        flexWrap="wrap"
        alignItems="center"
        gap={TAREA_FORM_PILL_GAP}
        useFlexGap
        sx={tareaFormPillRowSx}
      >
        <TareaFormPillButton
          ref={datePillRef}
          variant="schedule"
          onClick={() => setDateOpen(true)}
          aria-label="Cambiar fecha"
          sx={taskFormScheduleDatePillResponsiveSx}
        >
          {formatDatePill(day)}
        </TareaFormPillButton>
      </Stack>

      {showTimePills && (
        <Stack
          direction="row"
          flexWrap="wrap"
          alignItems="center"
          gap={TAREA_FORM_PILL_GAP}
          useFlexGap
          sx={tareaFormPillRowSx}
        >
          <TareaFormPillButton
            ref={startPillRef}
            variant="schedule"
            onClick={() => setStartOpen(true)}
            aria-label="Hora de inicio"
          >
            {formatTimePill(time)}
          </TareaFormPillButton>

          {showEndTimeOnRow1 && (
            <>
              <Typography
                component="span"
                variant="body2"
                sx={tareaFormTimeSeparatorSx}
              >
                –
              </Typography>
              <TareaFormPillButton
                ref={endPillRef}
                variant="schedule"
                onClick={() => setEndOpen(true)}
                aria-label="Hora de fin"
              >
                {formatTimePill(endAt)}
              </TareaFormPillButton>
            </>
          )}
        </Stack>
      )}

      {onAllDayChange && (
        <Box sx={taskFormScheduleControlsRowSx}>
          <TareaFormAllDaySwitch
            checked={allDay}
            onChange={handleAllDayChange}
            sx={{
              width: '100%',
              m: 0,
              justifyContent: 'space-between',
            }}
          />
        </Box>
      )}

      {showRecurrencePicker && (
        <Box sx={taskFormScheduleRecurrenceWrapSx}>
          <TareaFormRecurrencePicker
            variant="schedule"
            value={recurrenceRrule}
            onChange={onRecurrenceChange}
          />
        </Box>
      )}
    </Stack>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      {embeddedInSummary ? (
        scheduleContent
      ) : (
        <TareaFormRow icon={TareaFormIcons.schedule} showDivider={false} align="flex-start">
          {scheduleContent}
        </TareaFormRow>
      )}

      {showDeadlineRow && (
        <TareaFormDeadlineRow
          embeddedInSummary={embeddedInSummary}
          value={deadline}
          onChange={handleDeadlineChange}
          placeholder={deadlinePlaceholder ? `${deadlinePlaceholder}...` : 'Agregar fecha límite...'}
          showClear={!endTimeBesideDeadline}
          endTimeSlot={endTimeBesideDeadline ? (
            <>
              <TareaFormPillButton
                ref={endPillRef}
                variant="schedule"
                onClick={() => setEndOpen(true)}
                aria-label="Hora de fin"
              >
                {formatTimePill(endTimeAt)}
              </TareaFormPillButton>
              <TareaFormDeadlineClearButton onClear={() => handleDeadlineChange(null)} />
            </>
          ) : null}
        />
      )}

      <PickerPopover
        open={dateOpen}
        anchorEl={datePillRef.current}
        onClose={() => setDateOpen(false)}
      >
        <PopoverInlineDatePicker
          value={day}
          onChange={handleDayChange}
        />
      </PickerPopover>

      {showTimePills && (
        <PickerPopover
          open={startOpen}
          anchorEl={startPillRef.current}
          onClose={() => setStartOpen(false)}
        >
          <PopoverInlineTimePicker
            value={time}
            onChange={(v) => {
              if (v) onTimeChange(v);
            }}
          />
        </PickerPopover>
      )}

      {(showEndTimeOnRow1 || endTimeBesideDeadline) && (
        <PickerPopover
          open={endOpen}
          anchorEl={endPillRef.current}
          onClose={() => setEndOpen(false)}
        >
          <PopoverInlineTimePicker
            value={endTimeAt}
            onChange={(v) => {
              if (v) handleEndTimeChange(v);
            }}
          />
        </PickerPopover>
      )}
    </LocalizationProvider>
  );
}
