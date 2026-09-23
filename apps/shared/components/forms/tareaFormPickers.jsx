import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, Popover, TextField, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { taskFormPickerPopoverPaperSx } from './tareaFormTokens';

const MOBILE_CLOCK_SIZE = 180;
const MOBILE_NUMBER_SIZE = 24;
const MOBILE_INNER_NUMBER_SIZE = 20;
const MOBILE_INNER_RADIUS_RATIO = 0.58;

function clockRadii(size) {
  const outerRadius = (size - MOBILE_NUMBER_SIZE) / 2 - 2;
  const innerRadius = outerRadius * MOBILE_INNER_RADIUS_RATIO;
  return { outerRadius, innerRadius };
}

const inlinePickerBoxSx = {
  '& .MuiPickersPopper-root': {
    position: 'relative !important',
    transform: 'none !important',
    top: 'auto !important',
    left: 'auto !important',
    right: 'auto !important',
    bottom: 'auto !important',
  },
  '& .MuiPaper-root': {
    boxShadow: 'none',
    backgroundImage: 'none',
  },
};

const hiddenPickerInputSx = {
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: 1,
  p: 0,
  m: 0,
  border: 0,
};

function CenteredPickerLayer({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <Box
      onMouseDown={onClose}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: (t) => t.zIndex.modal + 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 1.5,
      }}
    >
      <Box
        onMouseDown={(event) => event.stopPropagation()}
        sx={{
          ...taskFormPickerPopoverPaperSx,
          maxWidth: 'calc(100vw - 24px)',
        }}
      >
        {children}
      </Box>
    </Box>,
    document.body,
  );
}

