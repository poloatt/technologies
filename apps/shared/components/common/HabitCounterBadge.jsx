import React, { useMemo } from 'react';
import { Badge, Box } from '@mui/material';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import WbTwilightIcon from '@mui/icons-material/WbTwilight';
import WbTwilightOutlinedIcon from '@mui/icons-material/WbTwilightOutlined';
import NightlightIcon from '@mui/icons-material/Nightlight';
import NightlightOutlinedIcon from '@mui/icons-material/NightlightOutlined';
import { contarCompletadosEnPeriodo, isFlexiblePeriodic } from '@shared/habits';
import {
  isHabitCompletedForHistorial,
  isHabitHorarioCompleted,
  isHabitFullyCompletedToday,
  resolveCompletedDailyFranjas,
} from '@shared/habits';
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

/** Reserva mínima bajo el icono cuando hay overlay de franja (flow legacy / reserveBadgeSpace). */
export const HABIT_FRANJA_STRIP_HEIGHT = {
  small: 6,
  medium: 8,
};

function resolvePendingDailyHorario({
  horarios,
  currentTimeOfDay,
  displayHorario,
  itemValue,
  frecuencia,
}) {
  const normalizedHorarios = horarios.map((h) => String(h).toUpperCase());
  const normalizedTimeOfDay = String(currentTimeOfDay).toUpperCase();
  const isHorarioCompleted = (horario) => isHabitHorarioCompleted(itemValue, horario);

  let horarioAMostrar = displayHorario ? String(displayHorario).toUpperCase() : null;

  if (!horarioAMostrar) {
    if (normalizedHorarios.includes(normalizedTimeOfDay)) {
      if (!isHorarioCompleted(normalizedTimeOfDay)) {
        horarioAMostrar = normalizedTimeOfDay;
      }
    } else if (frecuencia > 1 || normalizedHorarios.length > 1) {
      const currentIndex = VALID_TIME_OF_DAY.indexOf(normalizedTimeOfDay);
      for (let i = currentIndex - 1; i >= 0; i -= 1) {
        const horarioAnterior = VALID_TIME_OF_DAY[i];
        if (normalizedHorarios.includes(horarioAnterior) && !isHorarioCompleted(horarioAnterior)) {
          horarioAMostrar = horarioAnterior;
          break;
        }
      }
    }
  }

  if (horarioAMostrar && VALID_TIME_OF_DAY.includes(horarioAMostrar)) {
    return horarioAMostrar;
  }

  return null;
}

function resolveFranjaBadgePlan({
  tipo,
  periodo,
  horarios,
  frecuencia,
  currentTimeOfDay,
  displayHorario,
  itemValue,
  normalizedCompletedHorarios,
  config,
}) {
  const isDaily = tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && periodo === 'CADA_DIA');
  const normalizedHorarios = horarios.map((h) => String(h).toUpperCase());
  const explicitHorario = displayHorario ? String(displayHorario).toUpperCase() : null;

  if (isDaily && normalizedHorarios.length > 0) {
    if (isHabitFullyCompletedToday(itemValue, normalizedHorarios)) {
      return { show: false, mode: null, horariosInSlots: [] };
    }

    if (explicitHorario && VALID_TIME_OF_DAY.includes(explicitHorario)) {
      return { show: true, mode: 'single', horariosInSlots: [explicitHorario] };
    }
  }

  if (!isDaily || horarios.length === 0) {
    if (explicitHorario && VALID_TIME_OF_DAY.includes(explicitHorario)) {
      return { show: true, mode: 'single', horariosInSlots: [explicitHorario] };
    }
    return { show: false, mode: null, horariosInSlots: [] };
  }

  if (normalizedCompletedHorarios.length > 0) {
    return {
      show: true,
      mode: normalizedCompletedHorarios.length >= 2 ? 'multi' : 'single',
      horariosInSlots: normalizedCompletedHorarios,
    };
  }

  const completed = resolveCompletedDailyFranjas(itemValue, config);
  if (completed.length >= 2) {
    return { show: true, mode: 'multi', horariosInSlots: completed };
  }
  if (completed.length === 1) {
    return { show: true, mode: 'single', horariosInSlots: completed };
  }

  const pendingHorario = resolvePendingDailyHorario({
    horarios: normalizedHorarios,
    currentTimeOfDay,
    displayHorario,
    itemValue,
    frecuencia,
  });

  if (pendingHorario) {
    return { show: true, mode: 'single', horariosInSlots: [pendingHorario] };
  }

  return { show: false, mode: null, horariosInSlots: [] };
}

