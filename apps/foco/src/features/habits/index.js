export { default as HabitCarouselRow } from './carousel/HabitCarouselRow';
export { default as HabitCarouselStrip } from './carousel/HabitCarouselStrip';
export { default as HabitCarouselAhora } from './carousel/HabitCarouselAhora';
export { default as HabitCarouselLuego } from './carousel/HabitCarouselLuego';
export { default as HabitCarouselEmptyState } from './carousel/HabitCarouselEmptyState';
export {
  HabitsManager,
  HabitsManagerHost,
  useHabitFormState,
  dispatchOpenHabitsManager,
  listenOpenHabitsManager,
} from './manager';
export { useHabitsAgendaView } from './hooks/useHabitsAgendaView';

// Re-exports de compatibilidad — preferir `@foco/features/rutinas`
export {
  RutinasPage,
  ensureRutinaForDate,
  useEnsureRutinaForDate,
  useRutinaItemToggle,
  useRutinaSectionLocalData,
  useRutinaBucketLocalData,
} from '../rutinas';
