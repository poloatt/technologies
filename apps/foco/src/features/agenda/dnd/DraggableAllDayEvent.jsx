import React from 'react';
import { Box } from '@mui/material';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import TaskEventBlock from '@shared/components/tasks/TaskEventBlock';
import {
  getEventDragId,
  isCalendarTaskDraggable,
} from '@shared/utils/calendar/calendarDragUtils';

export default function DraggableAllDayEvent({
  event,
  onEventClick,
  onToggleComplete,
  compact = true,
  dndEnabled = false,
}) {
  const disabled = !dndEnabled || !isCalendarTaskDraggable(event?.task);

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

  const suppressClickRef = React.useRef(false);
  React.useEffect(() => {
    if (isDragging) suppressClickRef.current = true;
  }, [isDragging]);

  const handleBlockClick = (task) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onEventClick?.(task);
  };

  const transformStyle = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <Box
      ref={setNodeRef}
      sx={{
        touchAction: disabled ? 'auto' : 'none',
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 5 : 1,
        cursor: disabled ? undefined : (isDragging ? 'grabbing' : 'grab'),
        ...transformStyle,
      }}
      {...(disabled ? {} : { ...listeners, ...attributes })}
    >
      <TaskEventBlock
        event={event}
        compact={compact}
        onClick={handleBlockClick}
        onToggleComplete={onToggleComplete}
      />
    </Box>
  );
}
