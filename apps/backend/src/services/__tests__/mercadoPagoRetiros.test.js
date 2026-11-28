import {
  agregarCobertura,
  coberturaCubre,
  conciliarRetiros,
  esReporteConfiable,
  extraerRetiros,
  fusionarCobertura,
  inicioSettlementRapido,
  resumenCoberturaRetiros,
  tramosSinCobertura,
  ventanaValidada
} from '../mercadoPagoRetiros.js';

const DAY = 24 * 60 * 60 * 1000;
const iso = (s) => new Date(s).toISOString();

describe('esReporteConfiable', () => {
  const base = { id: 1, created_from: 'manual', date_created: '2026-11-25T10:00:00Z' };

  it('acepta un reporte manual generado desde la fecha de confianza', () => {
    expect(esReporteConfiable(base)).toBe(true);
  });

  it('rechaza reportes manuales anteriores (salían sin retiros)', () => {
    expect(esReporteConfiable({ ...base, date_created: '2026-11-10T10:00:00Z' })).toBe(false);
  });

  it('rechaza siempre los reportes automáticos (schedule)', () => {
    expect(esReporteConfiable({ ...base, created_from: 'schedule' })).toBe(false);
  });

  it('acepta un id explícitamente confiable aunque sea viejo', () => {
    expect(
      esReporteConfiable({ ...base, id: 77, date_created: '2026-11-01T00:00:00Z' }, { trustedIds: ['77'] })
    ).toBe(true);
  });

  it('respeta MP_RETIROS_TRUSTED_SINCE', () => {
    const env = { MP_RETIROS_TRUSTED_SINCE: '2026-12-01T00:00:00Z' };
    // getRetirosTrustedSince lee process.env por defecto: se pasa el corte resuelto.
    expect(esReporteConfiable(base, { trustedSince: new Date(env.MP_RETIROS_TRUSTED_SINCE) })).toBe(false);
  });

  it('rechaza lo que no existe', () => {
    expect(esReporteConfiable(null)).toBe(false);
  });
});

describe('cobertura: fusión y cobertura', () => {
  it('une tramos contiguos (02:59:59Z → 03:00:00Z) y solapados', () => {
    const fusion = fusionarCobertura([
      { beginDate: '2026-01-01T03:00:00Z', endDate: '2026-02-01T02:59:59Z' },
      { beginDate: '2026-02-01T03:00:00Z', endDate: '2026-03-01T02:59:59Z' },
      { beginDate: '2026-02-20T00:00:00Z', endDate: '2026-03-10T00:00:00Z' }
    ]);
    expect(fusion).toHaveLength(1);
    expect(fusion[0].beginDate).toBe(iso('2026-01-01T03:00:00Z'));
    expect(fusion[0].endDate).toBe(iso('2026-03-10T00:00:00Z'));
  });

  it('no une tramos separados', () => {
    const fusion = fusionarCobertura([
      { beginDate: '2026-01-01T00:00:00Z', endDate: '2026-01-10T00:00:00Z' },
      { beginDate: '2026-02-01T00:00:00Z', endDate: '2026-02-10T00:00:00Z' }
    ]);
    expect(fusion).toHaveLength(2);
  });

  it('releaseValidado solo vale si todos los tramos fusionados lo tienen', () => {
    const fusion = fusionarCobertura([
      { beginDate: '2026-01-01T00:00:00Z', endDate: '2026-01-10T00:00:00Z', releaseValidado: true },
      { beginDate: '2026-01-10T00:00:00Z', endDate: '2026-01-20T00:00:00Z', releaseValidado: false }
    ]);
    expect(fusion[0].releaseValidado).toBe(false);
  });

  it('agregarCobertura suma y fusiona', () => {
    const cob = agregarCobertura(
      [{ beginDate: '2026-01-01T00:00:00Z', endDate: '2026-01-10T00:00:00Z' }],
      { beginDate: '2026-01-10T00:00:00Z', endDate: '2026-01-15T00:00:00Z' }
    );
    expect(cob).toHaveLength(1);
    expect(cob[0].endDate).toBe(iso('2026-01-15T00:00:00Z'));
  });

  it('coberturaCubre exige un único tramo que contenga el rango (con tolerancias)', () => {
    const cob = [{ beginDate: '2026-01-02T00:00:00Z', endDate: '2026-02-01T00:00:00Z' }];
    expect(coberturaCubre(cob, '2026-01-05T00:00:00Z', '2026-01-30T00:00:00Z')).toBe(true);
    expect(coberturaCubre(cob, '2026-01-01T00:00:00Z', '2026-01-30T00:00:00Z')).toBe(false);
    expect(
      coberturaCubre(cob, '2026-01-01T00:00:00Z', '2026-01-30T00:00:00Z', { toleranciaInicioMs: DAY })
    ).toBe(true);
  });
});

