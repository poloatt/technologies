import { useCallback } from 'react';
import {
  computeAllDayMove,
  computeAllDayToTimedMove,
  computeEventMove,
  parseCalendarDropTarget,
  relativeYFromDragEvent,
} from '@shared/utils/calendar/calendarDragUtils';

/**
 * onEventMove(calendarEvent, newStart, newEnd, { allDay })
 */
export function useCalendarDragEnd(onEventMove) {
  return useCallback((dragEndEvent) => {
    const { active, over, delta } = dragEndEvent;
    if (!over || !active?.data?.current?.event || !onEventMove) return;

    const dragEvent = active.data.current.event;
    const target = parseCalendarDropTarget(over.id);
    if (!target) return;

    let move = null;
    if (target.zone === 'allDay') {
      move = computeAllDayMove(target.day);
    } else if (dragEvent.allDay) {
      move = computeAllDayToTimedMove(target.day, relativeYFromDragEvent(dragEndEvent));
    } else {
      move = computeEventMove(dragEvent, target.day, delta?.y ?? 0);
    }
    if (!move) return;

    // #region agent log
    fetch('http://127.0.0.1:7888/ingest/f576597c-5e27-437e-8e5f-1cd13a8697b4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b064c0' },
      body: JSON.stringify({
        sessionId: 'b064c0',
        runId: 'post-fix',
        hypothesisId: 'H2',
        location: 'useCalendarDragEnd.js',
        message: 'drag end computed move',
        data: {
          title: String(dragEvent?.task?.titulo || '').slice(0, 40),
          fromAllDay: Boolean(dragEvent?.allDay),
          zone: target.zone,
          toAllDay: Boolean(move.allDay),
          newStart: move.newStart?.toISOString?.() || String(move.newStart),
          newEnd: move.newEnd?.toISOString?.() || String(move.newEnd),
          snapMin: move.newStart instanceof Date ? move.newStart.getMinutes() : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    onEventMove(dragEvent, move.newStart, move.newEnd, { allDay: Boolean(move.allDay) });
  }, [onEventMove]);
}
