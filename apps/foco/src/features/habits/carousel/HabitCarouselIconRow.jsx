import React, { useEffect, useRef, useCallback, memo, useState, useMemo } from 'react';
import { Box, CircularProgress, Collapse, IconButton, Tooltip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import { resolveCarouselItemConfig } from '@shared/habits';
import { getHabitSlotCopy } from '@shared/copy/agendaTerminology';
import HabitCarouselEmptyState from './HabitCarouselEmptyState';
import HabitCarouselIconButton from '@shared/components/habits/HabitCarouselIconButton';
import HabitCarouselScrollTrack from '@shared/components/habits/HabitCarouselScrollTrack';
import { getHabitCarouselSurface } from '@shared/styles/habitCarouselStyles';
import useHorizontalDragScroll from '@shared/hooks/useHorizontalDragScroll';
import { dispatchOpenHabitsManager } from '../manager';

const MotionBox = motion.create(Box);

const carouselActionIconSx = (theme, { active = false } = {}) => ({
  flexShrink: 0,
  color: active ? 'primary.main' : 'text.secondary',
  '&:hover': {
    bgcolor: alpha(theme.palette.text.primary, 0.06),
  },
});

function renderCarouselIcon({
  entry,
  index,
  sectionIconsMap,
  rutinaHoy,
  habitsPreferences,
  currentTimeOfDay,
  mode,
  dense,
  interactive,
  showCompletionState,
  bg,
  hoverBg,
  rail,
  size,
  iconFontSize,
  onToggle,
  keySuffix = '',
}) {
  const { section, itemId, horario } = entry;
  const Icon = sectionIconsMap.iconsMap[section]?.[itemId];
  const label = sectionIconsMap.labelsMap[section]?.[itemId] || itemId;
  if (!Icon) return null;

  const itemConfig = resolveCarouselItemConfig(
    section,
    itemId,
    rutinaHoy,
    habitsPreferences,
  );
  const itemValue = rutinaHoy?.[section]?.[itemId];
  const uniqueKey = `${section}.${itemId}.${horario || 'none'}${keySuffix ? `.${keySuffix}` : ''}.${index}`;

  return (
    <MotionBox
      key={uniqueKey}
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ duration: 0.2 }}
      sx={{ display: 'inline-flex', flex: '0 0 auto' }}
    >
      <HabitCarouselIconButton
        section={section}
        itemId={itemId}
        Icon={Icon}
        label={label}
        itemConfig={itemConfig}
        itemValue={itemValue}
        currentTimeOfDay={currentTimeOfDay}
        rutinaHoy={rutinaHoy}
        mode={mode}
        displayHorario={horario || null}
        dense={dense}
        interactive={interactive}
        showCompletionState={showCompletionState}
        bg={bg}
        hoverBg={hoverBg}
        rail={rail}
        size={size}
        iconFontSize={iconFontSize}
        onToggle={onToggle}
      />
    </MotionBox>
  );
}

/**
 * Shell compartido del carrusel: drag scroll, íconos, bordes finitos.
 * @param {'ahora'|'luego'} mode
 */
