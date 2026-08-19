import { getDocumentId } from '../habitacionConstants';

/** Datos iniciales del formulario de contrato para un inquilino dado. */
export function buildContratoInitialDataForInquilino(inquilino, propiedades = [], cuentas = []) {
  const propiedad = propiedades.find(
    (p) => getDocumentId(p) === getDocumentId(inquilino?.propiedad),
  );

  let cuentaObj = null;
  if (propiedad?.cuenta && cuentas.length > 0) {
    if (typeof propiedad.cuenta === 'object') {
      cuentaObj = propiedad.cuenta;
    } else {
      cuentaObj =
        cuentas.find(
          (c) => c._id === propiedad.cuenta || c.id === propiedad.cuenta,
        ) || '';
    }
  }
  if (!cuentaObj && cuentas.length > 0) {
    cuentaObj = cuentas.find((c) => c.activo !== false) || cuentas[0];
  }

  return {
    inquilino: [getDocumentId(inquilino)],
    propiedad: getDocumentId(propiedad),
    cuenta: getDocumentId(cuentaObj),
    montoMensual: propiedad?.montoMensual?.toString() || '0',
    deposito:
      propiedad?.deposito?.toString() ||
      (propiedad?.montoMensual ? (propiedad.montoMensual * 2).toString() : '0'),
    esMantenimiento: false,
    tipoContrato: 'ALQUILER',
  };
}
