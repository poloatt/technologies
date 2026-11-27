import {
  deduplicarPagosInversionMp,
  investmentOperationIdDePago
} from '../mercadoPagoUtils.js';

function pagoInversion(overrides = {}) {
  return {
    id: 190289948753,
    status: 'approved',
    operation_type: 'investment',
    date_created: '2026-11-24T11:02:20.000-04:00',
    transaction_amount: 266579.11,
    point_of_interaction: {
      type: 'INVESTMENT',
      sub_type: 'SUBSCRIPTION',
      transaction_data: {
        destination_asset: 'FMAH',
        operation_id: '01M8718GVZ5B89XYXJ44FCS2AP'
      }
    },
    ...overrides
  };
}

describe('investmentOperationIdDePago', () => {
  it('extrae operation_id en pagos de inversión', () => {
    expect(investmentOperationIdDePago(pagoInversion())).toBe('01M8718GVZ5B89XYXJ44FCS2AP');
  });

  it('devuelve null para pagos que no son inversión', () => {
    const pagoComun = pagoInversion({
      operation_type: 'regular_payment',
      point_of_interaction: { type: 'UNSPECIFIED', transaction_data: { operation_id: 'ABC' } }
    });
    expect(investmentOperationIdDePago(pagoComun)).toBeNull();
  });
});

describe('deduplicarPagosInversionMp', () => {
  it('colapsa los dos pagos de la misma suscripción FCI y conserva el más antiguo', () => {
    const orden = pagoInversion({
      id: 190289948753,
      date_created: '2026-11-24T11:02:20.000-04:00'
    });
    const liquidacion = pagoInversion({
      id: 191458493270,
      date_created: '2026-11-24T17:45:47.000-04:00'
    });
    const otroPago = { id: 999, operation_type: 'regular_payment', status: 'approved' };

    const { pagos, duplicadosPorCanonico } = deduplicarPagosInversionMp([liquidacion, otroPago, orden]);

    expect(pagos.map((p) => p.id)).toEqual([999, 190289948753]);
    expect(duplicadosPorCanonico.get('190289948753')).toEqual(['191458493270']);
  });

  it('prefiere el pago aprobado si el más antiguo quedó pendiente', () => {
    const pendiente = pagoInversion({
      id: 100,
      status: 'authorized',
      date_created: '2026-11-24T11:00:00.000-04:00'
    });
    const aprobado = pagoInversion({
      id: 200,
      status: 'approved',
      date_created: '2026-11-24T17:45:00.000-04:00'
    });

    const { pagos, duplicadosPorCanonico } = deduplicarPagosInversionMp([pendiente, aprobado]);
    expect(pagos.map((p) => p.id)).toEqual([200]);
    expect(duplicadosPorCanonico.get('200')).toEqual(['100']);
  });

  it('mantiene separadas dos inversiones distintas con distinto operation_id', () => {
    const primera = pagoInversion({ id: 1 });
    const segunda = pagoInversion({
      id: 2,
      point_of_interaction: {
        type: 'INVESTMENT',
        transaction_data: { operation_id: '01M8EG2STSTN7B8DF3ZH288F7B' }
      }
    });

    const { pagos, duplicadosPorCanonico } = deduplicarPagosInversionMp([primera, segunda]);
    expect(pagos.map((p) => p.id)).toEqual([1, 2]);
    expect(duplicadosPorCanonico.size).toBe(0);
  });
});
