import React, { useMemo } from 'react';
import { Badge } from '@mui/material';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import WbTwilightIcon from '@mui/icons-material/WbTwilight';
import WbTwilightOutlinedIcon from '@mui/icons-material/WbTwilightOutlined';
import NightlightIcon from '@mui/icons-material/Nightlight';
import NightlightOutlinedIcon from '@mui/icons-material/NightlightOutlined';
import { contarCompletadosEnPeriodo, isFlexiblePeriodic } from '@shared/habits';
import { isHabitCompletedForHistorial, isHabitHorarioCompleted } from '@shared/habits';
import { resolveHabitBadgeChrome } from '@shared/habits/presentation';
import { VALID_TIME_OF_DAY } from '@shared/utils/timeOfDayUtils';
import { getNormalizedToday, parseAPIDate, toISODateString } from '@shared/utils/dateUtils';

const FRANJA_ICONS = {
  MAÑANA: { filled: WbSunnyIcon, outlined: WbSunnyOutlinedIcon },
  TARDE: { filled: WbTwilightIcon, outlined: WbTwilightOutlinedIcon },
  NOCHE: { filled: NightlightIcon, outlined: NightlightOutlinedIcon },
};

function resolveFranjaIcon(horario, { outline = true } = {}) {
  const pair = FRANJA_ICONS[horario];
  if (!pair) return null;
  return outline ? pair.outlined : pair.filled;
}

/**
 * Badge de frecuencia (cuota N del período) o icono de franja.
 * Color / outline siguen la presentación canónica del icono padre.
 */
