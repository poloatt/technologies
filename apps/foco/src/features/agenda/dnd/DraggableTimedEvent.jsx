import React, { useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import TaskEventBlock from '@shared/components/tasks/TaskEventBlock';
import {
  getEventDragId,
  isCalendarTaskDraggable,
} from '@shared/utils/calendar/calendarDragUtils';

export default function DraggableTimedEvent({
  event,
  style,
  layer = null,
  onEventClick,
  onToggleComplete,
  dndEnabled = false,
}) {
  const disabled = !dndEnabled || event?.allDay || !isCalendarTaskDraggable(event?.task);
  const isEvento = String(event?.task?.tipo || '').toUpperCase() === 'EVENTO'
    || layer === 'evento';

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

  const handleBlockClick = useCallback((task) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onEventClick?.(task);
  }, [onEventClick]);

  // Native div: MUI Box was expanding pills (~44px vs 22px style).
  const geometryStyle = {
    position: 'absolute',
    top: style?.top ?? 0,
    left: style?.left ?? 0,
    width: style?.width ?? '100%',
    height: style?.height,
    maxHeight: style?.height,
    minHeight: 0,
    boxSizing: 'border-box',
    overflow: 'hidden',
    zIndex: isDragging ? 6 : (isEvento ? 1 : 3),
    opacity: isDragging ? 0.35 : 1,
    touchAction: disabled ? 'auto' : 'none',
    cursor: disabled ? undefined : (isDragging ? 'grabbing' : 'grab'),
    ...(transform ? { transform: CSS.Translate.toString(transform) } : null),
  };

  const setRefs = useCallback((node) => {
    setNodeRef(node);
    // #region agent log
    if (!node || isEvento) return;
    const title = String(event?.task?.titulo || '');
    if (!(/yogurt|aspirar|limpiar/i.test(title))) return;
    requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      const computed = window.getComputedStyle(node);
      fetch('http://127.0.0.1:7888/ingest/f576597c-5e27-437e-8e5f-1cd13a8697b4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b064c0' },
        body: JSON.stringify({
          sessionId: 'b064c0',
          runId: 'post-fix',
          hypothesisId: 'H',
          location: 'DraggableTimedEvent.jsx:measure',
          message: 'measured DOM geometry',
          data: {
            title: title.slice(0, 40),
            styleHeight: style?.height,
            measuredH: Math.round(rect.height * 10) / 10,
            computedH: computed.height,
            computedMinH: computed.minHeight,
            computedMaxH: computed.maxHeight,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    });
    // #endregion
  }, [setNodeRef, isEvento, event, style]);

  return (
    <div
      ref={setRefs}
      style={geometryStyle}
      {...(disabled ? {} : { ...listeners, ...attributes })}
    >
      <TaskEventBlock
        event={event}
        timedCompact
        onClick={handleBlockClick}
        onToggleComplete={onToggleComplete}
      />
    </div>
  );
}
