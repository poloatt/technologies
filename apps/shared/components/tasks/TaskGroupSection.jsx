import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import {
  getTaskGroupShellSx,
  getTaskGroupHeaderSx,
  taskGroupTitleSx,
  taskGroupCountSx,
  getTaskSurfaceTokens,
} from '../../styles/taskListStyles';
import { useResponsive } from '../../hooks';

/**
 * Sección agrupada de tareas (HOY, MAÑANA, RETRASADAS, etc.).
 * Shell visual compartido; el contenido (tabla) lo provee el consumidor.
 */
export default function TaskGroupSection({
  title,
  count,
  isMobile: isMobileProp,
  children,
  shellSx,
  headerSx,
}) {
  const { isMobile: isMobileResponsive, theme } = useResponsive();
  const isMobile = isMobileProp ?? isMobileResponsive;
  const { layoutBg } = getTaskSurfaceTokens(theme);

  return (
    <Paper
      elevation={0}
      sx={{
        ...getTaskGroupShellSx(isMobile),
        ...shellSx,
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ ...getTaskGroupHeaderSx(isMobile), ...headerSx }}>
          <Typography variant={isMobile ? 'body2' : 'subtitle2'} sx={taskGroupTitleSx}>
            {title}
            {count != null && (
              <Box component="span" sx={taskGroupCountSx}>
                {count}
              </Box>
            )}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ bgcolor: layoutBg }}>{children}</Box>
    </Paper>
  );
}
