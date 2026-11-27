import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { getDay, getDate, isSameDay } from 'date-fns';
import {
  DIAS_SEMANA,
  obtenerHistorialCompletados,
  getScheduledDatesInPeriod,
  isFlexiblePeriodic,
  getFrecuenciaLabel,
  resolveHabitCompletadosEnPeriodo,
  isHabitHorarioCompleted,
  resolveCompletedDailyFranjas,
} from '@shared/habits';
import { getNormalizedToday, parseAPIDate } from '@shared/utils/dateUtils';
import { VALID_TIME_OF_DAY } from '@shared/utils/timeOfDayUtils';
import { FONT_SIZE } from '../../tipografia';

const WEEKDAY_ORDER = [...DIAS_SEMANA.slice(1), DIAS_SEMANA[0]];
const DIA_LETRA = { 0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' };

const FRANJA_SHORT = {
  MAÑANA: 'Mañ',
  TARDE: 'Tar',
  NOCHE: 'Noc',
};

function cellSx(theme, {
  active = false,
  done = false,
  today = false,
  size = 22,
} = {}) {
  let bg = 'transparent';
  let color = theme.palette.text.disabled;
  let border = alpha(theme.palette.text.primary, 0.12);

  if (done) {
    bg = alpha(theme.palette.success.main, 0.18);
    color = theme.palette.success.dark || theme.palette.success.main;
    border = alpha(theme.palette.success.main, 0.45);
  } else if (active) {
    bg = alpha(theme.palette.primary.main, 0.12);
    color = theme.palette.text.primary;
    border = alpha(theme.palette.primary.main, 0.4);
  }

  return {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: '50%',
    border: `1.5px solid ${border}`,
    bgcolor: bg,
    color,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    typography: 'caption',
    fontWeight: active || done ? 700 : 500,
    fontSize: FONT_SIZE.xs,
    lineHeight: 1,
    boxSizing: 'border-box',
    outline: today ? `2px solid ${alpha(theme.palette.info.main, 0.55)}` : 'none',
    outlineOffset: 1,
  };
}

function pillSx(theme, { active = false, done = false } = {}) {
  let bg = alpha(theme.palette.text.primary, 0.04);
  let color = theme.palette.text.disabled;
  let border = alpha(theme.palette.text.primary, 0.12);

  if (done) {
    bg = alpha(theme.palette.success.main, 0.16);
    color = theme.palette.success.dark || theme.palette.success.main;
    border = alpha(theme.palette.success.main, 0.4);
  } else if (active) {
    bg = alpha(theme.palette.primary.main, 0.1);
    color = theme.palette.text.primary;
    border = alpha(theme.palette.primary.main, 0.35);
  }

  return {
    px: 0.75,
    py: 0.25,
    borderRadius: 1,
    border: `1px solid ${border}`,
    bgcolor: bg,
    color,
    typography: 'caption',
    fontWeight: active || done ? 600 : 500,
    fontSize: FONT_SIZE.xs,
    lineHeight: 1.2,
  };
}

function periodCounterLabel({ isDaily, horariosLen, completados, frecuencia }) {
  if (isDaily) {
    const target = horariosLen > 1 ? Math.max(frecuencia, horariosLen) : frecuencia;
    if (target <= 1) return null;
    return `${completados}/${target} hoy`;
  }
  if (frecuencia <= 1) return null;
  return `${completados}/${frecuencia}`;
}

/**
 * Grid compacto de cadencia/frecuencia + contadores (solo lectura).
 */
export default function HabitCadenceMiniGrid({
  config = {},
  rutina = null,
  section = null,
  itemId = null,
  itemValue = null,
}) {
  const theme = useTheme();
  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = (config?.periodo || 'CADA_DIA').toUpperCase();
  const frecuencia = Math.max(1, Number(config?.frecuencia || 1));
  const horarios = Array.isArray(config?.horarios)
    ? config.horarios.map((h) => String(h).toUpperCase())
    : [];
  const diasSemana = Array.isArray(config?.diasSemana) ? config.diasSemana : [];
  const diasMes = Array.isArray(config?.diasMes) ? config.diasMes : [];
  const isDaily = tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
  const isWeekly = tipo === 'SEMANAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_SEMANA');
  const isMonthly = tipo === 'MENSUAL' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_MES');
  const flexible = isFlexiblePeriodic(config);

  const today = useMemo(() => getNormalizedToday(), []);
  const referenceDate = useMemo(() => {
    if (rutina?.fecha) {
      const parsed = parseAPIDate(rutina.fecha);
      if (parsed) return parsed;
    }
    return today;
  }, [rutina?.fecha, today]);

  const historial = useMemo(() => {
    if (!rutina || !section || !itemId) return [];
    return obtenerHistorialCompletados(itemId, section, rutina);
  }, [rutina, section, itemId]);

  const isCompletedToday = useMemo(() => {
    if (itemValue === true) return true;
    if (typeof itemValue === 'object' && itemValue && !Array.isArray(itemValue)) {
      return Object.values(itemValue).some(Boolean);
    }
    return false;
  }, [itemValue]);

  const completadosPeriodo = useMemo(() => {
    if (isDaily && horarios.length > 0) {
      return resolveCompletedDailyFranjas(itemValue, config).length;
    }
    return resolveHabitCompletadosEnPeriodo({
      itemId,
      section,
      rutina,
      config,
      isCompleted: isCompletedToday,
    });
  }, [isDaily, horarios.length, itemValue, config, itemId, section, rutina, isCompletedToday]);

  const scheduledInPeriod = useMemo(() => {
    if (!isWeekly && !isMonthly) return [];
    if (flexible) return [];
    return getScheduledDatesInPeriod(referenceDate, config);
  }, [isWeekly, isMonthly, flexible, referenceDate, config]);

  const completedDayKeys = useMemo(() => {
    const keys = new Set();
    historial.forEach((date) => {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return;
      if (isWeekly) keys.add(getDay(date));
      if (isMonthly) keys.add(getDate(date));
    });
    if (isCompletedToday) {
      if (isWeekly) keys.add(getDay(referenceDate));
      if (isMonthly) keys.add(getDate(referenceDate));
    }
    return keys;
  }, [historial, isWeekly, isMonthly, isCompletedToday, referenceDate]);

  const cadenceSummary = getFrecuenciaLabel(config);
  const counterText = periodCounterLabel({
    isDaily,
    horariosLen: horarios.length,
    completados: completadosPeriodo,
    frecuencia,
  });

  const renderWeekdayGrid = () => {
    const selected = new Set(diasSemana);
    const showAll = selected.size === 0 || flexible;
    return (
      <Box sx={{ display: 'flex', gap: 0.4, justifyContent: 'center', flexWrap: 'nowrap' }}>
        {WEEKDAY_ORDER.map((dia) => {
          const active = showAll ? true : selected.has(dia.value);
          const done = active && completedDayKeys.has(dia.value);
          const isTodayCell = isSameDay(referenceDate, today) && getDay(referenceDate) === dia.value;
          return (
            <Box
              key={dia.value}
              component="span"
              aria-label={`${dia.label}${done ? ', completado' : active ? ', programado' : ''}`}
              sx={cellSx(theme, { active, done, today: active && isTodayCell })}
            >
              {DIA_LETRA[dia.value]}
            </Box>
          );
        })}
      </Box>
    );
  };

  const renderMonthDayGrid = () => {
    const days = diasMes.length > 0
      ? [...diasMes].sort((a, b) => a - b)
      : scheduledInPeriod.map((d) => getDate(d));
    const unique = [...new Set(days)].slice(0, 10);
    if (unique.length === 0) {
      return (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          {frecuencia}× al mes
        </Typography>
      );
    }
    return (
      <Box sx={{ display: 'flex', gap: 0.4, justifyContent: 'center', flexWrap: 'wrap' }}>
        {unique.map((dayNum) => {
          const done = completedDayKeys.has(dayNum);
          const isTodayCell = getDate(referenceDate) === dayNum;
          return (
            <Box
              key={dayNum}
              component="span"
              aria-label={`Día ${dayNum}${done ? ', completado' : ''}`}
              sx={cellSx(theme, { active: true, done, today: isTodayCell })}
            >
              {dayNum}
            </Box>
          );
        })}
      </Box>
    );
  };

  const renderFranjaGrid = () => {
    const slots = horarios.length > 0
      ? horarios
      : (frecuencia > 1 ? VALID_TIME_OF_DAY.slice(0, frecuencia) : []);
    if (slots.length === 0) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box component="span" sx={pillSx(theme, { active: true, done: isCompletedToday })}>
            Diario
          </Box>
        </Box>
      );
    }
    return (
      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
        {slots.map((horario) => {
          const done = isHabitHorarioCompleted(itemValue, horario);
          return (
            <Box
              key={horario}
              component="span"
              aria-label={`${horario}${done ? ', completado' : ''}`}
              sx={pillSx(theme, { active: true, done })}
            >
              {FRANJA_SHORT[horario] || horario}
            </Box>
          );
        })}
      </Box>
    );
  };

  const renderFlexibleQuota = () => (
    <Box sx={{ display: 'flex', gap: 0.4, justifyContent: 'center', flexWrap: 'wrap' }}>
      {Array.from({ length: frecuencia }, (_, index) => {
        const done = index < completadosPeriodo;
        return (
          <Box
            key={`quota-${index}`}
            component="span"
            aria-label={`Cuota ${index + 1}${done ? ', completada' : ''}`}
            sx={cellSx(theme, { active: true, done, size: 18 })}
          >
            {index + 1}
          </Box>
        );
      })}
    </Box>
  );

  let grid = null;
  if (isWeekly && flexible) {
    grid = renderFlexibleQuota();
  } else if (isWeekly) {
    grid = renderWeekdayGrid();
  } else if (isMonthly) {
    grid = flexible || diasMes.length === 0 ? renderFlexibleQuota() : renderMonthDayGrid();
  } else if (isDaily) {
    grid = renderFranjaGrid();
  } else {
    grid = renderFlexibleQuota();
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        width: '100%',
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 600, letterSpacing: 0.2, textAlign: 'center' }}
      >
        {cadenceSummary}
      </Typography>
      {grid}
      {counterText ? (
        <Typography
          variant="caption"
          sx={{
            color: completadosPeriodo >= frecuencia ? 'success.main' : 'text.secondary',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {counterText}
        </Typography>
      ) : null}
    </Box>
  );
}
