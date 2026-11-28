import {
  compararRetirosConRelease,
  parseReleaseCsv,
  validarRangoConRelease,
  validarSaldoCorrido
} from '../mercadoPagoReleaseReportService.js';
import { evaluarAncla, normalizarAncla } from '../mercadoPagoAnclaService.js';

const HEADER =
  'DATE,SOURCE_ID,EXTERNAL_REFERENCE,RECORD_TYPE,DESCRIPTION,NET_CREDIT_AMOUNT,NET_DEBIT_AMOUNT,BALANCE_AMOUNT,PAYOUT_BANK_ACCOUNT_NUMBER';

function csv(lineas) {
  return [HEADER, ...lineas].join('\n');
}

const CSV_OK = csv([
  '2026-04-01T00:00:00Z,,,initial_available_balance,,0,0,100000,',
  '2026-04-02T10:00:00Z,501,,release,Pago,50000,0,150000,',
  '2026-04-05T10:00:00Z,1001,,payout,Retiro,0,120000,30000,0000003100012345678901',
  '2026-04-30T23:00:00Z,,,total,,0,0,30000,'
]);

describe('parseReleaseCsv', () => {
  it('normaliza columnas, tipos y montos', () => {
    const rows = parseReleaseCsv(CSV_OK);
    expect(rows).toHaveLength(4);
    expect(rows[2]).toMatchObject({
      sourceId: '1001',
      tipo: 'payout',
      debito: 120000,
      saldo: 30000,
      cuentaDestino: '0000003100012345678901'
    });
  });

  it('tolera punto y coma y decimales con coma', () => {
    const texto = HEADER.replace(/,/g, ';') + '\n2026-04-02T10:00:00Z;1;;release;x;1.234,56;0;1.234,56;';
    const [fila] = parseReleaseCsv(texto);
    expect(fila.credito).toBe(1234.56);
    expect(fila.saldo).toBe(1234.56);
  });

  it('vacío devuelve []', () => {
    expect(parseReleaseCsv('')).toEqual([]);
  });
});

describe('validarSaldoCorrido', () => {
  it('valida una cadena consistente', () => {
    const v = validarSaldoCorrido(parseReleaseCsv(CSV_OK));
    expect(v.ok).toBe(true);
    expect(v.saltos).toEqual([]);
    expect(v.calculado).toBe(30000);
  });

  it('detecta un movimiento faltante como salto de saldo', () => {
    // Falta el payout de 120000 pero el saldo corrido ya lo refleja.
    const truncado = csv([
      '2026-04-01T00:00:00Z,,,initial_available_balance,,0,0,100000,',
      '2026-04-02T10:00:00Z,501,,release,Pago,50000,0,150000,',
      '2026-04-20T10:00:00Z,777,,release,Otro,1000,0,31000,',
      '2026-04-30T23:00:00Z,,,total,,0,0,31000,'
    ]);
    const v = validarSaldoCorrido(parseReleaseCsv(truncado));
    expect(v.ok).toBe(false);
    expect(v.saltos).toHaveLength(1);
  });

  it('sin saldo inicial/final no se puede validar', () => {
    const v = validarSaldoCorrido(parseReleaseCsv(csv(['2026-04-02T10:00:00Z,501,,release,Pago,50000,0,150000,'])));
    expect(v.ok).toBe(false);
    expect(v.motivo).toBe('sin_saldos');
  });
});

describe('compararRetirosConRelease / validarRangoConRelease', () => {
  const settlement = [{ id: '1001', amount: 120000, date: '2026-04-05T10:00:00Z', cancel: false }];

  it('cruza por id', () => {
    const c = compararRetirosConRelease(settlement, [
      { id: '1001', amount: 120000, date: '2026-04-05T10:00:00Z' }
    ]);
    expect(c.ok).toBe(true);
    expect(c.pares[0].por).toBe('id');
  });

  it('cruza por monto y fecha (±1 día) si el id no coincide', () => {
    const c = compararRetirosConRelease(settlement, [
      { id: 'otro', amount: 120000, date: '2026-04-05T20:00:00Z' }
    ]);
    expect(c.ok).toBe(true);
    expect(c.pares[0].por).toBe('monto_fecha');
  });

  it('marca payouts que solo están en un lado', () => {
    const c = compararRetirosConRelease(settlement, []);
    expect(c.ok).toBe(false);
    expect(c.soloSettlement).toHaveLength(1);
  });

  it('validarRangoConRelease combina saldo corrido y cruce', () => {
    const ok = validarRangoConRelease({
      releaseRows: parseReleaseCsv(CSV_OK),
      retirosSettlement: settlement
    });
    expect(ok.ok).toBe(true);

    const sinPayoutEnSettlement = validarRangoConRelease({
      releaseRows: parseReleaseCsv(CSV_OK),
      retirosSettlement: []
    });
    expect(sinPayoutEnSettlement.ok).toBe(false);
    expect(sinPayoutEnSettlement.cruce.soloRelease).toHaveLength(1);
  });
});

describe('ancla de saldo', () => {
  const now = new Date('2026-11-28T15:00:00Z');

  it('normalizarAncla fija el cierre del día argentino y redondea', () => {
    const { ancla, error } = normalizarAncla(
      { fecha: '2026-11-27', dineroEnCuenta: '18500.456', reservado: 100 },
      { now }
    );
    expect(error).toBeUndefined();
    expect(ancla.dineroEnCuenta).toBe(18500.46);
    expect(ancla.reservado).toBe(100);
    expect(ancla.invertido).toBeUndefined();
    expect(ancla.fecha.toISOString()).toBe('2026-11-28T02:59:59.999Z');
  });

  it('rechaza fecha futura, monto inválido y campos no numéricos', () => {
    expect(normalizarAncla({ fecha: '2026-12-31', dineroEnCuenta: 1 }, { now }).error).toMatch(/futura/);
    expect(normalizarAncla({ fecha: '2026-11-27', dineroEnCuenta: 'abc' }, { now }).error).toBeTruthy();
    expect(normalizarAncla({ fecha: '2026-11-27', dineroEnCuenta: 1, reservado: 'x' }, { now }).error).toBeTruthy();
    expect(normalizarAncla({ fecha: 'basura', dineroEnCuenta: 1 }, { now }).error).toBeTruthy();
  });

  it('evaluarAncla calcula la brecha y respeta la tolerancia', () => {
    const ancla = { fecha: new Date('2026-11-28T02:59:59Z'), dineroEnCuenta: 18000 };
    expect(evaluarAncla(ancla, 1183651.94, { tolerancia: 1000 })).toMatchObject({ gap: -1165651.94, ok: false });
    expect(evaluarAncla(ancla, 18500, { tolerancia: 1000 })).toMatchObject({ gap: -500, ok: true });
    expect(evaluarAncla(ancla, NaN)).toBeNull();
  });
});
