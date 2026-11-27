import React, { useMemo } from 'react';
import {
  Box,
  Button,
  Divider,
  Popover,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import FastForwardOutlinedIcon from '@mui/icons-material/FastForwardOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import useHabitsPreferences from '@shared/hooks/useHabitsPreferences';
import {
  findChainForHabit,
  isGroupedRoutineChain,
  resolveRoutineDisplayName,
  resolveSectionLabel,
  resolveHabitChainContext,
  isEntryGroupedRoutineChain,
} from '@shared/habits';
import { HABIT_CHAIN_COPY } from '@shared/copy/agendaTerminology';
import { resolveHabitDisplayIcon } from '@shared/utils/habitOutlineIcons';
import HabitCadenceMiniGrid from './HabitCadenceMiniGrid';
import { FONT_SIZE } from '../../tipografia';

function ActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  tone = 'default',
}) {
  const theme = useTheme();
  const isPrimary = tone === 'primary';
  const isMuted = tone === 'muted';

  return (
    <Button
      size="small"
      fullWidth
      disabled={disabled || !label}
      onClick={onClick}
      startIcon={icon}
      sx={{
        justifyContent: 'flex-start',
        textTransform: 'none',
        fontWeight: 600,
        fontSize: FONT_SIZE.sm,
        py: 0.65,
        px: 1,
        borderRadius: 1.25,
        border: '1px solid',
        borderColor: isPrimary
          ? alpha(theme.palette.primary.main, 0.35)
          : 'divider',
        bgcolor: isPrimary
          ? alpha(theme.palette.primary.main, 0.08)
          : (isMuted ? alpha(theme.palette.text.primary, 0.03) : 'background.paper'),
        color: 'text.primary',
        '&:hover': {
          bgcolor: isPrimary
            ? alpha(theme.palette.primary.main, 0.14)
            : alpha(theme.palette.text.primary, 0.06),
          borderColor: isPrimary
            ? alpha(theme.palette.primary.main, 0.5)
            : alpha(theme.palette.text.primary, 0.2),
        },
        '&.Mui-disabled': {
          opacity: 0.45,
        },
        '& .MuiButton-startIcon': {
          marginRight: 0.75,
          '& > svg': { fontSize: '1rem' },
        },
      }}
    >
      {label}
    </Button>
  );
}

/**
 * Mini-card contextual de hábito (clic derecho / long-press):
 * nombre, rutina, grid de cadencia/contadores y acciones de deferral.
 */
export default function HabitItemPostponeMenu({
  open,
  anchorPosition,
  postponeLabel,
  empujarLabel,
  showActions = true,
  onClose,
  onPostpone,
  onEmpujar,
  onIgnoreToday,
  habitLabel = null,
  Icon = null,
  iconName = null,
  config = null,
  rutina = null,
  section = null,
  itemId = null,
  itemValue = null,
  routineName: routineNameProp = null,
  chain = null,
}) {
  const theme = useTheme();
  const { habitChains } = useHabitsPreferences();

  const resolvedChain = useMemo(() => {
    if (chain && isEntryGroupedRoutineChain(chain)) return chain;
    if (!section || !itemId) return null;
    const found = findChainForHabit(habitChains, section, itemId);
    if (!found || !isGroupedRoutineChain(found)) return null;
    return resolveHabitChainContext(habitChains, section, itemId);
  }, [chain, habitChains, section, itemId]);

  const routineName = routineNameProp
    || (resolvedChain ? resolveRoutineDisplayName(resolvedChain) : HABIT_CHAIN_COPY.noRoutine);

  const sectionLabel = section ? resolveSectionLabel(section) : null;

  const title = habitLabel || itemId || 'Hábito';
  const DisplayIcon = Icon
    ? resolveHabitDisplayIcon(Icon, { iconName, outline: true })
    : null;

  const runAndClose = (fn) => () => {
    fn?.();
    onClose?.();
  };

  const ignoreLabel = 'Retrasar por hoy';

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition || undefined}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        root: { sx: { zIndex: 1500 } },
        paper: {
          elevation: 8,
          sx: {
            width: 248,
            maxWidth: 'calc(100vw - 24px)',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            overflow: 'hidden',
            boxShadow: theme.shadows[8],
          },
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <Box sx={{ px: 1.25, pt: 1.25, pb: 1, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          {DisplayIcon ? (
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.25,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: alpha(theme.palette.text.primary, 0.03),
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'text.secondary',
                '& > svg': { fontSize: '1.25rem' },
              }}
            >
              <DisplayIcon />
            </Box>
          ) : null}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                lineHeight: 1.25,
                wordBreak: 'break-word',
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.15, lineHeight: 1.3 }}
            >
              {routineName}
            </Typography>
            {sectionLabel ? (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 0.1,
                  color: alpha(theme.palette.text.secondary, 0.85),
                  fontSize: FONT_SIZE.xs,
                }}
              >
                {sectionLabel}
              </Typography>
            ) : null}
          </Box>
        </Box>

        {config ? (
          <>
            <Divider />
            <Box sx={{ px: 1.25, py: 1 }}>
              <HabitCadenceMiniGrid
                config={config}
                rutina={rutina}
                section={section}
                itemId={itemId}
                itemValue={itemValue}
              />
            </Box>
          </>
        ) : null}

        {showActions ? (
          <>
            <Divider />
            <Box
              sx={{
                px: 1,
                py: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
              }}
            >
              <ActionButton
                tone="primary"
                icon={<ScheduleOutlinedIcon />}
                label={postponeLabel || 'Posponer'}
                disabled={!postponeLabel}
                onClick={runAndClose(onPostpone)}
              />
              <ActionButton
                tone="muted"
                icon={<EventBusyOutlinedIcon />}
                label={ignoreLabel}
                onClick={runAndClose(onIgnoreToday)}
              />
              {empujarLabel ? (
                <ActionButton
                  icon={<FastForwardOutlinedIcon />}
                  label={empujarLabel}
                  onClick={runAndClose(onEmpujar)}
                />
              ) : null}
            </Box>
          </>
        ) : null}
      </Box>
    </Popover>
  );
}
