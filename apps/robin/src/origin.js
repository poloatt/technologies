export const USER_ORIGIN = 'usuario';
export const ROBIN_ORIGIN = 'robin';
export const RECORD_ORIGINS = [USER_ORIGIN, ROBIN_ORIGIN];

export function isRobinOrigin(origen) {
  return origen === ROBIN_ORIGIN;
}

export function originLabel(origen) {
  return isRobinOrigin(origen) ? 'IA' : 'Vos';
}

export function originTitle(origen) {
  return isRobinOrigin(origen) ? 'Hecho por Robin' : 'Hecho por vos';
}
