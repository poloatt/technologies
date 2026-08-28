/** Buckets de cadencia para la vista agrupada en /rutinas. */
export const RUTINA_CADENCE_BUCKETS = [
  { id: 'DIARIO', label: 'Hoy', iconKey: 'calendarToday' },
  { id: 'SEMANAL', label: 'Esta semana', iconKey: 'eventNote' },
  { id: 'MENSUAL', label: 'Mensual', iconKey: 'accessTime' },
  { id: 'TRIMESTRAL', label: 'Trimestral', iconKey: 'repeat' },
  { id: 'SEMESTRAL', label: 'Semestral', iconKey: 'repeat' },
  { id: 'ANUAL', label: 'Anual', iconKey: 'repeat' },
];

export const CADENCE_BUCKET_ICON_KEYS = Object.fromEntries(
  RUTINA_CADENCE_BUCKETS.map((bucket) => [bucket.id, bucket.iconKey]),
);

const BUCKET_ORDER = Object.fromEntries(
  RUTINA_CADENCE_BUCKETS.map((bucket, index) => [bucket.id, index]),
);

/**
 * Resuelve el bucket de cadencia de un hábito según tipo/periodo.
 */
export function resolveHabitCadenceBucket(config = {}) {
  const tipo = (config?.tipo || 'DIARIO').toUpperCase();
  const periodo = (config?.periodo || 'CADA_DIA').toUpperCase();

  if (tipo === 'DIARIO') return 'DIARIO';
  if (tipo === 'SEMANAL') return 'SEMANAL';
  if (tipo === 'MENSUAL') return 'MENSUAL';
  if (tipo === 'TRIMESTRAL') return 'TRIMESTRAL';
  if (tipo === 'SEMESTRAL') return 'SEMESTRAL';
  if (tipo === 'ANUAL') return 'ANUAL';

  if (tipo === 'PERSONALIZADO') {
    switch (periodo) {
      case 'CADA_DIA':
        return 'DIARIO';
      case 'CADA_SEMANA':
        return 'SEMANAL';
      case 'CADA_MES':
        return 'MENSUAL';
      case 'CADA_TRIMESTRE':
        return 'TRIMESTRAL';
      case 'CADA_SEMESTRE':
        return 'SEMESTRAL';
      case 'CADA_ANO':
      case 'CADA_AÑO':
        return 'ANUAL';
      default:
        return 'DIARIO';
    }
  }

  return 'DIARIO';
}

export function getCadenceBucketLabel(bucketId) {
  return RUTINA_CADENCE_BUCKETS.find((bucket) => bucket.id === bucketId)?.label || bucketId;
}

export function compareCadenceBuckets(a, b) {
  return (BUCKET_ORDER[a] ?? 99) - (BUCKET_ORDER[b] ?? 99);
}
