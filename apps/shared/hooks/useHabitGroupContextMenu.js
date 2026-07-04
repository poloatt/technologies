import { useCallback, useEffect, useRef, useState } from 'react';

const LONG_PRESS_MS = 500;

/**
 * Menú contextual para grupos de hábitos (clic derecho / mantener pulsado).
 */
export default function useHabitGroupContextMenu({ enabled = true } = {}) {
  const [menuState, setMenuState] = useState({
    open: false,
    sectionId: null,
    anchorPosition: null,
  });
  const longPressTimerRef = useRef(null);
  const longPressActivatedRef = useRef(false);

  useEffect(() => () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  }, []);

  const closeMenu = useCallback(() => {
    setMenuState((prev) => ({ ...prev, open: false }));
  }, []);

  const openMenu = useCallback((sectionId, clientX, clientY) => {
    if (!enabled || !sectionId) return;
    setMenuState({
      open: true,
      sectionId,
      anchorPosition: { top: clientY, left: clientX },
    });
  }, [enabled]);

  const getSectionHandlers = useCallback((sectionId, isCustom) => {
    if (!enabled || !isCustom) {
      return {};
    }

    return {
      onContextMenu: (event) => {
        event.preventDefault();
        event.stopPropagation();
        openMenu(sectionId, event.clientX, event.clientY);
      },
      onTouchStart: (event) => {
        longPressActivatedRef.current = false;
        const touch = event.touches?.[0];
        if (!touch) return;
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
          longPressActivatedRef.current = true;
          openMenu(sectionId, touch.clientX, touch.clientY);
        }, LONG_PRESS_MS);
      },
      onTouchEnd: () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      },
      onTouchMove: () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      },
      onClick: (event) => {
        if (longPressActivatedRef.current) {
          event.preventDefault();
          event.stopPropagation();
          longPressActivatedRef.current = false;
        }
      },
    };
  }, [enabled, openMenu]);

  return {
    menuState,
    closeMenu,
    getSectionHandlers,
  };
}
