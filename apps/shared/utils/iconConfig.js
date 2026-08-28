// Configuración de iconos para las diferentes secciones
import { format } from 'date-fns';
import { es } from './localeEs.js';
import { iconMap } from './habitIcons.js';
import { formatDateForAPI, getNormalizedToday, parseAPIDate, areSameDay } from './dateUtils.js';

export {
  iconMap,
  getIconByName,
  availableIcons,
  getHabitIconOptions,
  getHabitIconGroups,
  getHabitIconLabel,
  DEFAULT_HABIT_ICON,
  HABIT_ICON_LABELS,
} from './habitIcons.js';

export const iconConfig = {
  bodyCare: {
    bath: iconMap.Bathtub,
    skinCareDay: iconMap.PersonOutline,
    skinCareNight: iconMap.Nightlight,
    bodyCream: iconMap.Spa,
  },
  nutricion: {
    cocinar: iconMap.Restaurant,
    agua: iconMap.WaterDrop,
    protein: iconMap.SetMeal,
    meds: iconMap.Medication,
  },
  ejercicio: {
    meditate: iconMap.SelfImprovement,
    stretching: iconMap.DirectionsRun,
    gym: iconMap.FitnessCenter,
    cardio: iconMap.DirectionsBike,
  },
  cleaning: {
    bed: iconMap.Hotel,
    platos: iconMap.Dining,
    piso: iconMap.CleaningServices,
    ropa: iconMap.LocalLaundryService,
  },
};

// Tooltips para los iconos legacy por sección
export const iconTooltips = {
  bodyCare: {
    bath: 'Ducha',
    skinCareDay: 'Cuidado facial día',
    skinCareNight: 'Cuidado facial noche',
    bodyCream: 'Crema corporal'
  },
  nutricion: {
    cocinar: 'Cocinar',
    agua: 'Beber agua',
    protein: 'Proteína',
    meds: 'Medicamentos'
  },
  ejercicio: {
    meditate: 'Meditar',
    stretching: 'Correr',
    gym: 'Gimnasio',
    cardio: 'Bicicleta'
  },
  cleaning: {
    bed: 'Hacer la cama',
    platos: 'Lavar platos',
    piso: 'Limpiar piso',
    ropa: 'Lavar ropa'
  }
};

// Datos por defecto para una nueva rutina
export const defaultFormData = {
  get fecha() {
    return formatDateForAPI(getNormalizedToday());
  },
};

// Exportamos una función para dar formato a las fechas de forma consistente
export const formatDate = (fecha) => {
  try {
    const formatted = formatDateForAPI(fecha);
    if (formatted) return formatted;
    console.warn(`[iconConfig] Fecha inválida: ${fecha}, usando fecha actual.`);
    return formatDateForAPI(getNormalizedToday());
  } catch (error) {
    console.error(`[iconConfig] Error al formatear fecha: ${fecha}`, error);
    return formatDateForAPI(getNormalizedToday());
  }
};

// Función para formatear la fecha en formato corto (mantener compatibilidad con código existente)
export const formatDateLong = (date) => {
  if (!date) return 'Desconocido';
  
  try {
    return format(new Date(date), "d 'de' MMMM", { locale: es });
  } catch (error) {
    console.error('[iconConfig] Error al formatear fecha en formato largo:', error);
    return 'Fecha inválida';
  }
};

// Función para mostrar la fecha en la UI de navegación
export const formatFechaDisplay = (fechaStr) => {
  if (!fechaStr) return 'Sin fecha';

  try {
    const fecha = parseAPIDate(fechaStr);
    if (!fecha || Number.isNaN(fecha.getTime())) {
      return 'Fecha inválida';
    }

    const hoy = getNormalizedToday();
    if (areSameDay(fecha, hoy)) return 'Hoy';

    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    if (areSameDay(fecha, ayer)) return 'Ayer';

    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);
    if (areSameDay(fecha, manana)) return 'Mañana';

    return format(fecha, "d 'de' MMMM", { locale: es });
  } catch (error) {
    console.error('[iconConfig] Error al formatear fecha para mostrar:', error);
    return 'Fecha inválida';
  }
};