export const HabitCounterBadge = ({
  config = {},
  currentTimeOfDay = 'MAÑANA',
  displayHorario = null,
  size = 'small',
  overlap = 'rectangular',
  rutina = null,
  section = null,
  itemId = null,
  reserveBadgeSpace = false,
  isCompleted = false,
  quotaSlot = null,
  /** Presentación canónica del icono (outline / variant / doneTone). */
  iconPresentation = null,
  children,
}) => {
  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const frecuencia = Number(config?.frecuencia || 1);
  const horarios = Array.isArray(config?.horarios) ? config.horarios : [];
  const periodo = config?.periodo ? config.periodo.toUpperCase() : null;

  const badgeChrome = resolveHabitBadgeChrome(
    iconPresentation || {
      variant: isCompleted ? 'completedToday' : 'activePending',
      outline: !isCompleted,
    },
  );

  const completadosEnPeriodo = useMemo(() => {
    if (!rutina || !section || !itemId) return null;

    if (tipo !== 'SEMANAL' && tipo !== 'MENSUAL'
        && !(tipo === 'PERSONALIZADO' && periodo && periodo !== 'CADA_DIA')) {
      return null;
    }

    try {
      const historialSection = rutina?.historial?.[section];

      let historialCompletado = [];
      if (historialSection && historialSection[itemId]) {
        const historialItem = historialSection[itemId];
        if (typeof historialItem === 'object' && !Array.isArray(historialItem)) {
          historialCompletado = Object.keys(historialItem)
            .filter((fecha) => historialItem[fecha] === true)
            .map((fecha) => {
              const [year, month, day] = fecha.split('-').map(Number);
              return new Date(year, month - 1, day, 12, 0, 0, 0);
            });
        } else if (Array.isArray(historialItem)) {
          historialCompletado = historialItem.map((fecha) => parseAPIDate(fecha) || new Date(fecha));
        }
      }

      const hoy = rutina?.fecha ? (parseAPIDate(rutina.fecha) || getNormalizedToday()) : getNormalizedToday();
      let completados = contarCompletadosEnPeriodo(hoy, tipo, periodo || 'CADA_DIA', historialCompletado);

      const completadoHoy = isHabitCompletedForHistorial(rutina?.[section]?.[itemId]);
      if (completadoHoy) {
        const hoyStr = toISODateString(hoy);
        const yaEstaEnHistorial = historialCompletado.some((fecha) => toISODateString(fecha) === hoyStr);
        if (!yaEstaEnHistorial) {
          completados++;
        }
      }

      return completados;
    } catch (error) {
      console.error('[HabitCounterBadge] Error calculando completados en período:', error);
      return null;
    }
  }, [rutina, section, itemId, tipo, periodo]);

  const flexiblePeriodic = isFlexiblePeriodic(config);
  const isPeriodicMulti = frecuencia > 1 && (
    flexiblePeriodic
    || tipo === 'SEMANAL'
    || tipo === 'MENSUAL'
    || (tipo === 'PERSONALIZADO' && periodo && periodo !== 'CADA_DIA')
  );

  const resolvePeriodicQuotaBadge = () => {
    if (quotaSlot != null && Number.isFinite(Number(quotaSlot))) {
      return Math.max(1, Math.min(Number(quotaSlot), frecuencia));
    }
    const done = completadosEnPeriodo !== null ? completadosEnPeriodo : 0;
    if (isCompleted || done >= frecuencia) {
      return Math.max(1, Math.min(done || frecuencia, frecuencia));
    }
    return Math.min(done + 1, frecuencia);
  };

  const franjaIconFont = size === 'small' ? '0.75rem' : '0.875rem';
  const renderFranjaIcon = (horario) => {
    const IconComp = resolveFranjaIcon(horario, { outline: badgeChrome.outline });
    if (!IconComp) return null;
    return <IconComp sx={{ fontSize: franjaIconFont }} />;
  };

  let badgeContent = null;
  let showBadge = false;
  let isNumber = false;
  let resolvedHorario = null;

  if (isPeriodicMulti) {
    badgeContent = resolvePeriodicQuotaBadge();
    showBadge = true;
    isNumber = true;
  } else if (tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && config?.periodo === 'CADA_DIA')) {
    if (horarios.length > 0) {
      const normalizedHorarios = horarios.map((h) => String(h).toUpperCase());
      const normalizedTimeOfDay = String(currentTimeOfDay).toUpperCase();
      const itemValue = rutina?.[section]?.[itemId];
      const isHorarioCompleted = (horario) => isHabitHorarioCompleted(itemValue, horario);
      const HORARIOS_ORDER = VALID_TIME_OF_DAY;

      let horarioAMostrar = displayHorario ? String(displayHorario).toUpperCase() : null;

      if (!horarioAMostrar) {
        if (normalizedHorarios.includes(normalizedTimeOfDay)) {
          if (!isHorarioCompleted(normalizedTimeOfDay)) {
            horarioAMostrar = normalizedTimeOfDay;
          }
        } else if (frecuencia > 1 || normalizedHorarios.length > 1) {
          const currentIndex = HORARIOS_ORDER.indexOf(normalizedTimeOfDay);
          for (let i = currentIndex - 1; i >= 0; i -= 1) {
            const horarioAnterior = HORARIOS_ORDER[i];
            if (normalizedHorarios.includes(horarioAnterior) && !isHorarioCompleted(horarioAnterior)) {
              horarioAMostrar = horarioAnterior;
              break;
            }
          }
        }
      }

      if (horarioAMostrar) {
        resolvedHorario = horarioAMostrar;
        badgeContent = renderFranjaIcon(horarioAMostrar);
        showBadge = Boolean(badgeContent);
        isNumber = false;
      }
    } else {
      const horarioAMostrar = displayHorario ? String(displayHorario).toUpperCase() : null;
      if (horarioAMostrar && VALID_TIME_OF_DAY.includes(horarioAMostrar)) {
        resolvedHorario = horarioAMostrar;
        badgeContent = renderFranjaIcon(horarioAMostrar);
        showBadge = Boolean(badgeContent);
        isNumber = false;
      }
    }
  }

  if (!showBadge && !reserveBadgeSpace) {
    return <>{children}</>;
  }

  const badgeVisible = showBadge;
  const renderedBadgeContent = badgeVisible ? badgeContent : '\u00a0';

  const getTransform = () => {
    if (overlap === 'subtle') {
      return size === 'medium'
        ? 'translate(8%, 8%) scale(1)'
        : 'translate(15%, 15%) scale(1)';
    }
    return 'translate(25%, 25%) scale(1)';
  };

  // Franja completada en un slot concreto: filled + primary, sin romper el resto del chrome.
  const itemValue = rutina?.[section]?.[itemId];
  const franjaDone = Boolean(
    resolvedHorario && isHabitHorarioCompleted(itemValue, resolvedHorario),
  );
  const badgeColor = (!isNumber && franjaDone)
    ? 'primary.main'
    : badgeChrome.colorToken;
  const badgeOpacity = (!isNumber && franjaDone)
    ? 1
    : badgeChrome.opacity;

  return (
    <Badge
      badgeContent={renderedBadgeContent}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      overlap={overlap === 'circular' ? 'circular' : 'rectangular'}
      sx={{
        position: 'relative',
        display: 'inline-flex',
        '& .MuiBadge-badge': {
          minWidth: size === 'small' ? 12 : 14,
          height: size === 'small' ? 12 : 14,
          fontSize: size === 'small' ? '0.6rem' : '0.65rem',
          fontWeight: isNumber ? 600 : 400,
          padding: size === 'small' ? '1px 3px' : '2px 4px',
          bgcolor: 'transparent',
          color: badgeColor,
          opacity: badgeOpacity,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: getTransform(),
          zIndex: 1,
          ...(!badgeVisible && {
            opacity: 0,
            visibility: 'hidden',
          }),
          '& svg': {
            fontSize: size === 'small' ? '0.65rem' : '0.7rem',
            color: 'inherit',
            opacity: 1,
          },
        },
      }}
    >
      {children}
    </Badge>
  );
};

export default HabitCounterBadge;
