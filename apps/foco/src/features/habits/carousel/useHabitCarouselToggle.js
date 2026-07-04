import { useCallback } from 'react';
import {
  getHorarioForCarousel,
  computeRutinaToggleValue,
  resolveCarouselItemConfig,
  computeCarouselToggleValue,
  persistRutinaItemToggle,
} from '@shared/habits';

/**
 * Toggle de completado con soporte multi-horario y UI optimista.
 * @param {'ahora'|'luego'} mode - Ahora marca la ventana actual; Luego marca la próxima pendiente.
 */
export default function useHabitCarouselToggle({
  mode,
  interactive,
  dragRef,
  rutinaHoy,
  markItemComplete,
  patchRutinaSection,
  currentTimeOfDay,
  habitsPreferences = {},
}) {
  const logPrefix = mode === 'luego' ? '[HabitCarouselLuego]' : '[HabitCarouselAhora]';

  return useCallback(async (section, itemId, horarioProp = null) => {
    if (!interactive) return;
    if (dragRef.current.moved) return;
    if (!rutinaHoy?._id) return;
    if (!markItemComplete) {
      console.warn(`${logPrefix} markItemComplete no disponible en contexto`);
      return;
    }

    const prevSection = rutinaHoy?.[section] || {};
    const itemValue = prevSection[itemId];
    const itemConfig = resolveCarouselItemConfig(section, itemId, rutinaHoy, habitsPreferences);
    const horariosConfig = Array.isArray(itemConfig.horarios) ? itemConfig.horarios : [];

    let normalizedHorario;
    if (horarioProp) {
      normalizedHorario = String(horarioProp).toUpperCase();
    } else if (horariosConfig.length > 1) {
      const completadoHoy = itemValue !== undefined ? itemValue : false;
      const horarioToMark = getHorarioForCarousel(
        mode,
        horariosConfig,
        currentTimeOfDay,
        completadoHoy,
      );
      if (!horarioToMark) return;
      normalizedHorario = String(horarioToMark).toUpperCase();
    } else if (horariosConfig.length === 1) {
      normalizedHorario = String(horariosConfig[0]).toUpperCase();
    }

    const newValue = horarioProp
      ? computeRutinaToggleValue({
        section,
        itemId,
        rutina: rutinaHoy,
        habitsPreferences,
        horario: horarioProp,
      })
      : computeCarouselToggleValue({
        itemValue,
        horariosConfig,
        normalizedHorario,
      });

    try {
      await persistRutinaItemToggle({
        rutinaId: rutinaHoy._id,
        section,
        itemId,
        newValue,
        previousValue: itemValue,
        markItemComplete,
        patchRutinaSection,
      });
    } catch {
      console.warn(`${logPrefix} No se pudo togglear`, { section, itemId });
    }
  }, [
    mode,
    interactive,
    dragRef,
    rutinaHoy,
    markItemComplete,
    patchRutinaSection,
    currentTimeOfDay,
    habitsPreferences,
    logPrefix,
  ]);
}