export function PickerPopover({
  open,
  anchorEl,
  onClose,
  children,
  mobileCenter = false,
  disablePortal = true,
  zIndex,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const centered = mobileCenter && isMobile;

  if (centered) {
    return (
      <CenteredPickerLayer open={open} onClose={onClose}>
        {children}
      </CenteredPickerLayer>
    );
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      disablePortal={disablePortal}
      disableScrollLock
      marginThreshold={12}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      PaperProps={{ sx: taskFormPickerPopoverPaperSx }}
      sx={zIndex != null ? { zIndex } : undefined}
    >
      {children}
    </Popover>
  );
}

export function PopoverInlineDatePicker({ value, onChange }) {
  return (
    <Box sx={inlinePickerBoxSx}>
      <DatePicker
        value={value}
        onChange={onChange}
        views={['year', 'month', 'day']}
        openTo="day"
        open
        renderInput={(params) => (
          <TextField {...params} sx={hiddenPickerInputSx} tabIndex={-1} aria-hidden />
        )}
        PopperProps={{ disablePortal: true }}
        componentsProps={{ actionBar: { actions: [] } }}
      />
    </Box>
  );
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ringPosition(index, radius) {
  const angle = ((index % 12) / 12) * Math.PI * 2 - Math.PI / 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function readClockValue(clientX, clientY, rect, view, minutesStep) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const x = clientX - cx;
  const y = clientY - cy;
  const distance = Math.hypot(x, y);
  let deg = Math.atan2(x, -y) * (180 / Math.PI);
  if (deg < 0) deg += 360;

  if (view === 'minutes') {
    const snapped = Math.round(deg / (6 * minutesStep)) * minutesStep;
    return snapped % 60;
  }

  const hourOnRing = Math.round(deg / 30) % 12;
  const { outerRadius, innerRadius } = clockRadii(rect.width);
  const inner = distance < (outerRadius + innerRadius) / 2;
  if (inner) return hourOnRing === 0 ? 0 : hourOnRing + 12;
  return hourOnRing === 0 ? 12 : hourOnRing;
}

function CompactTimePicker({ value, onChange, minutesStep = 5 }) {
  const faceRef = useRef(null);
  const draggingRef = useRef(false);
  const [view, setView] = useState('hours');
  const base = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
  const hours = base.getHours();
  const minutes = base.getMinutes();
  const selected = view === 'hours' ? hours : minutes;
  const { outerRadius, innerRadius } = clockRadii(MOBILE_CLOCK_SIZE);
  const isInnerHour = view === 'hours' && (selected === 0 || selected > 12);
  const handLength = (isInnerHour ? innerRadius : outerRadius) - MOBILE_NUMBER_SIZE / 2 + 2;
  const handAngle = view === 'minutes'
    ? (selected / 60) * 360
    : ((selected % 12) / 12) * 360;

  const commit = (nextHours, nextMinutes, finishHours) => {
    const next = new Date(base);
    next.setHours(nextHours, nextMinutes, 0, 0);
    onChange(next);
    if (finishHours) setView('minutes');
  };

  const applyPointer = (event, finish) => {
    const rect = faceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextValue = readClockValue(event.clientX, event.clientY, rect, view, minutesStep);
    if (view === 'hours') commit(nextValue, minutes, finish);
    else commit(hours, nextValue, false);
  };

  const numbers = view === 'hours'
    ? Array.from({ length: 24 }, (_, hour) => {
      const inner = hour === 0 || hour > 12;
      return {
        key: hour,
        value: hour,
        label: hour === 0 ? '00' : String(hour),
        inner,
        pos: ringPosition(hour, inner ? innerRadius : outerRadius),
      };
    })
    : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((minute, index) => ({
      key: minute,
      value: minute,
      label: pad2(minute),
      inner: false,
      pos: ringPosition(index + 1, outerRadius),
    }));

  const timeButtonSx = (active) => ({
    border: 0,
    background: 'none',
    p: 0,
    m: 0,
    cursor: 'pointer',
    font: 'inherit',
    fontSize: '1.25rem',
    lineHeight: 1,
    fontWeight: 500,
    color: active ? 'text.primary' : 'text.secondary',
    fontVariantNumeric: 'tabular-nums',
  });

  return (
    <Box
      sx={{
        width: MOBILE_CLOCK_SIZE + 24,
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: 1.5,
        pt: 1.25,
        pb: 1.5,
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <Box
          component="button"
          type="button"
          aria-label="Horas"
          aria-pressed={view === 'hours'}
          onClick={() => setView('hours')}
          sx={timeButtonSx(view === 'hours')}
        >
          {pad2(hours)}
        </Box>
        <Box component="span" sx={{ color: 'text.secondary', fontSize: '1.25rem', lineHeight: 1 }}>
          :
        </Box>
        <Box
          component="button"
          type="button"
          aria-label="Minutos"
          aria-pressed={view === 'minutes'}
          onClick={() => setView('minutes')}
          sx={timeButtonSx(view === 'minutes')}
        >
          {pad2(minutes)}
        </Box>
      </Box>

      <Box
        ref={faceRef}
        role="listbox"
        aria-label={view === 'hours' ? 'Elegir hora' : 'Elegir minutos'}
        onPointerDown={(event) => {
          draggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          applyPointer(event, false);
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current) return;
          applyPointer(event, false);
        }}
        onPointerUp={(event) => {
          if (!draggingRef.current) return;
          draggingRef.current = false;
          applyPointer(event, true);
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        sx={{
          width: MOBILE_CLOCK_SIZE,
          height: MOBILE_CLOCK_SIZE,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.06)',
          position: 'relative',
          touchAction: 'none',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            bottom: '50%',
            width: 2,
            height: Math.max(handLength, 0),
            bgcolor: 'primary.main',
            transformOrigin: 'center bottom',
            transform: `rotate(${handAngle}deg) translateX(-50%)`,
            pointerEvents: 'none',
            borderRadius: 1,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
        {numbers.map((item) => {
          const isSelected = item.value === selected && (view === 'minutes' ? selected % minutesStep === 0 : true);
          return (
            <Box
              key={item.key}
              role="option"
              aria-selected={isSelected}
              sx={{
                position: 'absolute',
                left: MOBILE_CLOCK_SIZE / 2 + item.pos.x,
                top: MOBILE_CLOCK_SIZE / 2 + item.pos.y,
                width: item.inner ? MOBILE_INNER_NUMBER_SIZE : MOBILE_NUMBER_SIZE,
                height: item.inner ? MOBILE_INNER_NUMBER_SIZE : MOBILE_NUMBER_SIZE,
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                fontSize: item.inner ? '0.65rem' : '0.75rem',
                lineHeight: 1,
                color: isSelected ? 'primary.contrastText' : 'text.primary',
                bgcolor: isSelected ? 'primary.main' : 'transparent',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              {item.label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export function PopoverInlineTimePicker({ value, onChange }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });

  if (isMobile) {
    return (
      <CompactTimePicker
        value={value}
        onChange={onChange}
        minutesStep={5}
      />
    );
  }

  return (
    <Box sx={inlinePickerBoxSx}>
      <TimePicker
        value={value}
        onChange={onChange}
        ampm={false}
        minutesStep={5}
        views={['hours', 'minutes']}
        open
        renderInput={(params) => (
          <TextField {...params} sx={hiddenPickerInputSx} tabIndex={-1} aria-hidden />
        )}
        PopperProps={{ disablePortal: true }}
        componentsProps={{ actionBar: { actions: [] } }}
      />
    </Box>
  );
}
