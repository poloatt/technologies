import { useMemo } from 'react';
import {
  getCarouselItemsForMode,
  getRutinaMarkedDoneTodayEntries,
  mapRutinaDoneEntriesToCarouselItems,
} from '@shared/habits';

/**
 * Filtra items del carrusel según modo Ahora/Luego (misma lógica que /rutinas).
 * @param {'ahora'|'luego'} mode
 */
export default function useHabitCarouselItems(mode, {
  rutinaHoy,
  sectionIconsMap,
  habits,
  currentTimeOfDay,
  habitsPreferences = null,
  habitChains = [],
  customSections = [],
  allRutinas = [],
  includeCompletedToday = false,
}) {
  const pendingItems = useMemo(() => {
    if (habitsPreferences === null) return [];
    return getCarouselItemsForMode(mode, {
      rutinaHoy,
      sectionIconsMap,
      habits,
      currentTimeOfDay,
      habitsPreferences: habitsPreferences || {},
      habitChains,
      customSections,
      allRutinas,
    });
  }, [
    mode,
    rutinaHoy,
    sectionIconsMap,
    habits,
    currentTimeOfDay,
    habitsPreferences,
    habitChains,
    customSections,
    allRutinas,
  ]);

  const completedTodayItems = useMemo(() => {
    if (!includeCompletedToday || habitsPreferences === null || !rutinaHoy) return [];
    return mapRutinaDoneEntriesToCarouselItems(
      getRutinaMarkedDoneTodayEntries({
        rutina: rutinaHoy,
        habits,
        habitsPreferences,
        iconsMap: sectionIconsMap?.iconsMap,
      }),
    );
  }, [includeCompletedToday, rutinaHoy, sectionIconsMap, habits, habitsPreferences]);

  return {
    pendingItems,
    carouselItems: pendingItems,
    shouldUseInfiniteCarousel: false,
    completedTodayItems,
  };
}
