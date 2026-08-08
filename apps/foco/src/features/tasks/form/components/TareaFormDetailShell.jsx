import React from 'react';
import { Box, Dialog, Paper, SwipeableDrawer } from '@mui/material';
import { tareaFormGooglePaperSx } from '@shared/components/forms/tareaFormUi';

/**
 * Opposite column for desktop half-screen panel:
 * Ahora tasks → popup on right (Luego half), Luego tasks → popup on left (Ahora half).
 */
export function getDesktopPanelSide(agendaView) {
  return agendaView === 'ahora' ? 'right' : 'left';
}

const scrollBodySx = {
  overflowY: 'auto',
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
};

const footerOutsideSx = {
  flexShrink: 0,
  bgcolor: 'background.default',
};

/**
 * Shell for task detail popup:
 * - Mobile: bottom SwipeableDrawer
 * - Desktop embedded: card + footer bar outside (always visible)
 * - Desktop dialog: half-screen panel on the opposite side (fallback)
 *
 * When `footer` is provided, it stays pinned below the scrollable body
 * (and outside the card in embedded mode) — side-sheet best practice.
 */
export default function TareaFormDetailShell({
  open,
  onClose,
  isMobile,
  agendaView = 'ahora',
  desktopHalfScreen = false,
  embedded = false,
  footer = null,
  children,
}) {
  if (isMobile) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        onOpen={() => {}}
        disableSwipeToOpen
        PaperProps={{
          sx: {
            ...tareaFormGooglePaperSx(true),
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        sx={{
          zIndex: 1300,
          '& .MuiBackdrop-root': { bottom: '56px' },
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 4,
            borderRadius: 2,
            bgcolor: 'divider',
            mx: 'auto',
            mt: 1,
            mb: 0.5,
            flexShrink: 0,
          }}
        />
        <Box sx={scrollBodySx}>{children}</Box>
        {footer && (
          <Box sx={{ ...footerOutsideSx, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            {footer}
          </Box>
        )}
      </SwipeableDrawer>
    );
  }

  if (desktopHalfScreen && embedded) {
    if (!open) return null;
    return (
      <Box
        sx={{
          flex: 1,
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          gap: 1,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            ...tareaFormGooglePaperSx(false),
            flex: 1,
            minHeight: 0,
            width: '100%',
            m: 0,
            borderRadius: 1.5,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={scrollBodySx}>{children}</Box>
        </Paper>
        {footer && <Box sx={footerOutsideSx}>{footer}</Box>}
      </Box>
    );
  }

  if (desktopHalfScreen) {
    const side = getDesktopPanelSide(agendaView);
    const onRight = side === 'right';

    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth={false}
        hideBackdrop={false}
        PaperProps={{
          sx: {
            ...tareaFormGooglePaperSx(false),
            position: 'fixed',
            m: 0,
            width: '50vw',
            maxWidth: '50vw',
            height: 'calc(100vh - 170px)',
            top: 85,
            ...(onRight ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' }),
            borderRadius: onRight ? '12px 0 0 12px' : '0 12px 12px 0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
        sx={{
          zIndex: 1300,
          '& .MuiDialog-container': {
            alignItems: 'flex-start',
            justifyContent: onRight ? 'flex-end' : 'flex-start',
          },
        }}
      >
        <Box sx={scrollBodySx}>{children}</Box>
        {footer && (
          <Box sx={{ ...footerOutsideSx, borderTop: 1, borderColor: 'divider' }}>
            {footer}
          </Box>
        )}
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          ...tareaFormGooglePaperSx(false),
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
          overflow: 'hidden',
        },
      }}
      sx={{ zIndex: 1300 }}
    >
      <Box sx={scrollBodySx}>{children}</Box>
      {footer && (
        <Box sx={{ ...footerOutsideSx, borderTop: 1, borderColor: 'divider' }}>
          {footer}
        </Box>
      )}
    </Dialog>
  );
}
