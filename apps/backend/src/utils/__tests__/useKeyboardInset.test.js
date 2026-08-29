import {
  resolveKeyboardAwareInset,
  KEYBOARD_OPEN_THRESHOLD,
  MIN_VISIBLE_HEIGHT_FOR_FOOTER,
} from '@shared/hooks/useKeyboardInset.js';

describe('resolveKeyboardAwareInset', () => {
  it('returns 0 when inset is below keyboard threshold', () => {
    expect(resolveKeyboardAwareInset({
      inset: KEYBOARD_OPEN_THRESHOLD - 1,
      visibleHeight: 400,
    })).toBe(0);
  });

  it('returns inset when keyboard is open and viewport has room', () => {
    expect(resolveKeyboardAwareInset({
      inset: 280,
      visibleHeight: 400,
    })).toBe(280);
  });

  it('returns 0 when viewport is too small for footer lift', () => {
    expect(resolveKeyboardAwareInset({
      inset: 280,
      visibleHeight: MIN_VISIBLE_HEIGHT_FOR_FOOTER - 1,
    })).toBe(0);
  });
});
