/** Tipos de acciones soportadas en el historial de deshacer. */
export const ACTION_TYPES = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  MOVE: 'MOVE',
  BULK_DELETE: 'BULK_DELETE',
  BULK_UPDATE: 'BULK_UPDATE',
};

/** Entidades soportadas en el historial de deshacer. */
export const ENTITY_TYPES = {
  OBJETIVO: 'objetivo',
  TAREA: 'tarea',
  PROPIEDAD: 'propiedad',
  TRANSACCION: 'transaccion',
  CUENTA: 'cuenta',
  MONEDA: 'moneda',
  RUTINA: 'rutina',
  RUTINA_SECTION: 'rutina_section',
  RUTINA_CONFIG: 'rutina_config',
  HABIT: 'habit',
  SALUD_ITEM: 'salud_item',
  SALUD_CONTROL: 'salud_control',
  RECETA: 'receta',
  DIETA_PLAN: 'dieta_plan',
  INQUILINO: 'inquilino',
  CONTRATO: 'contrato',
  HABITACION: 'habitacion',
  INVENTARIO: 'inventario',
  TRANSACCION_RECURRENTE: 'transaccion_recurrente',
};
