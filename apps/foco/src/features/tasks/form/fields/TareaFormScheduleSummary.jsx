import React, { useState } from 'react';
import { Box, Collapse, IconButton } from '@mui/material';
import CollapseChevron from '@shared/components/common/CollapseChevron';
import { collapsePanelProps } from '@shared/styles/collapseSectionStyles';
import {
  TareaFormRow,
  TareaFormPrimaryLine,
  TareaFormSecondaryLine,
  tareaFormRowContentGutterSx,
} from '@shared/components/forms/tareaFormUi';
import { taskFormReadOnlyBodyLineSx } from '@shared/components/forms/tareaFormTokens';
import { TareaFormIcons } from '@shared/components/forms/tareaFormIcons';
import {
  formatScheduleSummaryPrimary,
  formatScheduleSummaryMeta,
} from '@shared/utils/scheduleSummaryFormat';
import { useTimezone } from '@shared/hooks/useTimezone';
import TareaFormScheduleFields from './TareaFormScheduleFields';
import { labelForRrule } from '@shared/components/forms/TareaFormRecurrencePicker';

/**
 * Horario colapsable estilo Google Calendar: resumen compacto → campos editables al expandir.
 */
export default function TareaFormScheduleSummary({
  day,
  onDayChange,
  time,
  onTimeChange,
  allDay,
  onAllDayChange,
  fechaInicio: fechaInicioProp,
  fechaFin: fechaFinProp,
  durationMin = 60,
  onDurationChange,
  showDeadline = false,
  deadline = null,
  onDeadlineChange,
  deadlinePlaceholder,
  recurrenceRrule = null,
  onRecurrenceChange,
  showRecurrence = Boolean(onRecurrenceChange),
  errors = {},
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
}) {
  const { timezone } = useTimezone();
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = expandedProp ?? internalExpanded;

  const setExpanded = (next) => {
    onExpandedChange?.(next);
    if (expandedProp === undefined) {
      setInternalExpanded(next);
    }
  };

  const fechaInicio = fechaInicioProp ?? (time instanceof Date && day
    ? (() => {
      const d = new Date(day);
      d.setHours(time.getHours(), time.getMinutes(), 0, 0);
      return d;
    })()
    : day);

  const fechaFin = fechaFinProp ?? (() => {
    if (!fechaInicio) return null;
    const end = new Date(fechaInicio);
    end.setMinutes(end.getMinutes() + (durationMin || 60));
    return end;
  })();

  const primaryLine = formatScheduleSummaryPrimary({
    fechaInicio,
    fechaFin,
    allDay,
  });

  const metaLine = formatScheduleSummaryMeta(
    { rrule: recurrenceRrule, allDay, timezone, deadline },
    { recurrenceLabel: labelForRrule(recurrenceRrule) },
  );

  const handleSummaryClick = () => {
    setExpanded(!isExpanded);
  };

  return (
    <>
      <TareaFormRow icon={TareaFormIcons.schedule} showDivider={false} align="center">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 0.5,
            width: '100%',
            minWidth: 0,
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={handleSummaryClick}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Ocultar horario' : 'Editar horario'}
            sx={{
              ...tareaFormRowContentGutterSx,
              border: 'none',
              background: 'none',
              p: 0,
              m: 0,
              textAlign: 'left',
              cursor: 'pointer',
              color: 'inherit',
              font: 'inherit',
              flex: 1,
              minWidth: 0,
              display: 'block',
              '&:hover': { opacity: 0.88 },
            }}
          >
            <TareaFormPrimaryLine sx={{ ...taskFormReadOnlyBodyLineSx, fontWeight: 500 }}>
              {primaryLine}
            </TareaFormPrimaryLine>
            <TareaFormSecondaryLine>{metaLine}</TareaFormSecondaryLine>
          </Box>
          <CollapseChevron
            expanded={isExpanded}
            asButton
            onClick={handleSummaryClick}
            aria-label={isExpanded ? 'Ocultar horario' : 'Editar horario'}
            iconButtonSx={{ flexShrink: 0, mt: 0.25 }}
          />
        </Box>
      </TareaFormRow>

      <Collapse in={isExpanded} {...collapsePanelProps}>
        <TareaFormScheduleFields
          embeddedInSummary
          day={day}
          onDayChange={onDayChange}
          time={time}
          onTimeChange={onTimeChange}
          allDay={allDay}
          onAllDayChange={onAllDayChange}
          expanded
          showTimeControls={!allDay}
          durationMin={durationMin}
          onDurationChange={onDurationChange}
          showDuration
          showDeadline={showDeadline}
          deadline={deadline}
          onDeadlineChange={onDeadlineChange}
          deadlinePlaceholder={deadlinePlaceholder}
          showRecurrence={showRecurrence}
          recurrenceRrule={recurrenceRrule}
          onRecurrenceChange={onRecurrenceChange}
          errors={errors}
        />
      </Collapse>
    </>
  );
}
