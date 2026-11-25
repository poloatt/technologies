import {
  parsearActividadUsd,
  parsearMontoUsd,
  clasificarMovimientoUsd,
  esCompraventaMepUsd,
  importarActividadUsd,
} from '../mercadoPagoUsdActivity.js';

const TEXTO = `
HoyDisponible US$417,67
  - [Rendimientos](https://www.mercadopago.com.ar/banking/balance/movements/B33NK60DYJ9F9R24F)
02:35
Rendimientos
Rendimientos
Movimiento ...F9R24F
+US$0,02

24 de noviembreSaldo del día US$417,65
  - [Tarjeta de crédito](https://www.mercadopago.com.ar/banking/balance/movements/B33NG69RA8BYE3K6S)
11:58
Tarjeta de crédito
Tarjeta de créditoPago
Movimiento ...YE3K6S
-US$18,40
  - [Rendimientos](https://www.mercadopago.com.ar/banking/balance/movements/B33NE8WP7S0Z5V1TF)
02:36
Rendimientos
Rendimientos
Movimiento ...Z5V1TF
+US$0,08

2 de julioSaldo del día US$300,00
  - [Transferencia recibida](https://www.mercadopago.com.ar/banking/balance/movements/B32ZZZZZZZZZZZZZ1)
10:00
Transferencia recibida
Movimiento ...ZZZZ1
+US$2.990
  - [Algo raro](https://www.mercadopago.com.ar/banking/balance/movements/B32ZZZZZZZZZZZZZ2)
10:01
Algo raro
Movimiento ...ZZZZ2
+US$5
  - [Venta de dólar MEP](https://www.mercadopago.com.ar/banking/balance/movements/B32ZZZZZZZZZZZZZ3)
10:02
Venta de dólar MEP
Movimiento ...ZZZZ3
`;

describe('parsearMontoUsd', () => {
  it('lee el formato argentino', () => {
    expect(parsearMontoUsd('2.990')).toBe(2990);
    expect(parsearMontoUsd('0,02')).toBe(0.02);
    expect(parsearMontoUsd('1.234,50')).toBe(1234.5);
  });
});

describe('clasificarMovimientoUsd', () => {
  it('mapea los títulos de la pantalla de MP a kinds dólares', () => {
    expect(clasificarMovimientoUsd('Rendimientos')).toBe('USD_YIELD');
    expect(clasificarMovimientoUsd('Tarjeta de crédito')).toBe('USD_PAYMENT');
    expect(clasificarMovimientoUsd('Venta de dólar MEP')).toBe('USD_OUT');
    expect(clasificarMovimientoUsd('Devolución de dinero (venta MEP)')).toBe('USD_IN');
    expect(clasificarMovimientoUsd('Cancelación de venta de dólar MEP')).toBe('USD_IN');
    expect(clasificarMovimientoUsd('Transferencia recibida')).toBe('USD_IN');
  });

  it('marca el lado USD de una compraventa MEP', () => {
    expect(esCompraventaMepUsd('Venta de dólar MEP')).toBe(true);
    expect(esCompraventaMepUsd('Devolución de dinero (venta MEP)')).toBe(true);
    expect(esCompraventaMepUsd('Cancelación de venta de dólar MEP')).toBe(true);
    expect(esCompraventaMepUsd('Rendimientos')).toBe(false);
    expect(esCompraventaMepUsd('Transferencia recibida')).toBe(false);
  });

  it('devuelve null si no reconoce el título (no inventa un libro)', () => {
    expect(clasificarMovimientoUsd('Algo raro')).toBeNull();
  });
});

