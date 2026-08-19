import React from 'react';
import { Dialog, DialogContent } from '@mui/material';
import { tareaFormDialogPaperSx } from '@shared/components/forms/tareaFormUi';

/** Shell compartido estilo Google Calendar para form y detail. */
export default function PropiedadDialogShell({
  open,
  onClose,
  isMobile,
  disableBackdropClose = false,
  children,
  footer = null,
}) {
  return (
    <Dialog
      open={open}
      onClose={disableBackdropClose ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          ...tareaFormDialogPaperSx(isMobile),
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      sx={{
        zIndex: 1300,
        '& .MuiBackdrop-root': {
          bottom: isMobile ? '56px' : 0,
        },
      }}
    >
      <DialogContent
        sx={{
          bgcolor: 'background.paper',
          flex: 1,
          overflowY: 'auto',
          py: 0,
          px: 0,
        }}
      >
        {children}
      </DialogContent>
      {footer}
    </Dialog>
  );
}
