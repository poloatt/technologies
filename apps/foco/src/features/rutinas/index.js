export { default as RutinasPage } from './RutinasPage.jsx';
export { RutinaTable } from './RutinaTable.jsx';
export { ensureRutinaForDate } from './lib/ensureRutinaForDate.js';
export { default as useEnsureRutinaForDate } from './hooks/useEnsureRutinaForDate.js';
export { useRutinasPageController } from './hooks/useRutinasPageController.js';
export { useRutinaDateNav } from './hooks/useRutinaDateNav.js';
/** @deprecated Vista por grupo retirada; exports conservados por compatibilidad. */
export {
  RUTINA_PAGE_VIEW,
  readStoredRutinaPageView,
  toggleRutinaPageView,
} from './hooks/useRutinaPageView.js';
export { default as useRutinaItemToggle } from './hooks/useRutinaItemToggle.js';
export { default as useRutinaSectionLocalData } from './hooks/useRutinaSectionLocalData.js';
export { default as useRutinaBucketLocalData } from './hooks/useRutinaBucketLocalData.js';
export { default as RutinaDateHeroBar } from './components/RutinaDateHeroBar.jsx';
