import { useCallback, useEffect, useState } from 'react';

/** Minimum inset (px) before treating the keyboard as open. */
export const KEYBOARD_OPEN_THRESHOLD = 80;

/** Minimum visible viewport height to lift the footer above the keyboard. */
export const MIN_VISIBLE_HEIGHT_FOR_FOOTER = 140;

export function measureKeyboardInset() {
  if (typeof window === 'undefined') {
    return { inset: 0, visibleHeight: 0 };
  }

  const vv = window.visualViewport;
  if (!vv) {
    return { inset: 0, visibleHeight: window.innerHeight };
  }

  const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  return { inset, visibleHeight: Math.round(vv.height) };
}

/** Returns lift amount only when the keyboard is open and there is room for the footer. */
export function resolveKeyboardAwareInset({ inset, visibleHeight } = {}) {
  if (!inset || inset < KEYBOARD_OPEN_THRESHOLD) return 0;
  if (visibleHeight < MIN_VISIBLE_HEIGHT_FOR_FOOTER) return 0;
  return inset;
}

export default function useKeyboardInset({ enabled = true } = {}) {
  const [state, setState] = useState({
    inset: 0,
    visibleHeight: 0,
    isKeyboardOpen: false,
  });

  const update = useCallback(() => {
    if (!enabled) {
      setState({ inset: 0, visibleHeight: 0, isKeyboardOpen: false });
      return;
    }

    const measured = measureKeyboardInset();
    const inset = resolveKeyboardAwareInset(measured);
    setState({
      inset,
      visibleHeight: measured.visibleHeight,
      isKeyboardOpen: inset > 0,
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;

    update();

    const vv = window.visualViewport;
    if (!vv) return undefined;

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [enabled, update]);

  return state;
}
