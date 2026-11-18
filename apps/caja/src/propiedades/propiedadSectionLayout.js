/** Layout tokens compartidos de secciones de propiedad (archivo sin componentes → HMR estable). */
export const SECTION_PADDING_X = 1;
export const SECTION_PADDING_Y = 0.5;
export const SECTION_GAP = 0.5;
export const SECTION_MIN_HEIGHT = '40px';
export const ROW_MIN_HEIGHT = '32px';
export const SEPARATOR_COLOR = 'divider';
export const SEPARATOR_WIDTH = '1px';

export function formatCompactNumber(value) {
  if (!value || isNaN(value)) return '0';

  const num = parseFloat(value);
  if (num === 0) return '0';

  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (absNum >= 1000000000) {
    return `${sign}${(absNum / 1000000000).toFixed(1)}B`;
  }
  if (absNum >= 1000000) {
    return `${sign}${(absNum / 1000000).toFixed(1)}M`;
  }
  if (absNum >= 1000) {
    return `${sign}${(absNum / 1000).toFixed(1)}k`;
  }
  return `${sign}${absNum.toFixed(0)}`;
}
