import { createElement, forwardRef } from 'react';
import SvgIcon from '@mui/material/SvgIcon';
import {
  TrendingUpOutlined,
  AccountBalanceWalletOutlined,
  CurrencyExchangeOutlined,
  RepeatOutlined,
  PersonSearchOutlined,
  ApartmentOutlined,
  PersonOutlined,
  DescriptionOutlined,
  HotelOutlined,
  LocalHospitalOutlined,
  MonitorHeartOutlined,
  ScienceOutlined,
  RestaurantOutlined,
  AccessTimeOutlined,
  CalendarTodayOutlined,
  EventNoteOutlined,
  FolderOutlined,
  TrackChangesOutlined,
  CheckCircleOutlined,
  ArchiveOutlined,
  SettingsOutlined,
  ManageAccountsOutlined,
  AccountCircleOutlined,
  AccountBalanceOutlined,
  DirectionsCarOutlined, // auto
  Inventory2Outlined, // inventario
  AttachMoneyOutlined, // bolsa de dinero (finanzas)
  FitnessCenterOutlined, // pesa de gym para rutinas
  CleaningServicesOutlined,
  SelfImprovementOutlined,
  ExpandLess,
  ExpandMore,
  FiberManualRecordOutlined,
  KeyboardBackspaceOutlined,
  MonetizationOnOutlined, // icono "$" dentro de círculo para Caja
  BedOutlined, // icono de cama para habitaciones
  TuneOutlined,
  ConstructionOutlined, // icono de construcción
  AddOutlined // icono de agregar
} from '@mui/icons-material';

/** Círculo MUI (MonetizationOn) + traza ECG MUI (MonitorHeart), para la marca Pulso. */
const MUI_CIRCLE_OUTLINED = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8';
const MUI_ECG_PATH = 'M14.89 7.55c-.34-.68-1.45-.68-1.79 0L10 13.76l-1.11-2.21A.988.988 0 0 0 8 11H2v2h5.38l1.72 3.45c.18.34.52.55.9.55s.72-.21.89-.55L14 10.24l1.11 2.21c.17.34.51.55.89.55h6v-2h-5.38z';

const PulsoCircleOutlined = forwardRef(function PulsoCircleOutlined(props, ref) {
  return createElement(
    SvgIcon,
    { ...props, ref },
    createElement('path', { d: MUI_CIRCLE_OUTLINED }),
    createElement('path', {
      d: MUI_ECG_PATH,
      transform: 'translate(12 12) scale(0.75) translate(-12 -12)',
    }),
  );
});

export const icons = {
  trendingUp: TrendingUpOutlined,
  wallet: AccountBalanceWalletOutlined,
  currency: CurrencyExchangeOutlined,
  repeat: RepeatOutlined,
  personSearch: PersonSearchOutlined,
  apartment: ApartmentOutlined,
  person: PersonOutlined,
  description: DescriptionOutlined,
  hotel: HotelOutlined,
  health: PulsoCircleOutlined, // alias marca Pulso
  pulso: PulsoCircleOutlined, // ECG en círculo — marca app Pulso
  monitorHeart: MonitorHeartOutlined, // monitor + ECG — sección data corporal
  science: ScienceOutlined,
  restaurant: RestaurantOutlined,
  accessTime: AccessTimeOutlined, // reloj — marca app Foco (PWA / switcher)
  eventNote: EventNoteOutlined,
  calendarToday: CalendarTodayOutlined,
  agenda: CalendarTodayOutlined, // alias calendario (vista agenda en Tareas)
  folder: FolderOutlined,
  objetivo: TrackChangesOutlined, // objetivos / proyectos (diana; fuente única; ver tiempoNavConfig)
  proyecto: TrackChangesOutlined, // alias legacy
  task: CheckCircleOutlined, // check en círculo (estilo Google Tasks)
  archive: ArchiveOutlined,
  settings: TuneOutlined,
  manageAccounts: ManageAccountsOutlined,
  accountCircle: AccountCircleOutlined,
  accountBalance: AccountBalanceOutlined,
  auto: DirectionsCarOutlined, // auto
  inversiones: TrendingUpOutlined, // flecha hacia arriba
  inventario: Inventory2Outlined, // caja de inventario
  moneyBag: AttachMoneyOutlined, // bolsa de dinero (finanzas)
  fitnessCenter: FitnessCenterOutlined, // pesa de gym para rutinas
  cleaningServices: CleaningServicesOutlined,
  selfImprovement: SelfImprovementOutlined,
  bankConnections: AccountBalanceWalletOutlined, // billetera digital
  expandLess: ExpandLess,
  expandMore: ExpandMore,
  fiberManualRecord: FiberManualRecordOutlined,
  arrowBack: KeyboardBackspaceOutlined,
  dollarSign: MonetizationOnOutlined, // $ en círculo — marca app Caja
  bed: BedOutlined, // icono de cama para habitaciones
  construction: ConstructionOutlined, // icono de construcción
  add: AddOutlined // icono de agregar
};

// Función helper para obtener el icono por clave
export const getIconByKey = (iconKey) => {
  if (!iconKey || typeof iconKey !== 'string') {
    console.warn(`getIconByKey: iconKey inválido:`, iconKey);
    return icons.folder;
  }
  
  const icon = icons[iconKey];
  if (!icon) {
    console.warn(`getIconByKey: icono no encontrado para clave: "${iconKey}"`);
    return icons.folder;
  }
  
  return icon;
};

// Función helper para verificar si una ruta está activa
export const isRouteActive = (currentPath, activePaths) => {
  if (Array.isArray(activePaths)) {
    return activePaths.some(path => {
      if (path === '/') {
        return (
          currentPath === '/'
          || currentPath.startsWith('/finanzas')
          || currentPath.startsWith('/propiedades')
        );
      }
      return currentPath === path || currentPath.startsWith(path + '/');
    });
  }
  return currentPath === activePaths || currentPath.startsWith(activePaths + '/');
}; 