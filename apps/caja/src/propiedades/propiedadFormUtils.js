export function getDocumentId(doc) {
  if (doc == null) return null;
  if (typeof doc === 'string') return doc;
  return doc._id || doc.id || null;
}

export function buildPropiedadFormState(data) {
  const source = data || {};
  return {
    alias: source.alias || source.titulo || '',
    tipo: source.tipo || 'CASA',
    direccion: source.direccion || '',
    ciudad: source.ciudad || '',
    metrosCuadrados: source.metrosCuadrados?.toString() || '',
    descripcion: source.descripcion || '',
    cuenta: getDocumentId(source.cuenta) || '',
  };
}

export function resolveCuentaId(initialData, user) {
  return (
    getDocumentId(initialData?.cuenta) ||
    getDocumentId(user?.cuentaDefault) ||
    null
  );
}