function HabitCarouselIconRow({
  mode = 'ahora',
  variant = 'iconsRow',
  dense = true,
  showDividers = true,
  enableDragScroll = true,
  interactive = true,
  carouselItems,
  pendingItems,
  completedTodayItems = [],
  showCompletedToggle = false,
  rutinaHoy,
  sectionIconsMap,
  habitsPreferences = {},
  currentTimeOfDay,
  rutinasLoading,
  habitsLoading,
  rutinasError,
  hasConfiguredHabits = true,
  scrollRef,
  carouselRef,
  isDragging,
  bind,
  onToggle,
  onConfigure,
  mobile = false,
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [showCompletedPanel, setShowCompletedPanel] = useState(false);
  const completedDrag = useHorizontalDragScroll({ enabled: enableDragScroll });

  const { size, bg, hoverBg, rail, dividerColor, iconFontSize } = getHabitCarouselSurface(theme, {
    dense: dense && !mobile,
    mobile,
  });
  const panelBg = theme.palette.background.default;
  const fadeColor = panelBg;

  const handleConfigure = useCallback(() => {
    if (onConfigure) {
      onConfigure();
      return;
    }
    dispatchOpenHabitsManager();
  }, [onConfigure]);

  const handleCompletedToggle = useCallback((section, itemId, horario) => {
    if (completedDrag.dragRef.current.moved) return;
    onToggle?.(section, itemId, horario);
  }, [onToggle, completedDrag.dragRef]);

  const hasPending = pendingItems.length > 0;
  const hasCompleted = completedTodayItems.length > 0;
  const showToggle = showCompletedToggle && hasCompleted;

  const showCompletionState = mode === 'ahora';
  const slotCopy = getHabitSlotCopy(mode);

  const scrollTrackSx = useMemo(() => ({
    display: 'flex',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: mobile ? 0.5 : (dense ? 0.25 : 0.5),
    overflowX: 'auto',
    overflowY: 'hidden',
    touchAction: 'pan-x',
    overscrollBehaviorX: 'contain',
    WebkitOverflowScrolling: 'touch',
    cursor: enableDragScroll ? (isDragging ? 'grabbing' : 'grab') : 'auto',
    userSelect: enableDragScroll ? 'none' : 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    minHeight: size + 4,
    '&::-webkit-scrollbar': { display: 'none' },
  }), [dense, enableDragScroll, isDragging, mobile, size]);

  const completedScrollTrackSx = useMemo(() => ({
    ...scrollTrackSx,
    cursor: enableDragScroll
      ? (completedDrag.isDragging ? 'grabbing' : 'grab')
      : 'auto',
  }), [scrollTrackSx, enableDragScroll, completedDrag.isDragging]);

  if (variant !== 'iconsRow') return null;

  if (!hasPending && !hasCompleted) {
    if (rutinasLoading || habitsLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 36 }}>
          <CircularProgress size={18} aria-label="Cargando hábitos" />
        </Box>
      );
    }

    if (rutinasError) {
      return <HabitCarouselEmptyState variant="error" mode={mode} />;
    }

    if (!hasConfiguredHabits) {
      return (
        <HabitCarouselEmptyState
          variant="noHabits"
          mode={mode}
          onConfigure={handleConfigure}
        />
      );
    }

    return <HabitCarouselEmptyState variant="allDone" mode={mode} />;
  }

  const iconDense = dense && !mobile;

  const renderIconsRow = (items, { keySuffix, completionState, rowInteractive, rowOnToggle } = {}) => (
    <AnimatePresence mode="popLayout">
      {items.map((entry, index) => renderCarouselIcon({
        entry,
        index,
        sectionIconsMap,
        rutinaHoy,
        habitsPreferences,
        currentTimeOfDay,
        mode,
        dense: iconDense,
        interactive: rowInteractive ?? interactive,
        showCompletionState: completionState ?? showCompletionState,
        bg,
        hoverBg,
        rail,
        size,
        iconFontSize,
        onToggle: rowOnToggle ?? onToggle,
        keySuffix,
      }))}
    </AnimatePresence>
  );

  return (
    <Box
      role="region"
      aria-label={slotCopy.regionAriaLabel}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        width: '100%',
        pt: dense ? 0.25 : 0.5,
        pb: dense ? 0.25 : 0,
        ...(showDividers && {
          borderTop: '1px solid',
          borderColor: dividerColor,
        }),
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          minWidth: 0,
          pr: showToggle ? 4.5 : 0,
        }}
      >
        {hasPending ? (
          <HabitCarouselScrollTrack
            itemCount={pendingItems.length}
            fadeColor={fadeColor}
            theme={theme}
            scrollTrackSx={scrollTrackSx}
            enableDragScroll={enableDragScroll}
            centerWhenFits
            bind={bind}
            mergeScrollRef={(node) => {
              scrollRef.current = node;
              carouselRef.current = node;
            }}
          >
            {renderIconsRow(pendingItems)}
          </HabitCarouselScrollTrack>
        ) : (
          <Box
            sx={{
              width: '100%',
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: size + 4,
              px: 0.5,
              color: 'text.secondary',
              typography: 'caption',
            }}
          >
            Todo al día
          </Box>
        )}

        {showToggle && (
          <Tooltip title={showCompletedPanel ? 'Ocultar completados hoy' : 'Ver completados hoy'}>
            <IconButton
              size="small"
              onClick={() => setShowCompletedPanel((open) => !open)}
              aria-expanded={showCompletedPanel}
              aria-label={showCompletedPanel ? 'Ocultar hábitos completados hoy' : 'Mostrar hábitos completados hoy'}
              sx={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                ...carouselActionIconSx(theme, { active: showCompletedPanel }),
              }}
            >
              {showCompletedPanel ? (
                <UnfoldLessIcon sx={{ fontSize: '1.1rem' }} />
              ) : (
                <UnfoldMoreIcon sx={{ fontSize: '1.1rem' }} />
              )}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Collapse in={showCompletedPanel && hasCompleted} unmountOnExit>
        <Box
          sx={{
            position: 'relative',
            borderTop: `1px solid ${rail}`,
            pt: 0.5,
            pb: 0.25,
            pr: 4.5,
          }}
        >
          <HabitCarouselScrollTrack
            itemCount={completedTodayItems.length}
            observeKey={showCompletedPanel ? 'open' : 'closed'}
            fadeColor={fadeColor}
            theme={theme}
            scrollTrackSx={completedScrollTrackSx}
            enableDragScroll={enableDragScroll}
            centerWhenFits
            bind={completedDrag.bind}
            mergeScrollRef={(node) => {
              completedDrag.scrollRef.current = node;
            }}
          >
            {renderIconsRow(completedTodayItems, {
              keySuffix: 'done',
              completionState: true,
              rowOnToggle: handleCompletedToggle,
            })}
          </HabitCarouselScrollTrack>
          <Tooltip title="Ir a Rutinas">
            <IconButton
              size="small"
              onClick={() => navigate('/rutinas')}
              aria-label="Ir a Rutinas"
              sx={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                ...carouselActionIconSx(theme),
              }}
            >
              <TuneOutlined sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Collapse>
    </Box>
  );
}

export default memo(HabitCarouselIconRow);
