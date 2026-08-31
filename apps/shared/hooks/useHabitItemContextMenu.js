import { useCallback, useEffect, useRef, useState } from 'react';

const LONG_PRESS_MS = 550;
const MOVE_CANCEL_PX = 10;

/**
 * Menú contextual para posponer un hábito (clic derecho / mantener pulsado).
 */
export default function useHabitItemContextMenu({ enabled = true } = {}) {
  const [menuState, setMenuState] = useState({
    open: false,
    anchorPosition: null,
    entry: null,
    postponeLabel: null,
    franja: null,
  });
  const longPressTimerRef = useRef(null);
  const longPressActivatedRef = useRef(false);
  const pointerStartRef = useRef(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = null;
  }, []);

  useEffect(() => () => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const closeMenu = useCallback(() => {
    setMenuState((prev) => ({ ...prev, open: false }));
  }, []);

  const openMenu = useCallback((entry, clientX, clientY, { postponeLabel, franja }) => {
    if (!enabled || !entry || !postponeLabel) return;
    setMenuState({
      open: true,
      entry,
      anchorPosition: { top: clientY, left: clientX },
      postponeLabel,
      franja,
    });
  }, [enabled]);

  const scheduleLongPress = useCallback((entry, clientX, clientY, meta) => {
    clearLongPressTimer();
    longPressActivatedRef.current = false;
    pointerStartRef.current = { x: clientX, y: clientY };

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressActivatedRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
      openMenu(entry, clientX, clientY, meta);
    }, LONG_PRESS_MS);
  }, [clearLongPressTimer, openMenu]);

  const shouldCancelLongPress = useCallback((clientX, clientY) => {
    const start = pointerStartRef.current;
    if (!start) return false;
    const dx = Math.abs(clientX - start.x);
    const dy = Math.abs(clientY - start.y);
    return dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX;
  }, []);

  const getTextColumnHandlers = useCallback((entry, { canPostpone, postponeLabel, franja }) => {
    if (!enabled || !canPostpone || !postponeLabel) {
      return {};
    }

    const meta = { postponeLabel, franja };

    const cancelLongPressIfPending = () => {
      if (!longPressActivatedRef.current) {
        clearLongPressTimer();
      }
    };

    return {
      onContextMenu: (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearLongPressTimer();
        openMenu(entry, event.clientX, event.clientY, meta);
      },
      onPointerDown: (event) => {
        if (event.pointerType === 'mouse') return;
        if (event.button && event.button !== 0) return;
        scheduleLongPress(entry, event.clientX, event.clientY, meta);
      },
      onPointerUp: cancelLongPressIfPending,
      onPointerMove: (event) => {
        if (event.pointerType === 'mouse') return;
        if (shouldCancelLongPress(event.clientX, event.clientY)) {
          clearLongPressTimer();
        }
      },
      onPointerCancel: cancelLongPressIfPending,
      onPointerLeave: cancelLongPressIfPending,
      onClick: (event) => {
        if (longPressActivatedRef.current) {
          event.preventDefault();
          event.stopPropagation();
          longPressActivatedRef.current = false;
        }
      },
    };
  }, [
    enabled,
    openMenu,
    scheduleLongPress,
    clearLongPressTimer,
    shouldCancelLongPress,
  ]);

  return {
    menuState,
    closeMenu,
    getTextColumnHandlers,
    /** @deprecated use getTextColumnHandlers */
    getRowHandlers: getTextColumnHandlers,
  };
}
