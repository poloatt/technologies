import { useMemo } from 'react';
import {
  getCarouselItemsForMode,
  getRutinaMarkedDoneTodayEntries,
  mapRutinaDoneEntriesToCarouselItems,
} from '@shared/habits';
/**
 * Filtra items del carrusel según modo Ahora/Luego.
 * @param {'ahora'|'luego'} mode
 */
export default function useHabitCarouselItems(mode, {
  rutinaHoy,
  sectionIconsMap,
  habits,
  currentTimeOfDay,
  habitsPreferences = null,
  includeCompletedToday = false,
}) {
  const params = {
    rutinaHoy,
    sectionIconsMap,
    habits,
    currentTimeOfDay,
    habitsPreferences: habitsPreferences || {},
  };

  const pendingItems = useMemo(() => {
    if (habitsPreferences === null) return [];
    return getCarouselItemsForMode(mode, params);
  }, [mode, rutinaHoy, sectionIconsMap, habits, currentTimeOfDay, habitsPreferences]);

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
