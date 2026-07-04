import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drag to scroll horizontal con Pointer Events.
 * Evita clicks accidentales tras un drag (moved flag).
 */
export default function useHorizontalDragScroll({
  enabled = true,
  thresholdPx = 6,
} = {}) {
  const scrollRef = useRef(null);
  const dragRef = useRef({ isDown: false, startX: 0, startScrollLeft: 0, moved: false, captured: false });
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDownCapture = useCallback((e) => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (!el) return;

    dragRef.current.isDown = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startScrollLeft = el.scrollLeft;
    dragRef.current.moved = false;
    dragRef.current.captured = false;

    setIsDragging(true);
  }, [enabled]);

  const onPointerMove = useCallback((e) => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (!el) return;
    if (!dragRef.current.isDown) return;

    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > thresholdPx) {
      dragRef.current.moved = true;
      if (!dragRef.current.captured) {
        try {
          el.setPointerCapture?.(e.pointerId);
          dragRef.current.captured = true;
        } catch {
          // noop
        }
      }
    }
    if (dragRef.current.moved) {
      e.preventDefault?.();
      el.scrollLeft = dragRef.current.startScrollLeft - dx;
    }
  }, [enabled, thresholdPx]);

  const endDrag = useCallback((e) => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (dragRef.current.captured && el) {
      try {
        el.releasePointerCapture?.(e?.pointerId);
      } catch {
        // noop
      }
    }
    dragRef.current.isDown = false;
    dragRef.current.captured = false;
    setIsDragging(false);

    if (dragRef.current.moved) {
      setTimeout(() => {
        dragRef.current.moved = false;
      }, 0);
    } else {
      dragRef.current.moved = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !isDragging) return undefined;
    const handleMove = (e) => onPointerMove(e);
    const handleEnd = (e) => endDrag(e);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, [enabled, isDragging, onPointerMove, endDrag]);

  return {
    scrollRef,
    dragRef,
    isDragging,
    bind: {
      onPointerDownCapture,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}