describe('parsearActividadUsd', () => {
  it('usa "Hoy" con la fecha indicada y los encabezados para el resto', () => {
    const { movimientos, omitidos } = parsearActividadUsd(TEXTO, { hoy: '2026-11-25' });

    const yieldHoy = movimientos.find((m) => m.id === 'B33NK60DYJ9F9R24F');
    expect(yieldHoy.movementKind).toBe('USD_YIELD');
    expect(yieldHoy.monto).toBe(0.02);
    expect(yieldHoy.fecha.toISOString()).toBe('2026-11-25T05:35:00.000Z');

    const tarjeta = movimientos.find((m) => m.id === 'B33NG69RA8BYE3K6S');
    expect(tarjeta.movementKind).toBe('USD_PAYMENT');
    expect(tarjeta.monto).toBe(-18.4);
    expect(tarjeta.fecha.toISOString()).toBe('2026-11-24T14:58:00.000Z');

    const recibida = movimientos.find((m) => m.id === 'B32ZZZZZZZZZZZZZ1');
    expect(recibida.monto).toBe(2990);
    expect(recibida.movementKind).toBe('USD_IN');
    expect(recibida.fecha.getUTCFullYear()).toBe(2026);
    expect(recibida.fecha.toISOString().slice(0, 10)).toBe('2026-07-02');

    expect(omitidos).toEqual([
      expect.objectContaining({ id: 'B32ZZZZZZZZZZZZZ2', motivo: 'tipo de movimiento no reconocido' }),
      expect.objectContaining({ id: 'B32ZZZZZZZZZZZZZ3', motivo: 'sin monto en el texto' }),
    ]);
    expect(movimientos.map((m) => m.id)).not.toContain('B32ZZZZZZZZZZZZZ3');
  });

  it('omite el movimiento sin monto en el texto', () => {
    const sinMonto = `24 de noviembre\n  - [Venta de dólar MEP](https://x/movements/B33D77SHWHT3YPEFK)\n10:00\nVenta de dólar MEP\n`;
    const { movimientos, omitidos } = parsearActividadUsd(sinMonto, { hoy: '2026-11-25' });
    expect(movimientos).toEqual([]);
    expect(omitidos).toEqual([
      expect.objectContaining({ id: 'B33D77SHWHT3YPEFK', motivo: 'sin monto en el texto' }),
    ]);
  });

  it('exige la fecha de hoy si el texto la usa', () => {
    expect(() => parsearActividadUsd(TEXTO)).toThrow(/Hoy/);
  });
});

describe('importarActividadUsd', () => {
  const cuenta = 'CUENTA';
  const usuario = 'USUARIO';
  const conexionId = 'CONEXION';

  const crearColeccion = (existentes = []) => {
    const insertados = [];
    return {
      insertados,
      find: () => ({ toArray: async () => existentes }),
      findOne: async () => ({ categoria: 'Otro', moneda: 'MONEDA_USD' }),
      insertOne: async (doc) => { insertados.push(doc); return { insertedId: insertados.length }; },
    };
  };

  const movimientos = parsearActividadUsd(TEXTO, { hoy: '2026-11-25' }).movimientos;

  it('inserta sólo los movimientos que no existen y usa el ID de MP como clave', async () => {
    const coleccion = crearColeccion([{ origen: { transaccionId: 'B33NK60DYJ9F9R24F' } }]);
    const res = await importarActividadUsd(coleccion, { cuenta, usuario, conexionId, movimientos });

    expect(res.yaExistian).toBe(1);
    expect(res.insertados).toBe(movimientos.length - 1);
    expect(coleccion.insertados.map((d) => d.origen.transaccionId)).not.toContain('B33NK60DYJ9F9R24F');

    const pago = coleccion.insertados.find((d) => d.origen.transaccionId === 'B33NG69RA8BYE3K6S');
    expect(pago.tipo).toBe('EGRESO');
    expect(pago.monto).toBe(18.4);
    expect(pago.moneda).toBe('MONEDA_USD');
    expect(pago.origen.metadata).toMatchObject({
      movementKind: 'USD_PAYMENT',
      currencyId: 'USD',
      statsExclude: false,
      isInternal: false,
      source: 'usd_activity_import',
    });
  });

  it('dry run no escribe nada', async () => {
    const coleccion = crearColeccion();
    const res = await importarActividadUsd(coleccion, { cuenta, usuario, conexionId, movimientos, dryRun: true });
    expect(res.insertados).toBe(0);
    expect(res.nuevos.length).toBe(movimientos.length);
    expect(coleccion.insertados).toHaveLength(0);
  });

  it('volver a importar la misma lista no duplica', async () => {
    const coleccion = crearColeccion();
    await importarActividadUsd(coleccion, { cuenta, usuario, conexionId, movimientos });
    const yaImportados = coleccion.insertados.map((d) => ({ origen: { transaccionId: d.origen.transaccionId } }));
    const segunda = crearColeccion(yaImportados);
    const res = await importarActividadUsd(segunda, { cuenta, usuario, conexionId, movimientos });
    expect(res.insertados).toBe(0);
    expect(segunda.insertados).toHaveLength(0);
  });
});
