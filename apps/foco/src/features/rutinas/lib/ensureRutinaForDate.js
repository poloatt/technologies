import clienteAxios from '@shared/config/axios';
import { formatDateForAPI, parseAPIDate, getNormalizedToday } from '@shared/utils/dateUtils';
import { isAfter, startOfDay } from 'date-fns';

/**
 * Carga o crea el registro de rutina para una fecha (log diario).
 */
export async function ensureRutinaForDate(date, {
  rutinas = [],
  getRutinaById,
  fetchRutinas,
}) {
  if (!date || typeof getRutinaById !== 'function') return null;

  const dateStr = formatDateForAPI(date);
  const findInList = () => {
    try {
      return rutinas.find((r) => formatDateForAPI(parseAPIDate(r.fecha)) === dateStr);
    } catch {
      return null;
    }
  };

  let target = findInList();
  if (target?._id) {
    await getRutinaById(target._id);
    return target;
  }

  try {
    const verify = await clienteAxios.get(`/api/rutinas/verify?fecha=${encodeURIComponent(dateStr)}`);
    if (verify.data?.exists && verify.data.rutinaId) {
      await getRutinaById(verify.data.rutinaId);
      return verify.data;
    }
  } catch {
    // continuar con creación
  }

  const targetDay = startOfDay(parseAPIDate(date) || date);
  const today = startOfDay(getNormalizedToday());
  if (isAfter(targetDay, today)) {
    return null;
  }

  try {
    const res = await clienteAxios.post('/api/rutinas', {
      fecha: dateStr,
      useGlobalConfig: true,
    });
    if (typeof fetchRutinas === 'function') {
      await fetchRutinas();
    }
    if (res.data?._id) {
      await getRutinaById(res.data._id);
    }
    return res.data;
  } catch (error) {
    const rutinaId = error.response?.data?.rutinaId;
    if (rutinaId) {
      await getRutinaById(rutinaId);
      return { _id: rutinaId };
    }
    throw error;
  }
}
