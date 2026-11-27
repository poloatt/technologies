import React from 'react';
import {
  Box,
  Dialog,
  IconButton,
  Typography,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import useResponsive from '../../hooks/useResponsive';
import {
  emergentWindowBodySx,
  emergentWindowHalfPaperSx,
  emergentWindowHeaderSx,
  emergentWindowPaperSx,
  emergentWindowTitleSx,
} from '../../styles/emergentWindowStyles';

/**
 * Ventana emergente compartida (Caja, y luego Foco y Puylso).
 * Header: volver, título y acciones. El fondo es el color oscuro del tema, casi opaco.
 */
export default function EmergentWindow({
  open,
  onClose,
  title,
  subtitle,
  headerActions = null,
  halfScreen = false,
  bodySx,
  children,
}) {
  const { isMobile } = useResponsive();
  const useHalf = halfScreen && !isMobile;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth={useHalf ? false : 'sm'}
      fullWidth={!useHalf}
      PaperProps={{
        sx: useHalf
          ? { ...emergentWindowPaperSx, ...emergentWindowHalfPaperSx }
          : emergentWindowPaperSx,
      }}
      sx={useHalf ? {
        '& .MuiDialog-container': {
          alignItems: 'center',
          justifyContent: 'center',
        },
      } : undefined}
    >
      <Box sx={emergentWindowHeaderSx}>
        <IconButton
          aria-label="Volver"
          onClick={onClose}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          <ArrowBack fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={emergentWindowTitleSx}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" noWrap>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {headerActions ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
            {headerActions}
          </Box>
        ) : null}
      </Box>
      <Box sx={{ ...emergentWindowBodySx, ...bodySx }}>
        {open ? children : null}
      </Box>
    </Dialog>
  );
}
