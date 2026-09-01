import { useCallback, useEffect, useRef, useState } from 'react';

const LONG_PRESS_MS = 550;
const MOVE_CANCEL_PX = 10;

/**
 * Menú contextual: posponer / empujar / ignorar por hoy (clic derecho / long-press).
 */
export default function useHabitItemContextMenu({ enabled = true } = {}) {
  const [menuState, setMenuState] = useState({
    open: false,
    anchorPosition: null,
    entry: null,
    postponeLabel: null,
    empujarLabel: null,
    franja: null,
    canPostpone: false,
    canEmpujar: false,
    menuOptions: null,
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

  const openMenu = useCallback((entry, clientX, clientY, menuMetaOrGetter) => {
    if (!enabled || !entry) return;
    const menuMeta = typeof menuMetaOrGetter === 'function'
      ? menuMetaOrGetter()
      : menuMetaOrGetter;
    if (!menuMeta?.canDefer) return;

    const {
      postponeLabel,
      empujarLabel,
      franja,
      canPostpone = false,
      canEmpujar = false,
      menuOptions = null,
    } = menuMeta || {};

    setMenuState({
      open: true,
      entry,
      anchorPosition: { top: clientY, left: clientX },
      postponeLabel,
      empujarLabel,
      franja,
      canPostpone,
      canEmpujar,
      menuOptions,
    });
  }, [enabled]);

  const scheduleLongPress = useCallback((entry, clientX, clientY, metaOrGetter) => {
    clearLongPressTimer();
    longPressActivatedRef.current = false;
    pointerStartRef.current = { x: clientX, y: clientY };

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressActivatedRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
      openMenu(entry, clientX, clientY, metaOrGetter);
    }, LONG_PRESS_MS);
  }, [clearLongPressTimer, openMenu]);

  const shouldCancelLongPress = useCallback((clientX, clientY) => {
    const start = pointerStartRef.current;
    if (!start) return false;
    const dx = Math.abs(clientX - start.x);
    const dy = Math.abs(clientY - start.y);
    return dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX;
  }, []);

  const resolveMenuMeta = (menuMetaOrGetter) => (
    typeof menuMetaOrGetter === 'function' ? menuMetaOrGetter() : menuMetaOrGetter
  );

  const getPostponeHandlers = useCallback((entry, menuMetaOrGetter) => {
    if (!enabled || !menuMetaOrGetter) return {};
    if (typeof menuMetaOrGetter !== 'function' && !menuMetaOrGetter.canDefer) {
      return {};
    }

    const cancelLongPressIfPending = () => {
      if (!longPressActivatedRef.current) {
        clearLongPressTimer();
      }
    };

    const triggerMenu = (event) => {
      const menuMeta = resolveMenuMeta(menuMetaOrGetter);
      if (!menuMeta?.canDefer) return;
      event.preventDefault();
      event.stopPropagation();
      clearLongPressTimer();
      openMenu(entry, event.clientX, event.clientY, menuMeta);
    };

    return {
      onContextMenu: triggerMenu,
      onPointerDown: (event) => {
        if (event.pointerType === 'mouse') {
          if (event.button === 2) {
            triggerMenu(event);
          }
          return;
        }
        if (event.button && event.button !== 0) return;
        scheduleLongPress(entry, event.clientX, event.clientY, menuMetaOrGetter);
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

  const getTextColumnHandlers = getPostponeHandlers;

  return {
    menuState,
    closeMenu,
    getPostponeHandlers,
    getTextColumnHandlers,
    /** @deprecated use getPostponeHandlers */
    getRowHandlers: getPostponeHandlers,
  };
}
