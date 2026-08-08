import React from 'react';
import {
  Box,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import { KeyboardArrowDown as ExpandIcon } from '@mui/icons-material';
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
 * Con collapsible, el encabezado actúa como acordeón.
 */
export default function TaskGroupSection({
  title,
  count,
  isMobile: isMobileProp,
  children,
  shellSx,
  headerSx,
  contentSx,
  collapsible = false,
  expanded = true,
  onToggle,
}) {
  const { isMobile: isMobileResponsive, theme } = useResponsive();
  const isMobile = isMobileProp ?? isMobileResponsive;
  const { layoutBg } = getTaskSurfaceTokens(theme);
  const isExpanded = collapsible ? expanded : true;

  return (
    <Paper
      elevation={0}
      sx={{
        ...getTaskGroupShellSx(isMobile),
        ...shellSx,
      }}
    >
      <Box
        sx={{
          borderBottom: isExpanded ? 1 : 0,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            ...getTaskGroupHeaderSx(isMobile),
            ...headerSx,
            ...(collapsible
              ? {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  userSelect: 'none',
                  '&:hover': { bgcolor: 'action.hover' },
                }
              : null),
          }}
          onClick={collapsible ? onToggle : undefined}
          role={collapsible ? 'button' : undefined}
          aria-expanded={collapsible ? isExpanded : undefined}
        >
          {collapsible && (
            <IconButton
              size="small"
              tabIndex={-1}
              aria-hidden
              sx={{
                p: 0.25,
                color: 'text.secondary',
                transform: isExpanded ? 'rotate(-180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            >
              <ExpandIcon fontSize="small" />
            </IconButton>
          )}
          <Typography
            variant={isMobile ? 'body2' : 'subtitle2'}
            sx={{ ...taskGroupTitleSx, flex: 1, minWidth: 0 }}
          >
            {title}
            {count != null && (
              <Box component="span" sx={taskGroupCountSx}>
                {count}
              </Box>
            )}
          </Typography>
        </Box>
      </Box>
      {isExpanded && (
        <Box sx={{ bgcolor: layoutBg, ...contentSx }}>{children}</Box>
      )}
    </Paper>
  );
}