function FranjaBadgeOverlay({
  mode,
  horariosInSlots,
  outline,
  size,
  color,
  opacity,
  visible,
}) {
  const franjaIconFont = size === 'small' ? '0.65rem' : '0.75rem';

  if (!visible) return null;

  if (mode === 'single') {
    const horario = horariosInSlots[0];
    const IconComp = horario ? resolveFranjaIcon(horario, { outline }) : null;
    if (!IconComp) return null;

    return (
      <Box
        component="span"
        aria-hidden
        sx={{
          position: 'absolute',
          bottom: '12%',
          right: '10%',
          pointerEvents: 'none',
          lineHeight: 0,
          color,
          opacity,
          zIndex: 1,
        }}
      >
        <IconComp sx={{ fontSize: franjaIconFont }} />
      </Box>
    );
  }

  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        position: 'absolute',
        bottom: '6%',
        left: '0%',
        right: '0%',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        alignItems: 'center',
        pointerEvents: 'none',
        lineHeight: 0,
        color,
        opacity,
        zIndex: 1,
      }}
    >
      {VALID_TIME_OF_DAY.map((horario, idx) => {
        const IconComp = horariosInSlots.includes(horario)
          ? resolveFranjaIcon(horario, { outline })
          : null;

        return (
          <Box
            key={horario}
            component="span"
            sx={{
              display: 'flex',
              justifyContent: idx === 0 ? 'flex-start' : idx === 1 ? 'center' : 'flex-end',
            }}
          >
            {IconComp ? <IconComp sx={{ fontSize: franjaIconFont }} /> : null}
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Badge de frecuencia (cuota N del período) o icono de franja.
 * Franjas diarias:
 * - Pendiente o una sola franja hecha → insignia a la derecha, sobre el icono.
 * - Varias franjas hechas (cuota parcial) → MAÑANA izq, TARDE centro, NOCHE der.
 * - Cuota cubierta → sin insignias (solo icono filled).
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
  /** Franjas ya completadas — insignias en sus slots (Hecho histórico multi-franja). */
  completedHorarios = null,
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

  const normalizedCompletedHorarios = Array.isArray(completedHorarios)
    ? completedHorarios
      .map((horario) => String(horario).toUpperCase())
      .filter((horario) => VALID_TIME_OF_DAY.includes(horario))
    : [];

  const itemValue = rutina?.[section]?.[itemId];

  let showFranjaOverlay = false;
  let franjaLayoutMode = null;
  let horariosInSlots = [];
  let isNumber = false;
  let quotaBadgeContent = null;

  if (isPeriodicMulti) {
    quotaBadgeContent = resolvePeriodicQuotaBadge();
    isNumber = true;
  } else {
    const plan = resolveFranjaBadgePlan({
      tipo,
      periodo,
      horarios,
      frecuencia,
      currentTimeOfDay,
      displayHorario,
      itemValue,
      normalizedCompletedHorarios,
      config,
    });
    showFranjaOverlay = plan.show;
    franjaLayoutMode = plan.mode;
    horariosInSlots = plan.horariosInSlots;
  }

  const showBadge = isNumber || showFranjaOverlay;

  if (!showBadge && !reserveBadgeSpace) {
    return <>{children}</>;
  }

  if (isNumber) {
    const badgeVisible = showBadge;
    const renderedBadgeContent = badgeVisible ? quotaBadgeContent : '\u00a0';

    const getTransform = () => {
      if (overlap === 'subtle') {
        return size === 'medium'
          ? 'translate(8%, 8%) scale(1)'
          : 'translate(15%, 15%) scale(1)';
      }
      return 'translate(25%, 25%) scale(1)';
    };

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
            fontWeight: 600,
            padding: size === 'small' ? '1px 3px' : '2px 4px',
            bgcolor: 'transparent',
            color: badgeChrome.colorToken,
            opacity: badgeChrome.opacity,
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
          },
        }}
      >
        {children}
      </Badge>
    );
  }

  const franjaDone = horariosInSlots.some(
    (horario) => isHabitHorarioCompleted(itemValue, horario),
  );
  const overlayColor = franjaDone ? 'primary.main' : badgeChrome.colorToken;
  const overlayOpacity = badgeChrome.opacity;
  const overlayOutline = franjaDone ? true : badgeChrome.outline;
  const overlayVisible = showFranjaOverlay;

  const stripHeight = HABIT_FRANJA_STRIP_HEIGHT[size] || HABIT_FRANJA_STRIP_HEIGHT.small;

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'inline-flex',
        verticalAlign: 'middle',
        ...(reserveBadgeSpace && !overlayVisible && {
          pb: `${stripHeight}px`,
        }),
      }}
    >
      {children}
      {(overlayVisible || reserveBadgeSpace) && (
        <FranjaBadgeOverlay
          mode={franjaLayoutMode}
          horariosInSlots={horariosInSlots}
          outline={overlayOutline}
          size={size}
          color={overlayColor}
          opacity={overlayVisible ? overlayOpacity : 0}
          visible={overlayVisible}
        />
      )}
    </Box>
  );
};

export default HabitCounterBadge;
