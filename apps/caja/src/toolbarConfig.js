import { registerToolbarModules } from '@shared/navigation/toolbarRegistry';
import { matchCajaSection } from './atta/attaToolbarPaths';
import CajaToolbarLeft from './atta/AttaToolbarLeft.jsx';
import CajaToolbarCenter from './atta/AttaToolbarCenter.jsx';
import CajaToolbarRight from './atta/AttaToolbarRight.jsx';

registerToolbarModules([
  {
    id: 'caja',
    match: (path) => matchCajaSection(path) != null,
    left: CajaToolbarLeft,
    center: CajaToolbarCenter,
    centerDesktop: true,
    right: CajaToolbarRight,
  },
]);
