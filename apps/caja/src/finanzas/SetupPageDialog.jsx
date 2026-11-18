import React from 'react';
import {
  Box,
  Dialog,
  IconButton,
  Typography,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import useResponsive from '@shared/hooks/useResponsive';

/**
 * Shell de setup contextual.
 * Header: volver + título + acciones (sync / +), misma UX que Finanzas toolbar.
 */
export default function SetupPageDialog({
  open,
  onClose,
  title,
  subtitle,
  headerActions = null,
  children,
}) {
  const { isMobile } = useResponsive();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 0,
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          minHeight: isMobile ? '100%' : '64vh',
          maxHeight: isMobile ? '100%' : '88vh',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.25,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        <IconButton
          aria-label="Volver"
          onClick={onClose}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          <ArrowBack fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
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
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 0 }}>
        {open ? children : null}
      </Box>
    </Dialog>
  );
}
