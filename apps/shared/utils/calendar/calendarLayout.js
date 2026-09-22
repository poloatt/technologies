export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 23;
export const SLOT_MINUTES = 30;
/** Snap de arrastre estilo Google Calendar (15 min). */
export const DRAG_SNAP_MINUTES = 15;
export const SLOTS_PER_HOUR = 2;
/** Altura de cada media hora (≈ Google Calendar densito). */
export const HALF_SLOT_HEIGHT_PX = 28;
/** Altura de una hora completa (etiquetas + franjas). */
export const SLOT_HEIGHT_PX = HALF_SLOT_HEIGHT_PX * SLOTS_PER_HOUR;
export const DEFAULT_DURATION_MINUTES = 30;
/** Chip TAREA = media hora de grilla (30 min / duración desconocida). */
export const TASK_PILL_HEIGHT_PX = HALF_SLOT_HEIGHT_PX;
/** EVENTO: altura mínima ≈ media hora. */
export const MIN_EVENT_HEIGHT_PX = HALF_SLOT_HEIGHT_PX;
export const ALL_DAY_ROW_MIN_HEIGHT = 18;
/** Máximo de chips “todo el día” visibles antes de “+N más”. */
export const ALL_DAY_MAX_VISIBLE = 3;
/** Máximo de bloques con hora visibles por día. */
export const MAX_TIMED_EVENTS_VISIBLE = 16;
export const TIME_COLUMN_WIDTH = 56;

/** Fixed chrome heights so day ↔ week toggles do not shift the time grid. */
export const DATE_HEADER_MIN_HEIGHT = 72;
export const CONTEXT_BAR_MIN_HEIGHT = 52;

export const calendarGridColumns = (dayCount = 7) =>
  `${TIME_COLUMN_WIDTH}px repeat(${dayCount}, 1fr)`;

export const calendarContextBarSx = {
  flexShrink: 0,
  borderBottom: 1,
  borderColor: 'divider',
  bgcolor: 'background.default',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: CONTEXT_BAR_MIN_HEIGHT,
  boxSizing: 'border-box',
  px: { xs: 0.5, sm: 1 },
  py: 0.5,
};

export const calendarScrollAreaSx = {
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
  '&::-webkit-scrollbar': { width: 6 },
  '&::-webkit-scrollbar-thumb': {
    bgcolor: 'action.disabled',
    borderRadius: 3,
  },
};

export const HOUR_LABELS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
  (_, i) => DAY_START_HOUR + i,
);

export const HALF_HOUR_SLOTS = Array.from(
  { length: (DAY_END_HOUR - DAY_START_HOUR + 1) * SLOTS_PER_HOUR },
  (_, i) => DAY_START_HOUR * 60 + i * SLOT_MINUTES,
);

export const getGridHeightPx = () =>
  (DAY_END_HOUR - DAY_START_HOUR + 1) * SLOT_HEIGHT_PX;

export const getTotalGridMinutes = () =>
  (DAY_END_HOUR - DAY_START_HOUR + 1) * 60;

/** Minutos desde medianoche → offset px desde el top de la grilla timed. */
export const startMinutesToTopPx = (minsFromMidnight) =>
  ((minsFromMidnight - DAY_START_HOUR * 60) / SLOT_MINUTES) * HALF_SLOT_HEIGHT_PX;

/** Duración en minutos → altura px (mínimo 1 snap de drag). */
export const durationMinutesToHeightPx = (durationMin) => {
  const mins = Math.max(DRAG_SNAP_MINUTES, durationMin || DEFAULT_DURATION_MINUTES);
  return (mins / SLOT_MINUTES) * HALF_SLOT_HEIGHT_PX;
};
