import React, { useMemo } from 'react';
import { Badge } from '@mui/material';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import WbTwilightIcon from '@mui/icons-material/WbTwilight';
import NightlightIcon from '@mui/icons-material/Nightlight';
import { contarCompletadosEnPeriodo, isFlexiblePeriodic } from '@shared/habits';
import { isHabitCompletedForHistorial, isHabitHorarioCompleted } from '@shared/habits';
import { VALID_TIME_OF_DAY } from '@shared/utils/timeOfDayUtils';
import { getNormalizedToday, parseAPIDate, toISODateString } from '@shared/utils/dateUtils';

/**
 * Componente Badge que muestra la frecuencia o el icono de horario de un hábito
 * 
 * @param {Object} props
 * @param {Object} props.config - Configuración del hábito (tipo, frecuencia, horarios)
 * @param {string} props.currentTimeOfDay - Horario actual ('MAÑANA', 'TARDE', 'NOCHE')
 * @param {string} props.size - Tamaño del badge ('small' | 'medium')
 * @param {string} props.overlap - Tipo de superposición ('circular' | 'rectangular' | 'subtle')
 * @param {Object} props.rutina - Rutina actual (opcional, para calcular progreso del período)
 * @param {string} props.section - Sección del hábito (opcional, para calcular progreso)
 * @param {string} props.itemId - ID del ítem (opcional, para calcular progreso)
 * @param {boolean} [props.reserveBadgeSpace] — mantiene el hueco del badge aunque no haya contenido (carrusel)
 * @param {React.ReactNode} props.children - Elemento hijo (generalmente un IconButton)
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
  children 
}) => {
  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const frecuencia = Number(config?.frecuencia || 1);
  const horarios = Array.isArray(config?.horarios) ? config.horarios : [];
  const periodo = config?.periodo ? config.periodo.toUpperCase() : null;

  // Calcular completados del período actual para hábitos semanales/mensuales
  const completadosEnPeriodo = useMemo(() => {
    if (!rutina || !section || !itemId) return null;
    
    // Solo calcular para SEMANAL/MENSUAL/PERSONALIZADO (no DIARIO)
    if (tipo !== 'SEMANAL' && tipo !== 'MENSUAL' && 
        !(tipo === 'PERSONALIZADO' && periodo && periodo !== 'CADA_DIA')) {
      return null;
    }

    try {
      // Obtener historial de completados desde rutina.historial[section][itemId]
      // El historial se estructura como: historial[section][itemId][YYYY-MM-DD] = true
      const historialSection = rutina?.historial?.[section];
      
      // Convertir historial a array de fechas
      // El historial viene como objeto { 'YYYY-MM-DD': true }
      let historialCompletado = [];
      if (historialSection && historialSection[itemId]) {
        const historialItem = historialSection[itemId];
        if (typeof historialItem === 'object' && !Array.isArray(historialItem)) {
          historialCompletado = Object.keys(historialItem)
            .filter(fecha => historialItem[fecha] === true)
            .map(fecha => {
              // Parsear fecha YYYY-MM-DD a Date
              const [year, month, day] = fecha.split('-').map(Number);
              return new Date(year, month - 1, day, 12, 0, 0, 0);
            });
        } else if (Array.isArray(historialItem)) {
          // Fallback: si viene como array de fechas
          historialCompletado = historialItem.map((fecha) => parseAPIDate(fecha) || new Date(fecha));
        }
      }

      // Calcular completados del período actual (día de la rutina o hoy prefs)
      const hoy = rutina?.fecha ? (parseAPIDate(rutina.fecha) || getNormalizedToday()) : getNormalizedToday();
      let completados = contarCompletadosEnPeriodo(hoy, tipo, periodo || 'CADA_DIA', historialCompletado);
      
      // Verificar si el hábito está completado hoy y agregarlo si no está en el historial
      const completadoHoy = isHabitCompletedForHistorial(rutina?.[section]?.[itemId]);
      if (completadoHoy) {
        const hoyStr = toISODateString(hoy);
        const yaEstaEnHistorial = historialCompletado.some((fecha) => toISODateString(fecha) === hoyStr);
        
        // Si no está en el historial, agregarlo al conteo
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

  // Determinar qué mostrar en el badge
  let badgeContent = null;
  let showBadge = false;
  let isNumber = false;
  let resolvedHorario = null;

  // Periódicos flexibles: badge numérico solo si cuota > 1 (evita 0/1 y 1/1)
  if (flexiblePeriodic && frecuencia > 1) {
    const valorAMostrar = completadosEnPeriodo !== null ? completadosEnPeriodo : 0;
    badgeContent = valorAMostrar;
    showBadge = true;
    isNumber = true;
  }
  // Para hábitos periódicos con días fijos: mostrar completados del período actual
  else if (tipo === 'SEMANAL' || tipo === 'MENSUAL' || (tipo === 'PERSONALIZADO' && periodo !== 'CADA_DIA')) {
    if (frecuencia > 1) {
      // Mostrar completados del período actual si está disponible, sino mostrar frecuencia como fallback
      const valorAMostrar = completadosEnPeriodo !== null ? completadosEnPeriodo : frecuencia;
      badgeContent = valorAMostrar;
      showBadge = true;
      isNumber = true; // Es un número, necesita borde
    }
  }
  // Para hábitos diarios con frecuencia > 1 o con horarios específicos: mostrar icono de horario
  else if (tipo === 'DIARIO' || (tipo === 'PERSONALIZADO' && config?.periodo === 'CADA_DIA')) {
    // Si tiene horarios configurados, mostrar icono del horario actual o último no completado
    if (horarios.length > 0) {
      const normalizedHorarios = horarios.map(h => String(h).toUpperCase());
      const normalizedTimeOfDay = String(currentTimeOfDay).toUpperCase();
      const itemValue = rutina?.[section]?.[itemId];

      // Función helper para verificar si un horario específico está completado
      const isHorarioCompleted = (horario) => isHabitHorarioCompleted(itemValue, horario);
      
      // Orden de horarios del día (de más temprano a más tarde)
      const HORARIOS_ORDER = VALID_TIME_OF_DAY;
      
      let horarioAMostrar = displayHorario ? String(displayHorario).toUpperCase() : null;
      
      if (!horarioAMostrar) {
        // Si el horario actual está en la lista, verificar si está completado
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
      
      // Mostrar icono del horario determinado
      if (horarioAMostrar) {
        resolvedHorario = horarioAMostrar;
        switch (horarioAMostrar) {
          case 'MAÑANA':
            badgeContent = <WbSunnyIcon sx={{ fontSize: size === 'small' ? '0.75rem' : '0.875rem' }} />;
            showBadge = true;
            isNumber = false; // Es un icono, sin borde
            break;
          case 'TARDE':
            badgeContent = <WbTwilightIcon sx={{ fontSize: size === 'small' ? '0.75rem' : '0.875rem' }} />;
            showBadge = true;
            isNumber = false; // Es un icono, sin borde
            break;
          case 'NOCHE':
            badgeContent = <NightlightIcon sx={{ fontSize: size === 'small' ? '0.75rem' : '0.875rem' }} />;
            showBadge = true;
            isNumber = false; // Es un icono, sin borde
            break;
          default:
            showBadge = false;
        }
      }
    } else {
      const horarioAMostrar = displayHorario ? String(displayHorario).toUpperCase() : null;
      if (horarioAMostrar && VALID_TIME_OF_DAY.includes(horarioAMostrar)) {
        resolvedHorario = horarioAMostrar;
        switch (horarioAMostrar) {
          case 'MAÑANA':
            badgeContent = <WbSunnyIcon sx={{ fontSize: size === 'small' ? '0.75rem' : '0.875rem' }} />;
            showBadge = true;
            isNumber = false;
            break;
          case 'TARDE':
            badgeContent = <WbTwilightIcon sx={{ fontSize: size === 'small' ? '0.75rem' : '0.875rem' }} />;
            showBadge = true;
            isNumber = false;
            break;
          case 'NOCHE':
            badgeContent = <NightlightIcon sx={{ fontSize: size === 'small' ? '0.75rem' : '0.875rem' }} />;
            showBadge = true;
            isNumber = false;
            break;
          default:
            showBadge = false;
        }
      }
    }
    // Si no tiene horarios pero frecuencia > 1, no mostrar badge (solo frecuencia)
    // (El badge solo muestra horarios, no frecuencia para diarios)
  }

  // Si no hay nada que mostrar, renderizar sin badge (salvo reserva de espacio en carrusel)
  if (!showBadge && !reserveBadgeSpace) {
    return <>{children}</>;
  }

  const badgeVisible = showBadge;
  const renderedBadgeContent = badgeVisible ? badgeContent : '\u00a0';

  // Calcular transform según el tipo de superposición
  const getTransform = () => {
    if (overlap === 'subtle') {
      // Superposición sutil para iconos grandes (38px) en vista expandida
      return size === 'medium' 
        ? 'translate(8%, 8%) scale(1)' // Para iconos más grandes (38px)
        : 'translate(15%, 15%) scale(1)'; // Para iconos más pequeños
    }
    // Por defecto: superposición estándar
    return 'translate(25%, 25%) scale(1)';
  };

  const itemValue = rutina?.[section]?.[itemId];
  const badgeAccent = isNumber
    ? 'primary.main'
    : (resolvedHorario && isHabitHorarioCompleted(itemValue, resolvedHorario)
      ? 'primary.main'
      : 'text.disabled');

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
          padding: size === 'small' ? '1px 3px' : '2px 4px',
          bgcolor: 'transparent',
          color: badgeAccent,
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
            color: badgeAccent,
          },
        },
      }}
    >
      {children}
    </Badge>
  );
};

export default HabitCounterBadge;

