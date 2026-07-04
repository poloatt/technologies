import { useCallback } from 'react';
import { computeEventMove, parseDayDropId } from '@shared/utils/calendar/calendarDragUtils';

export function useCalendarDragEnd(onEventMove) {
  return useCallback((event) => {
    const { active, over, delta } = event;
    if (!over || !active?.data?.current?.event || !onEventMove) return;

    const dragEvent = active.data.current.event;
    const targetDay = parseDayDropId(over.id);
    if (!targetDay) return;

    const move = computeEventMove(dragEvent, targetDay, delta?.y ?? 0);
    if (!move) return;

    onEventMove(dragEvent, move.newStart, move.newEnd);
  }, [onEventMove]);
}
