import { useCallback, useEffect, useRef, useState } from 'react';
import { shiftCalendarDate } from '@shared/utils/focoNavigationUtils';
import { getNormalizedToday } from '@shared/utils/dateUtils';

const SWIPE_THRESHOLD_PX = 50;
/** Cancel swipe when vertical drift exceeds horizontal × this ratio. */
const HORIZONTAL_DOMINANCE = 1.2;
const AXIS_LOCK_PX = 8;

/**
 * Horizontal swipe on a scroll container: left → next, right → prev.
 * Dispatches the same `navigate` event as calendar chevrons.
 */
export function useAgendaSwipeNavigate(viewModeOverride) {
  const elementRef = useRef(null);
  const [calendarDate, setCalendarDate] = useState(() => getNormalizedToday());
  const [viewMode, setViewMode] = useState(() => (
    viewModeOverride === 'week' ? 'week' : 'day'
  ));

  const gestureRef = useRef({
    active: false,
    horizontal: false,
    startX: 0,
    startY: 0,
    pointerId: null,
    touchActive: false,
  });

  useEffect(() => {
    const handleAgendaCalendarState = (event) => {
      const { date, viewMode: vm } = event.detail || {};
      if (date) setCalendarDate(new Date(date));
      if (vm === 'day' || vm === 'week') setViewMode(vm);
    };
    window.addEventListener('agendaCalendarState', handleAgendaCalendarState);
    return () => window.removeEventListener('agendaCalendarState', handleAgendaCalendarState);
  }, []);

  useEffect(() => {
    if (viewModeOverride === 'day' || viewModeOverride === 'week') {
      setViewMode(viewModeOverride);
    }
  }, [viewModeOverride]);

  const effectiveMode = viewModeOverride || viewMode;

  const navigate = useCallback((direction) => {
    const nextDate = shiftCalendarDate(
      calendarDate,
      effectiveMode,
      direction === 'prev' ? 'prev' : 'next',
    );
    setCalendarDate(nextDate);
    window.dispatchEvent(new CustomEvent('navigate', {
      detail: {
        direction,
        date: nextDate.toISOString(),
      },
    }));
  }, [calendarDate, effectiveMode]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return undefined;

    const g = () => gestureRef.current;

    const resetGesture = () => {
      const state = g();
      state.active = false;
      state.horizontal = false;
      state.pointerId = null;
    };

    const beginGesture = (x, y, pointerId = null) => {
      const state = g();
      state.active = true;
      state.horizontal = false;
      state.startX = x;
      state.startY = y;
      state.pointerId = pointerId;
    };

    const updateGesture = (x, y, event) => {
      const state = g();
      if (!state.active) return;

      const dx = x - state.startX;
      const dy = y - state.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (!state.horizontal) {
        if (absX < AXIS_LOCK_PX && absY < AXIS_LOCK_PX) return;
        if (absY > absX * HORIZONTAL_DOMINANCE) {
          state.active = false;
          return;
        }
        if (absX > absY) {
          state.horizontal = true;
        } else {
          state.active = false;
          return;
        }
      }

      if (state.horizontal && event?.cancelable) {
        event.preventDefault();
      }
    };

    const finishGesture = (x) => {
      const state = g();
      if (!state.active) return;

      const wasHorizontal = state.horizontal;
      const dx = x - state.startX;
      resetGesture();

      if (!wasHorizontal || Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
      navigate(dx < 0 ? 'next' : 'prev');
    };

    const onTouchStart = (event) => {
      if (event.touches.length !== 1) return;
      g().touchActive = true;
      const touch = event.touches[0];
      beginGesture(touch.clientX, touch.clientY);
    };

    const onTouchMove = (event) => {
      if (!g().touchActive || event.touches.length !== 1) return;
      const touch = event.touches[0];
      updateGesture(touch.clientX, touch.clientY, event);
    };

    const onTouchEnd = (event) => {
      if (!g().touchActive) return;
      g().touchActive = false;
      const touch = event.changedTouches[0];
      if (touch) finishGesture(touch.clientX);
      else resetGesture();
    };

    const onTouchCancel = () => {
      g().touchActive = false;
      resetGesture();
    };

    const onPointerDown = (event) => {
      if (g().touchActive || event.pointerType === 'touch') return;
      if (g().pointerId !== null) return;
      beginGesture(event.clientX, event.clientY, event.pointerId);
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        // noop
      }
    };

    const onPointerMove = (event) => {
      if (g().pointerId !== event.pointerId) return;
      updateGesture(event.clientX, event.clientY, event);
    };

    const onPointerUp = (event) => {
      if (g().pointerId !== event.pointerId) return;
      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        // noop
      }
      finishGesture(event.clientX);
    };

    const onPointerCancel = (event) => {
      if (g().pointerId === event.pointerId) resetGesture();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [navigate]);

  return elementRef;
}
