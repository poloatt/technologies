import {

  registerToolbarModules,

  registerAgendaBarSlots,

  registerRutinaDateHeroBar,

} from '@shared/navigation/toolbarRegistry';

import { matchTiempoSection } from '@shared/navigation/tiempoToolbarPaths';

import {

  AgendaToolbarCenter,

  ObjetivosToolbarCenter,

  TareasToolbarCenter,

  TiempoToolbarRight,

  TiempoToolbarActions,

  RutinasToolbarCenter,

} from './features/toolbar';

import { RutinaDateHeroBar } from './features/rutinas';



registerToolbarModules([

  {

    id: 'objetivos',

    match: (path) => matchTiempoSection(path) === 'objetivos',

    center: ObjetivosToolbarCenter,

    centerDesktop: true,

    right: TiempoToolbarRight,

  },

  {

    id: 'tareas',

    match: (path) => matchTiempoSection(path) === 'tareas',

    center: TareasToolbarCenter,

    centerDesktop: true,

    right: TiempoToolbarRight,

  },

  {

    id: 'rutinas',

    match: (path) => path === '/rutinas' || path.startsWith('/rutinas/'),

    // Navegación diaria (date hero) vive en RutinaPageNavigationBar vía registerRutinaDateHeroBar.
    center: RutinasToolbarCenter,

    centerDesktop: true,

    right: TiempoToolbarRight,

  },

  {

    id: 'archivo',

    match: (path) => path === '/archivo' || path.startsWith('/archivo/'),

    center: null,

    centerDesktop: false,

    right: TiempoToolbarRight,

  },

]);



registerAgendaBarSlots({
  focoCenterActions: TiempoToolbarActions,
  agendaViewToggle: AgendaToolbarCenter,
});



registerRutinaDateHeroBar(RutinaDateHeroBar);

