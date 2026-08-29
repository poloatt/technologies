export function keyboardAwareFooterSx({
  inset = 0,
  isKeyboardOpen = false,
  pinned = false,
  sx = {},
} = {}) {
  return {
    flexShrink: 0,
    transition: 'margin-bottom 0.12s ease-out, bottom 0.12s ease-out',
    ...(pinned
      ? {
        marginBottom: inset > 0 ? `${inset}px` : undefined,
      }
      : {
        position: 'sticky',
        bottom: inset > 0 ? `${inset}px` : 0,
        zIndex: 2,
        ...(isKeyboardOpen
          ? {
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }
          : {}),
      }),
    ...sx,
  };
}
