import React from 'react';
import { SeccionUbicacion } from './SeccionUbicacion';
import { SeccionHabitaciones, SeccionDocumentos } from './SeccionesPropiedad';

/**
 * Arma las secciones primarias de una propiedad.
 * Archivo separado (sin mezclar con components HMR-incompatibles en el mismo módulo).
 */
export function crearSeccionesPropiedad(
  propiedad,
  precio,
  simboloMoneda,
  nombreCuenta,
  moneda,
  habitaciones,
  contratos,
  documentos = [],
  extendida = false,
) {
  const secciones = [
    {
      type: 'primary',
      render: () => <SeccionUbicacion propiedad={propiedad} />,
    },
  ];

  if (extendida && habitaciones && habitaciones.length > 0) {
    secciones.push({
      type: 'primary',
      render: () => <SeccionHabitaciones habitaciones={habitaciones} />,
    });
  }

  const documentosCompletos = [
    ...(documentos || []),
    ...(contratos || []).map((contrato) => ({
      ...contrato,
      categoria: 'CONTRATO',
      inquilino: contrato.inquilino || (Array.isArray(propiedad?.inquilinos) ? propiedad.inquilinos : []),
      url: contrato.documentoUrl || `/contratos/${contrato._id}`,
    })),
  ];

  secciones.push({
    type: 'primary',
    render: () => <SeccionDocumentos documentos={documentosCompletos} propiedad={propiedad} />,
  });

  return secciones;
}

export default crearSeccionesPropiedad;