describe('tramosSinCobertura', () => {
  it('devuelve el complemento, el más reciente primero', () => {
    const cob = [{ beginDate: '2026-03-01T00:00:00Z', endDate: '2026-04-01T00:00:00Z' }];
    const tramos = tramosSinCobertura(cob, { desde: '2026-02-01T00:00:00Z', hasta: '2026-05-01T00:00:00Z' });
    expect(tramos).toHaveLength(2);
    expect(tramos[0].beginDate).toBe(iso('2026-04-01T00:00:00Z'));
    expect(tramos[1].endDate).toBe(iso('2026-03-01T00:00:00Z'));
  });

  it('parte huecos largos en partes iguales de hasta 58 días', () => {
    const tramos = tramosSinCobertura([], { desde: '2026-01-01T00:00:00Z', hasta: '2026-05-01T00:00:00Z' });
    expect(tramos.length).toBeGreaterThanOrEqual(3);
    for (const t of tramos) {
      expect((Date.parse(t.endDate) - Date.parse(t.beginDate)) / DAY).toBeLessThanOrEqual(58.01);
      expect(t.mesLabel).toBeTruthy();
    }
    // Cubren todo el rango sin huecos.
    const ordenados = [...tramos].reverse();
    for (let i = 1; i < ordenados.length; i += 1) {
      expect(ordenados[i].beginDate).toBe(ordenados[i - 1].endDate);
    }
  });

  it('ignora huecos menores a un día (bordes de reporte)', () => {
    const cob = [{ beginDate: '2026-01-01T00:00:00Z', endDate: '2026-02-01T00:00:00Z' }];
    expect(tramosSinCobertura(cob, { desde: '2026-01-01T00:00:00Z', hasta: '2026-02-01T05:00:00Z' })).toEqual([]);
  });

  it('sin cobertura y rango inválido', () => {
    expect(tramosSinCobertura([], { desde: '2026-05-01T00:00:00Z', hasta: '2026-01-01T00:00:00Z' })).toEqual([]);
  });
});

describe('inicioSettlementRapido', () => {
  const now = new Date('2026-11-28T12:00:00Z');
  const windowBegin = new Date('2026-08-30T12:00:00Z');

  it('sin cobertura pide la ventana completa', () => {
    expect(inicioSettlementRapido([], { windowBegin, now })).toBe(windowBegin.toISOString());
  });

  it('con cobertura hasta casi ahora pide solo la cola con un día de solape', () => {
    const cob = [{ beginDate: '2026-01-01T00:00:00Z', endDate: '2026-11-27T12:00:00Z' }];
    expect(inicioSettlementRapido(cob, { windowBegin, now })).toBe(iso('2026-11-26T12:00:00Z'));
  });

  it('si la cobertura empieza después de la ventana, pide la ventana completa', () => {
    const cob = [{ beginDate: '2026-10-01T00:00:00Z', endDate: '2026-11-27T12:00:00Z' }];
    expect(inicioSettlementRapido(cob, { windowBegin, now })).toBe(windowBegin.toISOString());
  });
});

describe('extraerRetiros y conciliarRetiros', () => {
  const rows = [
    { sourceId: '1001', transactionType: 'PAYOUTS', netAmount: -50000, date: '2026-04-05T10:00:00Z' },
    { sourceId: '1002', transactionType: 'WITHDRAWAL', netAmount: -2500.5, date: '2026-04-06T10:00:00Z' },
    { sourceId: '1003', transactionType: 'WITHDRAWAL_CANCEL', netAmount: 2500.5, date: '2026-04-07T10:00:00Z' },
    { sourceId: '9', transactionType: 'SETTLEMENT', netAmount: 100, date: '2026-04-05T10:00:00Z' }
  ];

  it('extrae solo retiros con monto absoluto y marca cancelaciones', () => {
    const retiros = extraerRetiros(rows);
    expect(retiros.map((r) => r.id)).toEqual(['1001', '1002', '1003']);
    expect(retiros[0].amount).toBe(50000);
    expect(retiros[2].cancel).toBe(true);
  });

  it('concilia cuando todos están en el ledger', () => {
    const c = conciliarRetiros(extraerRetiros(rows), ['1001', 1002, '1003']);
    expect(c.ok).toBe(true);
    expect(c.esperados).toBe(3);
    expect(c.conciliados).toBe(3);
    expect(c.faltantes).toEqual([]);
    expect(c.montoEsperado).toBe(52500.5);
  });

  it('lista los faltantes con id, monto y fecha', () => {
    const c = conciliarRetiros(extraerRetiros(rows), ['1001']);
    expect(c.ok).toBe(false);
    expect(c.conciliados).toBe(1);
    expect(c.faltantes.map((f) => f.id)).toEqual(['1002', '1003']);
    expect(c.faltantes[0]).toMatchObject({ amount: 2500.5, type: 'WITHDRAWAL' });
  });

  it('un reporte sin retiros concilia vacío', () => {
    expect(conciliarRetiros([], []).ok).toBe(true);
  });
});

