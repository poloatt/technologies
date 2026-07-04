import React from 'react';
import { Box, Dialog, SwipeableDrawer } from '@mui/material';
import { tareaFormGooglePaperSx } from '@shared/components/forms/tareaFormUi';

/**
 * Opposite column for desktop half-screen panel:
 * Ahora tasks → popup on right (Luego half), Luego tasks → popup on left (Ahora half).
 */
export function getDesktopPanelSide(agendaView) {
  return agendaView === 'ahora' ? 'right' : 'left';
}

/**
 * Shell for task detail popup: SwipeableDrawer on mobile, half-screen Dialog on desktop agenda.
 */
export default function TareaFormDetailShell({
  open,
  onClose,
  isMobile,
  agendaView = 'ahora',
  desktopHalfScreen = false,
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
        <Box
          sx={{
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            pb: 2,
          }}
        >
          {children}
        </Box>
      </SwipeableDrawer>
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
        <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
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
      <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    </Dialog>
  );
}
