import React, { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import TaskEventBlock from '@shared/components/tasks/TaskEventBlock';
import {
  computeDragPreview,
  relativeYFromDragEvent,
} from '@shared/utils/calendar/calendarDragUtils';
import { CalendarDragPreviewProvider } from './CalendarDragPreviewContext';
import { useCalendarDragEnd } from './useCalendarDragEnd';

/**
 * @param {'vertical'|'none'} [axisLock='vertical']
 */
export default function CalendarDndContext({
  children,
  onEventMove,
  enabled = true,
  axisLock = 'vertical',
}) {
  const theme = useTheme();
  const handleDragEndMove = useCalendarDragEnd(onEventMove);
  const [activeEvent, setActiveEvent] = useState(null);
  const [preview, setPreview] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );

  const clearDrag = useCallback(() => {
    setActiveEvent(null);
    setPreview(null);
  }, []);

  const updatePreview = useCallback((dragEvent) => {
    const event = dragEvent.active?.data?.current?.event;
    if (!event || !dragEvent.over) {
      setPreview(null);
      return;
    }
    const next = computeDragPreview(
      event,
      dragEvent.over.id,
      dragEvent.delta?.y ?? 0,
      relativeYFromDragEvent(dragEvent),
    );
    setPreview(next);
  }, []);

  const previewValue = useMemo(() => preview, [preview]);

  if (!enabled || !onEventMove) {
    return children;
  }

  const modifiers = axisLock === 'vertical' ? [restrictToVerticalAxis] : undefined;
  const overlayLabel = preview?.allDay
    ? 'Todo el día'
    : (preview?.startLabel || null);

  return (
    <CalendarDragPreviewProvider value={previewValue}>
      <DndContext
        sensors={sensors}
        modifiers={modifiers}
        onDragStart={(event) => {
          setActiveEvent(event.active?.data?.current?.event || null);
          updatePreview(event);
        }}
        onDragMove={(event) => {
          updatePreview(event);
        }}
        onDragCancel={clearDrag}
        onDragEnd={(event) => {
          clearDrag();
          handleDragEndMove(event);
        }}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeEvent ? (
            <Box
              sx={{
                width: activeEvent.allDay ? 168 : 152,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
              }}
            >
              {overlayLabel ? (
                <Typography
                  component="div"
                  sx={{
                    alignSelf: 'flex-start',
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.92),
                    color: theme.palette.primary.contrastText,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: 0.2,
                    boxShadow: 2,
                    lineHeight: 1.2,
                  }}
                >
                  {overlayLabel}
                  {!preview?.allDay && preview?.endLabel && preview.endLabel !== preview.startLabel
                    ? ` – ${preview.endLabel}`
                    : ''}
                </Typography>
              ) : null}
              <Box
                sx={{
                  opacity: 0.95,
                  boxShadow: 4,
                  borderRadius: '4px',
                  outline: `2px solid ${theme.palette.primary.main}`,
                  bgcolor: alpha(theme.palette.background.paper, 0.92),
                }}
              >
                <TaskEventBlock
                  event={
                    preview && !preview.allDay
                      ? { ...activeEvent, start: preview.newStart, end: preview.newEnd, allDay: false }
                      : activeEvent
                  }
                  compact={Boolean(activeEvent.allDay || preview?.allDay)}
                  timedCompact={!activeEvent.allDay && !preview?.allDay}
                />
              </Box>
            </Box>
          ) : null}
        </DragOverlay>
      </DndContext>
    </CalendarDragPreviewProvider>
  );
}