describe('ventanaValidada', () => {
  it('nunca pasa del fin del reporte ni de cuando se generó', () => {
    const v = ventanaValidada(
      {
        begin_date: '2026-10-01T03:00:00Z',
        end_date: '2026-11-30T02:59:59Z',
        date_created: '2026-11-27T10:00:00Z'
      },
      { now: Date.parse('2026-11-28T00:00:00Z') }
    );
    expect(v.endDate).toBe(iso('2026-11-27T10:00:00Z'));
    expect(v.beginDate).toBe(iso('2026-10-01T03:00:00Z'));
  });

  it('null si queda vacía', () => {
    expect(
      ventanaValidada({ begin_date: '2026-11-27T00:00:00Z', end_date: '2026-11-26T00:00:00Z' })
    ).toBeNull();
  });
});

describe('resumenCoberturaRetiros', () => {
  const now = new Date('2026-11-28T12:00:00Z');

  it('sin cobertura avisa que no hay validación', () => {
    const r = resumenCoberturaRetiros({ historial: { inicioActividad: '2025-01-01T00:00:00Z' } }, { now });
    expect(r.completa).toBe(false);
    expect(r.advertencia).toBe(true);
    expect(r.avisos[0]).toMatch(/todavía no hay salidas a CBU validadas/i);
  });

  it('sin cobertura pero con conciliación fallida muestra el motivo real, no un paso genérico', () => {
    const r = resumenCoberturaRetiros(
      {
        historial: { inicioActividad: '2026-01-01T00:00:00Z' },
        diagnostico: { retiros: { validado: false, motivo: 'Faltan en el ledger 3 retiros: 1, 2, 3' } }
      },
      { now }
    );
    expect(r.avisos[0]).toBe('Última sincronización sin validar: Faltan en el ledger 3 retiros: 1, 2, 3');
    expect(r.avisos.some((a) => /Sincronizar/.test(a))).toBe(false);
  });

  it('cobertura completa desde el inicio de actividad no advierte', () => {
    const r = resumenCoberturaRetiros(
      {
        historial: { inicioActividad: '2026-01-01T00:00:00Z' },
        coberturaRetiros: [{ beginDate: '2026-01-01T00:00:00Z', endDate: '2026-11-28T11:00:00Z' }]
      },
      { now }
    );
    expect(r.completa).toBe(true);
    expect(r.advertencia).toBe(false);
    expect(r.totalTramosSinValidar).toBe(0);
  });

  it('cobertura parcial lista los tramos sin validar y avisa', () => {
    const r = resumenCoberturaRetiros(
      {
        historial: { inicioActividad: '2026-01-01T00:00:00Z' },
        coberturaRetiros: [{ beginDate: '2026-09-01T00:00:00Z', endDate: '2026-11-28T11:00:00Z' }]
      },
      { now }
    );
    expect(r.completa).toBe(false);
    expect(r.totalTramosSinValidar).toBeGreaterThan(0);
    expect(r.advertencia).toBe(true);
    expect(r.validadoHasta).toBe(iso('2026-11-28T11:00:00Z'));
  });

  it('incluye la brecha del ancla y el reporte pendiente', () => {
    const r = resumenCoberturaRetiros(
      {
        historial: { inicioActividad: '2026-01-01T00:00:00Z' },
        coberturaRetiros: [{ beginDate: '2026-01-01T00:00:00Z', endDate: '2026-11-28T11:00:00Z' }],
        reportePendiente: { beginDate: '2026-11-01T00:00:00Z', endDate: '2026-11-28T00:00:00Z' },
        diagnostico: { anclaGap: { ok: false, gap: 1165651.94, fecha: '2026-11-27T00:00:00Z' } }
      },
      { now }
    );
    expect(r.advertencia).toBe(true);
    expect(r.avisos.some((a) => /difiere/.test(a))).toBe(true);
    expect(r.avisos.some((a) => /en generación/.test(a))).toBe(true);
  });
});
