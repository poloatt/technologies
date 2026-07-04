import React from 'react';
import { Box } from '@mui/material';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { isTaskCompleted } from '@shared/utils/agendaRules';
import TaskEventBlock from '@shared/components/tasks/TaskEventBlock';
import { getEventDragId } from '@shared/utils/calendar/calendarDragUtils';

export default function DraggableTimedEvent({
  event,
  style,
  onEventClick,
  onToggleComplete,
  dndEnabled = false,
}) {
  const completed = isTaskCompleted(event?.task);
  const disabled = !dndEnabled || completed || event?.allDay;

  const dragId = getEventDragId(event);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: dragId,
    data: { event },
    disabled,
  });

  const transformStyle = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <Box
      ref={setNodeRef}
      sx={{
        position: 'absolute',
        top: style.top,
        height: style.height,
        left: style.left,
        width: style.width,
        zIndex: isDragging ? 5 : 1,
        overflow: 'hidden',
        opacity: isDragging ? 0.85 : 1,
        touchAction: disabled ? 'auto' : 'none',
        ...transformStyle,
      }}
      {...(disabled ? {} : { ...listeners, ...attributes })}
    >
      <TaskEventBlock
        event={event}
        timedCompact
        onClick={onEventClick}
        onToggleComplete={onToggleComplete}
      />
    </Box>
  );
}
