export function getDocumentId(doc) {
  if (doc == null) return null;
  if (typeof doc === 'string') return doc;
  return doc._id || doc.id || null;
}

export function getInquilinoFullName(inquilino) {
  if (!inquilino) return 'Sin nombre';
  const nombre = inquilino.nombre || '';
  const apellido = inquilino.apellido || '';
  const full = `${nombre} ${apellido}`.trim();
  return full || 'Sin nombre';
}

export function formatContratoDuration(fechaInicio, fechaFin) {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  const diffDays = Math.ceil(Math.abs(fin - inicio) / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffMonths / 12);

  if (diffYears > 0) {
    return `${diffYears} año${diffYears > 1 ? 's' : ''}`;
  }
  if (diffMonths > 0) {
    return `${diffMonths} mes${diffMonths > 1 ? 'es' : ''}`;
  }
  return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
}

export function getContratoActual(inquilino) {
  const { contratosClasificados = {} } = inquilino || {};

  if (contratosClasificados.activos?.length > 0) {
    return contratosClasificados.activos[0];
  }
  if (contratosClasificados.futuros?.length > 0) {
    return contratosClasificados.futuros[0];
  }
  if (contratosClasificados.vencidos?.length > 0) {
    return contratosClasificados.vencidos[0];
  }
  return null;
}
