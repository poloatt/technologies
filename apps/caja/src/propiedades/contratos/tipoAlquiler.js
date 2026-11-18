import { Home, SingleBed } from '@mui/icons-material';

/** Opciones de tipo de alquiler (sin JSX → HMR estable). */
export const TIPO_ALQUILER = [
  { valor: false, Icon: Home, label: 'Propiedad', color: '#4caf50' },
  { valor: true, Icon: SingleBed, label: 'Habitación', color: '#2196f3' },
];
