/** Ordena monedas por campo `orden` y código como desempate. */
export function sortMonedasByOrden(monedas = []) {
  return [...monedas].sort((a, b) => {
    const ordenA = a.orden ?? 0;
    const ordenB = b.orden ?? 0;
    if (ordenA !== ordenB) return ordenA - ordenB;
    return (a.codigo || '').localeCompare(b.codigo || '');
  });
}

export function arrayMove(list, fromIndex, toIndex) {
  if (fromIndex === toIndex) return [...list];
  const result = [...list];
  const [item] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, item);
  return result;
}

export function getMonedaId(moneda) {
  return moneda?.id || moneda?._id;
}
