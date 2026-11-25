import { expandirCuotas, cuotaEnRangoClave } from '../../../../shared/utils/cuotasCredito.js';
import { normalizeActivitiesWithdrawRow } from '../mercadoPagoActivitiesService.js';
import {
  MP_MOVEMENT_KINDS,
  acumularBucketDolares,
  conservarClasificacionUsd,
  conservarClasificacionTarjeta,
  tipoDeCambioUsd,
  acumularBucketInversiones,
  applyMovementKindFilter,
  applyYieldSideFilter,
  buildLedgerMatch,
  buildListLedgerMatch,
  clasificarMovimientoEconomicoMp,
  datosPosicionUsd,
  determinarTipoMovimientoMp,
  determinarTipoPago,
  isInversionesMovementKind,
  nextHistoryChunk,
  calcularSaldosMercadoPago,
  ladoRendimientoSaldo,
  normalizeAccountMovement,
  parseHistorySince,
  resultadoFci,
} from '../mercadoPagoUtils.js';

describe('pagos que salen de un pot de la Reserva', () => {
  const pagoDesdePot = (potName, monto, potMonto = monto) => ({
    operationType: 'regular_payment',
    transactionType: 'SETTLEMENT',
    description: 'Edesur',
    netAmount: -monto,
    transaction_amount: monto,
    amounts: {
      payer: {
        transaction_source: {
          partitions: [
            { partition: 'available_for_pots', amount: potMonto, subpartition: { id: 'fdc61236-51c3-4e78-bd4f-f706e705c2c8', name: potName } },
          ],
          sources: [
            { partitions: [{ partition: 'available_for_pots', amount: potMonto, subpartition: { id: 'fdc61236-51c3-4e78-bd4f-f706e705c2c8', name: potName } }] },
          ],
        },
      },
    },
  });

  it('un pago cubierto por un pot cuenta como gasto en flujo y baja la Reserva', () => {
    const r = clasificarMovimientoEconomicoMp(pagoDesdePot('OPEX/TAX', 37328.77));
    expect(r.movementKind).toBe(MP_MOVEMENT_KINDS.RESERVE_PAYMENT);
    expect(r.statsExclude).toBe(false);
    expect(r.isInternal).toBe(false);
    expect(r.potName).toBe('OPEX/TAX');
    expect(r.potId).toBe('fdc61236-51c3-4e78-bd4f-f706e705c2c8');
    expect(buildLedgerMatch('flujo')['origen.metadata.movementKind'].$nin)
      .not.toContain(MP_MOVEMENT_KINDS.RESERVE_PAYMENT);
    expect(buildLedgerMatch('inversiones')['origen.metadata.movementKind'].$in)
      .toContain(MP_MOVEMENT_KINDS.RESERVE_PAYMENT);
    expect(acumularBucketInversiones(r.movementKind, 'EGRESO', 37328.77)).toEqual({ rescatado: 37328.77 });
  });

  it('el reporte trae el monto positivo: decide quién paga, no el signo', () => {
    const propio = clasificarMovimientoEconomicoMp({
      ...pagoDesdePot('OPEX/TAX', 37328.77),
      netAmount: 37328.77,
      userIsPayer: true,
    });
    const ajeno = clasificarMovimientoEconomicoMp({
      ...pagoDesdePot('OPEX/TAX', 37328.77),
      netAmount: 37328.77,
      userIsPayer: false,
    });
    expect(propio.movementKind).toBe(MP_MOVEMENT_KINDS.RESERVE_PAYMENT);
    expect(propio.potName).toBe('OPEX/TAX');
    expect(ajeno.movementKind).not.toBe(MP_MOVEMENT_KINDS.RESERVE_PAYMENT);
  });

  it('un pago parcialmente cubierto por el pot no se toma como salida de reserva', () => {
    const r = clasificarMovimientoEconomicoMp(pagoDesdePot('OPEX/TAX', 37328.77, 10000));
    expect(r.movementKind).not.toBe(MP_MOVEMENT_KINDS.RESERVE_PAYMENT);
    expect(r.movementKind).not.toBe(MP_MOVEMENT_KINDS.RESERVE_RELEASE);
    expect(r.potName).toBeUndefined();
  });

  it('una entrada a un pot (AM-to-POT) es reserva in con el pot como destino', () => {
    const r = clasificarMovimientoEconomicoMp({
      operationType: 'partition_transfer',
      businessBranch: 'AM-to-POT - Partition Transfer',
      netAmount: -560000,
      transaction_amount: 560000,
      amounts: {
        collector: {
          transaction_destination: {
            fund_partition: 'available_for_pots',
            subpartition: { id: '56fa79ef-ef51-4497-a9a8-120bfe897b3c', name: 'CAPEX' },
          },
        },
      },
    });
    expect(r.movementKind).toBe(MP_MOVEMENT_KINDS.RESERVE_LOCK);
    expect(r.potName).toBe('CAPEX');
    expect(r.potId).toBe('56fa79ef-ef51-4497-a9a8-120bfe897b3c');
  });

  it('un pago sin pot sigue como pago normal', () => {
    const r = clasificarMovimientoEconomicoMp({
      operationType: 'regular_payment',
      transactionType: 'SETTLEMENT',
      description: 'Edesur',
      netAmount: -37328.77,
      transaction_amount: 37328.77,
      amounts: { payer: { transaction_source: { partitions: [{ partition: 'available_money', amount: 37328.77 }] } } },
    });
    expect(r.movementKind).toBe(MP_MOVEMENT_KINDS.PAYMENT);
    expect(r.statsExclude).toBe(false);
  });
});

describe('clasificarMovimientoEconomicoMp libros', () => {
  it('distingue reserva out e in por el branch aunque el usuario sea payer y collector', () => {
    const lockPago = {
      operation_type: 'partition_transfer',
      collector_id: 7,
      payer: { id: 7 },
      transaction_amount: 125517,
      point_of_interaction: { business_info: { branch: 'AM-to-POT - Partition Transfer' } },
    };
    const releasePago = {
      operation_type: 'partition_transfer',
      collector_id: 7,
      payer: { id: 7 },
      transaction_amount: 15000,
      point_of_interaction: { business_info: { branch: 'POT-to-AM-Partition Transfer' } },
    };
    expect(determinarTipoPago(lockPago, 7)).toBe('EGRESO');
    expect(determinarTipoPago(releasePago, 7)).toBe('INGRESO');
    expect(clasificarMovimientoEconomicoMp({
      operationType: 'partition_transfer',
      businessBranch: 'AM-to-POT - Partition Transfer',
      netAmount: 125517,
    }).movementKind).toBe(MP_MOVEMENT_KINDS.RESERVE_LOCK);
    expect(clasificarMovimientoEconomicoMp({
      operationType: 'partition_transfer',
      businessBranch: 'POT-to-AM-Partition Transfer',
      netAmount: 15000,
    }).movementKind).toBe(MP_MOVEMENT_KINDS.RESERVE_RELEASE);
    expect(determinarTipoMovimientoMp({
      transactionType: 'SETTLEMENT',
      netAmount: 125517,
      payment: {
        operation_type: 'partition_transfer',
        point_of_interaction: { business_info: { branch: 'AM-to-POT - Partition Transfer' } },
      },
    })).toBe('EGRESO');
  });

  it('no convierte una salida a reserva en rescate por la etiqueta que escribimos', () => {
    const row = clasificarMovimientoEconomicoMp({
      operationType: 'partition_transfer',
      description: 'MercadoPago - Desde reserva',
      businessBranch: 'AM-to-POT - Partition Transfer',
      netAmount: -125517,
    });
    const sinBranch = clasificarMovimientoEconomicoMp({
      operationType: 'partition_transfer',
      description: 'MercadoPago - Desde reserva',
      netAmount: -125517,
    });
    expect(row.movementKind).toBe(MP_MOVEMENT_KINDS.RESERVE_LOCK);
    expect(sinBranch.movementKind).toBe(MP_MOVEMENT_KINDS.RESERVE_LOCK);
  });

  it('manda partition_transfer a reserva y fuera de transacciones', () => {
    const out = clasificarMovimientoEconomicoMp({
      operationType: 'partition_transfer',
      description: 'digital_accounts',
      netAmount: -1500,
    });
    expect(out.movementKind).toBe(MP_MOVEMENT_KINDS.RESERVE_LOCK);
    expect(out.statsExclude).toBe(true);
    expect(out.isInternal).toBe(true);
    expect(isInversionesMovementKind(out.movementKind)).toBe(true);
    expect(buildLedgerMatch('flujo')['origen.metadata.movementKind'].$nin)
      .toContain(MP_MOVEMENT_KINDS.RESERVE_LOCK);
  });

  it('separa asset management de la reserva', () => {
    const deposit = clasificarMovimientoEconomicoMp({
      description: 'asset_management_deposit',
      netAmount: -800,
    });
    const withdrawal = clasificarMovimientoEconomicoMp({
      description: 'asset_management_withdrawal',
      netAmount: 800,
    });
    expect(deposit.movementKind).toBe(MP_MOVEMENT_KINDS.INVESTMENT_IN);
    expect(withdrawal.movementKind).toBe(MP_MOVEMENT_KINDS.INVESTMENT_OUT);
    expect(deposit.statsExclude).toBe(true);
    expect(withdrawal.statsExclude).toBe(true);
  });

  it('manda rendimientos al libro inversiones', () => {
    const gain = clasificarMovimientoEconomicoMp({
      description: 'asset_management_gain',
      netAmount: 40,
    });
    const texto = clasificarMovimientoEconomicoMp({
      description: 'Rendimiento de reserva',
      netAmount: 12,
    });
    expect(gain.movementKind).toBe(MP_MOVEMENT_KINDS.INVESTMENT_YIELD);
    expect(texto.movementKind).toBe(MP_MOVEMENT_KINDS.INVESTMENT_YIELD);
    expect(gain.statsExclude).toBe(true);
    expect(isInversionesMovementKind(gain.movementKind)).toBe(true);
  });

  it('deja el cashback promocional en el flujo', () => {
    const cashback = clasificarMovimientoEconomicoMp({
      transactionType: 'CASHBACK',
      description: 'Beneficio de compra',
      netAmount: 500,
    });
    expect(cashback.movementKind).toBe(MP_MOVEMENT_KINDS.CASHBACK);
    expect(cashback.statsExclude).toBe(false);
    expect(isInversionesMovementKind(cashback.movementKind)).toBe(false);
  });

  it('deja digital_accounts en la reserva y digital_accounts_cards en el flujo', () => {
    const reserva = clasificarMovimientoEconomicoMp({
      transactionType: 'MONEY_TRANSFER',
      operationType: 'money_transfer',
      description: 'Varios',
      metadata: { counterpartyName: 'digital_accounts' },
      netAmount: -5500,
    });
    const tarjeta = clasificarMovimientoEconomicoMp({
      transactionType: 'MONEY_TRANSFER',
      operationType: 'money_transfer',
      description: 'Varios',
      metadata: { counterpartyName: 'digital_accounts_cards' },
      netAmount: -5500,
    });
    expect(reserva.movementKind).toBe(MP_MOVEMENT_KINDS.RESERVE_LOCK);
    expect(reserva.statsExclude).toBe(true);
    expect(tarjeta.movementKind).toBe(MP_MOVEMENT_KINDS.P2P_TRANSFER);
    expect(tarjeta.statsExclude).toBe(false);
  });

  it('clasifica operation_type investment por el signo', () => {
    const out = clasificarMovimientoEconomicoMp({
      operationType: 'investment',
      transactionType: 'SETTLEMENT',
      netAmount: 500,
    });
    const inn = clasificarMovimientoEconomicoMp({
      operationType: 'investment',
      netAmount: -500,
    });
    expect(out.movementKind).toBe(MP_MOVEMENT_KINDS.INVESTMENT_OUT);
    expect(inn.movementKind).toBe(MP_MOVEMENT_KINDS.INVESTMENT_IN);
    expect(out.statsExclude).toBe(true);
  });

  it('una venta de dólares no es un rescate de inversión', () => {
    const venta = clasificarMovimientoEconomicoMp({
      operationType: 'investment',
      transactionType: 'SETTLEMENT',
      netAmount: 891581.9,
      exchange_operation: 'SELL',
      amounts: { payer: { currency_id: 'USD', transaction: 587.75 } },
    });
    expect(venta.movementKind).toBe(MP_MOVEMENT_KINDS.FX_SELL);
    const ventaSinPago = clasificarMovimientoEconomicoMp({
      transactionType: 'SETTLEMENT',
      operationType: 'investment',
      exchangeOperation: 'SELL',
      payerCurrency: 'USD',
      collectorCurrency: 'ARS',
      usdAmount: 195.36,
      netAmount: 291712,
    });
    expect(ventaSinPago.movementKind).toBe(MP_MOVEMENT_KINDS.FX_SELL);
    expect(venta.statsExclude).toBe(true);
    expect(determinarTipoPago({
      operation_type: 'investment',
      exchange_operation: 'SELL',
      amounts: { payer: { currency_id: 'USD', transaction: 587.75 } },
      payer: { id: 1 },
      collector: { id: 1 },
    }, 1)).toBe('INGRESO');
  });

  it('la suscripción a un fondo sigue siendo inversión aunque el cambio diga BUY', () => {
    const fondo = clasificarMovimientoEconomicoMp({
      operationType: 'investment',
      businessBranch: 'Marketplace de inversiones',
      exchange_operation: 'BUY',
      point_of_interaction: {
        sub_type: 'SUBSCRIPTION',
        transaction_data: { destination_asset: 'FMAH' },
      },
      netAmount: 266579,
    });
    expect(fondo.movementKind).toBe(MP_MOVEMENT_KINDS.INVESTMENT_IN);
  });

  it('el pago al marketplace de inversiones sale de la cuenta aunque el monto venga positivo', () => {
    const suscripcion = clasificarMovimientoEconomicoMp({
      operationType: 'investment',
      businessBranch: 'Marketplace de inversiones',
      paymentMethod: 'account_money',
      netAmount: 266579,
    });
    expect(suscripcion.movementKind).toBe(MP_MOVEMENT_KINDS.INVESTMENT_IN);
    expect(determinarTipoPago({
      operation_type: 'investment',
      payment_method_id: 'account_money',
      point_of_interaction: { business_info: { branch: 'Marketplace de inversiones' } },
      payer: { id: 1 },
      collector: { id: 1 },
    }, 1)).toBe('EGRESO');
  });

  it('no mueve pagos ni transferencias reales', () => {
    const pago = clasificarMovimientoEconomicoMp({
      transactionType: 'SETTLEMENT',
      operationType: 'regular_payment',
      paymentMethod: 'account_money',
      description: 'Supermercado',
      netAmount: 2000,
    });
    const ingreso = clasificarMovimientoEconomicoMp({
      operationType: 'account_fund',
      transactionType: 'ACCOUNT_FUND',
      netAmount: 10000,
    });
    expect(pago.movementKind).toBe(MP_MOVEMENT_KINDS.PAYMENT);
    expect(ingreso.movementKind).toBe(MP_MOVEMENT_KINDS.P2P_TRANSFER);
    expect(pago.statsExclude).toBe(false);
    expect(ingreso.statsExclude).toBe(false);
  });

  it('un pago con branch de reserva baja la reserva y no entra a transacciones', () => {
    const vuelta = clasificarMovimientoEconomicoMp({
      transactionType: 'SETTLEMENT',
      operationType: 'regular_payment',
      businessBranch: 'POT-to-AM-Partition Transfer',
      description: 'Supermercado',
      netAmount: 2000,
    });
    const pago = clasificarMovimientoEconomicoMp({
      transactionType: 'SETTLEMENT',
      operationType: 'regular_payment',
      description: 'Supermercado',
      netAmount: -2000,
    });
    expect(vuelta.movementKind).toBe(MP_MOVEMENT_KINDS.RESERVE_RELEASE);
    expect(vuelta.statsExclude).toBe(true);
    expect(buildLedgerMatch('inversiones')['origen.metadata.movementKind'].$in)
      .toContain(MP_MOVEMENT_KINDS.RESERVE_RELEASE);
    expect(buildLedgerMatch('flujo')['origen.metadata.movementKind'].$nin)
      .toContain(MP_MOVEMENT_KINDS.RESERVE_RELEASE);
    expect(pago.movementKind).toBe(MP_MOVEMENT_KINDS.PAYMENT);
    expect(pago.statsExclude).toBe(false);
  });
});

describe('buildLedgerMatch', () => {
  it('el flujo excluye inversiones y el listado deja ver ajustes internos', () => {
    const flujo = buildLedgerMatch('flujo');
    const listado = buildListLedgerMatch('flujo');
    expect(flujo['origen.metadata.movementKind'].$nin).toEqual(
      expect.arrayContaining(['RESERVE_LOCK', 'RESERVE_RELEASE', 'INVESTMENT_YIELD', 'INTERNAL', 'YIELD'])
    );
    expect(listado['origen.metadata.movementKind'].$nin).toEqual(
      expect.arrayContaining(['INVESTMENT_IN', 'RESERVE_RELEASE'])
    );
    expect(listado['origen.metadata.movementKind'].$nin).not.toContain('INTERNAL');
    expect(listado['origen.metadata.statsExclude']).toBeUndefined();
  });

  it('el libro dólares queda afuera del flujo y de inversiones', () => {
    const dolares = buildLedgerMatch('dolares');
    expect(dolares['origen.metadata.movementKind'].$in).toEqual([
      'FX_SELL', 'FX_BUY', 'USD_IN', 'USD_OUT', 'USD_PAYMENT', 'USD_YIELD',
    ]);
    expect(buildLedgerMatch('flujo')['origen.metadata.movementKind'].$nin).toEqual(
      expect.arrayContaining(['FX_SELL', 'FX_BUY'])
    );
    expect(buildListLedgerMatch('flujo')['origen.metadata.movementKind'].$nin).toEqual(
      expect.arrayContaining(['FX_SELL'])
    );
    expect(buildLedgerMatch('inversiones')['origen.metadata.movementKind'].$in).not.toContain('FX_SELL');
    expect(acumularBucketDolares('FX_SELL', 891581.9, 587.75)).toEqual({
      usdVendido: 587.75,
      pesosVenta: 891581.9,
    });
    expect(acumularBucketDolares('USD_IN', 2990, 2990)).toEqual({ usdRecibido: 2990 });
    expect(acumularBucketDolares('USD_PAYMENT', 40, 40)).toEqual({ usdPagado: 40 });
    expect(acumularBucketDolares('USD_YIELD', 0.02, 0, 0.02)).toEqual({ usdRendimientos: 0.02 });
    // El lado USD de una venta MEP ya está en FX_SELL: no se suma dos veces.
    expect(acumularBucketDolares('USD_OUT', 100, 0, 100, true)).toEqual({});
    expect(acumularBucketDolares('USD_IN', 57.86, 0, 57.86, true)).toEqual({});
    // El grupo mezclado no pierde filas: la cantidad es la de la fila (face).
    expect(acumularBucketDolares('USD_OUT', 2946, 0, 2946)).toEqual({ usdEnviado: 2946 });
    const recibido = clasificarMovimientoEconomicoMp({
      operationType: 'account_fund',
      paymentMethod: 'bank_transfer',
      paymentMethodId: 'cvu',
      currency: 'USD',
      transaction_amount: 2990,
      netAmount: 2990,
    });
    expect(recibido.movementKind).toBe('USD_IN');
    expect(recibido.statsExclude).toBe(true);
    const pagoUsd = clasificarMovimientoEconomicoMp({
      operationType: 'regular_payment',
      paymentMethodType: 'debit_card',
      currency: 'USD',
      transaction_amount: 40,
      netAmount: -40,
    });
    expect(pagoUsd.movementKind).toBe('USD_PAYMENT');
    const masterUsd = clasificarMovimientoEconomicoMp({
      operationType: 'regular_payment',
      paymentMethod: 'credit_card',
      paymentMethodType: 'credit_card',
      paymentMethodId: 'master',
      currency: 'ARS',
      amounts: {
        payer: { currency_id: 'USD', transaction: 42.5 },
        collector: { currency_id: 'ARS', transaction: 52000 },
      },
      transaction_amount: 52000,
      netAmount: 52000,
    });
    expect(masterUsd.movementKind).toBe('USD_PAYMENT');
    expect(masterUsd.statsExclude).toBe(true);
    expect(datosPosicionUsd({
      operationType: 'regular_payment',
      paymentMethodId: 'master',
      payment_type_id: 'credit_card',
      currency_id: 'ARS',
      amounts: {
        payer: { currency_id: 'USD', transaction: 42.5 },
        collector: { currency_id: 'ARS', transaction: 52000 },
      },
      transaction_amount: 52000,
      netAmount: 52000,
    })).toEqual({ movementKind: 'USD_PAYMENT', usdAmount: 42.5, currency: 'USD' });
    const masterMonedaUsd = clasificarMovimientoEconomicoMp({
      operationType: 'regular_payment',
      paymentMethodId: 'master',
      currency: 'USD',
      transaction_amount: 18,
      netAmount: 18,
    });
    expect(masterMonedaUsd.movementKind).toBe('USD_PAYMENT');
    const masterContraparte = clasificarMovimientoEconomicoMp({
      operationType: 'regular_payment',
      paymentMethodId: 'master',
      paymentMethodType: 'credit_card',
      currency: 'ARS',
      counter_currency: { currency_id: 'USD', amount: 42.5 },
      transaction_amount: 52000,
      netAmount: -52000,
    });
    expect(masterContraparte.movementKind).toBe('USD_PAYMENT');
    expect(datosPosicionUsd({
      operationType: 'regular_payment',
      payment_method_id: 'master',
      payment_type_id: 'credit_card',
      currency_id: 'ARS',
      counter_currency: { currency_id: 'USD', amount: 42.5 },
      transaction_amount: 52000,
    })).toEqual({ movementKind: 'USD_PAYMENT', usdAmount: 42.5, currency: 'USD' });
    const enviado = clasificarMovimientoEconomicoMp({
      operationType: 'money_transfer',
      currency: 'USD',
      transaction_amount: 100,
      netAmount: -100,
    });
    expect(enviado.movementKind).toBe('USD_OUT');
    expect(tipoDeCambioUsd('FX_SELL')).toBe('INGRESO');
    expect(tipoDeCambioUsd('FX_BUY')).toBe('EGRESO');
    const kept = conservarClasificacionUsd(
      { movementKind: 'FX_SELL', usdAmount: 587.75, exchangeOperation: 'SELL' },
      { movementKind: 'INVESTMENT_OUT', statsExclude: true }
    );
    expect(kept.movementKind).toBe('FX_SELL');
    expect(kept.usdAmount).toBe(587.75);
  });

  it('una compra con tarjeta sale del flujo y un cobro con tarjeta se queda', () => {
    const compra = clasificarMovimientoEconomicoMp({
      operationType: 'regular_payment',
      paymentMethod: 'credit_card',
      paymentMethodType: 'credit_card',
      netAmount: -21315,
    });
    const cobro = clasificarMovimientoEconomicoMp({
      transactionType: 'SETTLEMENT',
      operationType: 'regular_payment',
      paymentMethod: 'credit_card',
      paymentMethodType: 'credit_card',
      netAmount: 95996,
    });
    const validacion = clasificarMovimientoEconomicoMp({
      operationType: 'card_validation',
      paymentMethod: 'credit_card',
      netAmount: -1,
    });
    expect(compra.movementKind).toBe('CARD_PURCHASE');
    expect(compra.statsExclude).toBe(true);
    expect(cobro.movementKind).toBe('PAYMENT');
    expect(cobro.statsExclude).toBe(false);
    expect(validacion.movementKind).not.toBe('CARD_PURCHASE');
    const visa = clasificarMovimientoEconomicoMp({
      operationType: 'regular_payment',
      paymentMethod: 'visa',
      paymentMethodId: 'visa',
      netAmount: -1500,
    });
    const debito = clasificarMovimientoEconomicoMp({
      operationType: 'regular_payment',
      paymentMethod: 'debvisa',
      paymentMethodType: 'debit_card',
      paymentMethodId: 'debvisa',
      netAmount: -1500,
    });
    const prepaga = clasificarMovimientoEconomicoMp({
      operationType: 'regular_payment',
      paymentMethod: 'master',
      paymentMethodType: 'prepaid_card',
      paymentMethodId: 'master',
      netAmount: -4200,
    });
    expect(visa.movementKind).toBe('CARD_PURCHASE');
    expect(debito.movementKind).not.toBe('CARD_PURCHASE');
    expect(prepaga.movementKind).toBe('PAYMENT');
    expect(prepaga.statsExclude).toBe(false);
    expect(buildLedgerMatch('creditos')['origen.metadata.movementKind'].$in).toEqual(['CARD_PURCHASE']);
    expect(buildLedgerMatch('flujo')['origen.metadata.movementKind'].$nin).toEqual(
      expect.arrayContaining(['CARD_PURCHASE'])
    );
    expect(buildListLedgerMatch('flujo')['origen.metadata.movementKind'].$nin).toEqual(
      expect.arrayContaining(['CARD_PURCHASE'])
    );
    const kept = conservarClasificacionTarjeta(
      { movementKind: 'CARD_PURCHASE', installments: 6, installmentAmount: 100 },
      { movementKind: 'PAYMENT', statsExclude: false }
    );
    expect(kept.movementKind).toBe('CARD_PURCHASE');
    expect(kept.installments).toBe(6);
    const pasoADolares = conservarClasificacionTarjeta(
      { movementKind: 'CARD_PURCHASE', installments: 1 },
      { movementKind: 'USD_PAYMENT', statsExclude: true, usdAmount: 42.5 }
    );
    expect(pasoADolares.movementKind).toBe('USD_PAYMENT');
    expect(pasoADolares.usdAmount).toBe(42.5);
    const cuotas = expandirCuotas({
      fecha: new Date('2026-09-09T15:00:00.000-03:00'),
      monto: 300,
      installments: 3,
      installmentAmount: 100,
    });
    expect(cuotas.map((cuota) => cuota.due.toISOString().slice(0, 10))).toEqual([
      '2026-09-09',
      '2026-10-09',
      '2026-11-09',
    ]);
    expect(cuotaEnRangoClave(cuotas[2].due, '2026-11-25', '2026-12-31')).toBe(false);
    expect(cuotaEnRangoClave(cuotas[1].due, '2026-01-01', '2026-11-24')).toBe(true);
  });

  it('el libro inversiones incluye reserva, inversión y rendimiento viejo', () => {
    const match = buildLedgerMatch('inversiones');
    expect(match['origen.metadata.movementKind'].$in).toEqual(
      expect.arrayContaining([
        'RESERVE_LOCK',
        'RESERVE_RELEASE',
        'INVESTMENT_IN',
        'INVESTMENT_OUT',
        'INVESTMENT_YIELD',
        'YIELD',
      ])
    );
  });

  it('manda el crédito settlement sin medio ni comercio a rendimiento', () => {
    const yieldRow = clasificarMovimientoEconomicoMp({
      transactionType: 'SETTLEMENT',
      description: '',
      netAmount: 41.14,
    });
    const transferencia = clasificarMovimientoEconomicoMp({
      transactionType: 'SETTLEMENT',
      paymentMethodType: 'bank_transfer',
      description: '',
      netAmount: 1375000,
    });
    const salida = clasificarMovimientoEconomicoMp({
      transactionType: 'SETTLEMENT',
      description: '',
      netAmount: -554323,
    });
    expect(yieldRow.movementKind).toBe(MP_MOVEMENT_KINDS.INVESTMENT_YIELD);
    expect(yieldRow.statsExclude).toBe(true);
    expect(isInversionesMovementKind(yieldRow.movementKind)).toBe(true);
    expect(transferencia.movementKind).toBe(MP_MOVEMENT_KINDS.PAYMENT);
    expect(salida.movementKind).toBe(MP_MOVEMENT_KINDS.PAYMENT);
  });

  it('deja el settlement available_money sin comercio en el flujo como pago', () => {
    const gasto = clasificarMovimientoEconomicoMp({
      transactionType: 'SETTLEMENT',
      paymentMethodType: 'available_money',
      description: '',
      netAmount: -700000,
    });
    const credito = clasificarMovimientoEconomicoMp({
      transactionType: 'SETTLEMENT',
      metadata: { paymentMethodType: 'available_money' },
      netAmount: 40000,
    });
    const comercio = clasificarMovimientoEconomicoMp({
      transactionType: 'SETTLEMENT',
      paymentMethodType: 'available_money',
      description: 'Edesur',
      metadata: { counterpartyName: 'Edesur' },
      netAmount: -2000,
    });
    expect(gasto.movementKind).toBe(MP_MOVEMENT_KINDS.PAYMENT);
    expect(gasto.statsExclude).toBe(false);
    expect(credito.movementKind).toBe(MP_MOVEMENT_KINDS.PAYMENT);
    expect(comercio.movementKind).toBe(MP_MOVEMENT_KINDS.PAYMENT);
  });

  it('trata el pase a tu reserva como movimiento manual, no como rendimiento', () => {
    const lock = clasificarMovimientoEconomicoMp({
      description: 'Envío a tu reserva',
      netAmount: -20000,
    });
    const release = clasificarMovimientoEconomicoMp({
      description: 'Desde tu reserva',
      netAmount: 20000,
    });
    const yieldCuenta = clasificarMovimientoEconomicoMp({
      description: 'Rendimiento de tu dinero',
      netAmount: 18,
    });
    expect(lock.movementKind).toBe(MP_MOVEMENT_KINDS.RESERVE_LOCK);
    expect(release.movementKind).toBe(MP_MOVEMENT_KINDS.RESERVE_RELEASE);
    expect(yieldCuenta.movementKind).toBe(MP_MOVEMENT_KINDS.INVESTMENT_YIELD);
    expect(isInversionesMovementKind(lock.movementKind)).toBe(true);
  });

  it('recorta el libro a los kinds marcados', () => {
    const flujo = buildListLedgerMatch('flujo');
    applyMovementKindFilter(flujo, 'flujo', 'PAYMENT,RESERVE_LOCK');
    expect(flujo['origen.metadata.movementKind'].$in).toEqual(['PAYMENT']);
    expect(flujo['origen.metadata.movementKind'].$nin).toEqual(
      expect.arrayContaining(['RESERVE_LOCK'])
    );

    const inversiones = buildLedgerMatch('inversiones');
    applyMovementKindFilter(inversiones, 'inversiones', 'none');
    expect(inversiones['origen.metadata.movementKind'].$in).toEqual([]);
  });

  it('el lado del rendimiento no se lleva la reserva in ni la reserva out', () => {
    const reserva = buildLedgerMatch('inversiones');
    applyMovementKindFilter(reserva, 'inversiones', 'RESERVE_LOCK,RESERVE_RELEASE,INVESTMENT_YIELD,YIELD');
    applyYieldSideFilter(reserva, 'reserva');
    const clause = reserva.$and[0].$or;
    expect(clause[0]['origen.metadata.movementKind'].$nin).toEqual(
      expect.arrayContaining(['INVESTMENT_YIELD', 'YIELD'])
    );
    expect(clause[1].$and[1].$nor).toBeTruthy();

    const fondo = {};
    applyYieldSideFilter(fondo, 'inversion');
    expect(fondo.$and[0].$or[1].$and[1].$or.length).toBeGreaterThan(0);
    applyYieldSideFilter(fondo, 'otra');
    expect(fondo.$and).toHaveLength(1);
  });

  it('compara la reserva consigo misma y deja el rescate de inversión aparte', () => {
    expect(acumularBucketInversiones('RESERVE_LOCK', 'EGRESO', 100)).toEqual({ enviado: 100 });
    expect(acumularBucketInversiones('RESERVE_RELEASE', 'INGRESO', 60)).toEqual({ rescatado: 60 });
    expect(acumularBucketInversiones('RESERVE_PAYMENT', 'EGRESO', 45)).toEqual({ rescatado: 45 });
    expect(acumularBucketInversiones('INVESTMENT_IN', 'EGRESO', 80)).toEqual({ ingresado: 80 });
    expect(acumularBucketInversiones('INVESTMENT_OUT', 'INGRESO', 40)).toEqual({ rescatadoInversion: 40 });
    expect(acumularBucketInversiones('INVESTMENT_YIELD', 'INGRESO', 5)).toEqual({ rendimientosReserva: 5 });
    expect(acumularBucketInversiones('INVESTMENT_YIELD', 'EGRESO', 2)).toEqual({ rendimientosReserva: -2 });
    expect(acumularBucketInversiones('INVESTMENT_YIELD', 'INGRESO', 7, 'inversion')).toEqual({ rendimientosInversion: 7 });
    expect(resultadoFci({
      ingresado: 80,
      rescatadoInversion: 40,
      rendimientos: 5,
    })).toBe(80 - 40 + 5);
    expect(resultadoFci({
      enviado: 100,
      rescatado: 60,
      ingresado: 80,
      rescatadoInversion: 40,
      rendimientos: 5,
    })).toBe((100 - 60) + (80 - 40) + 5);
  });
});

describe('signo de transferencias CBU', () => {
  const userId = 100;

  it('marca como ingreso el fondeo desde un CBU aunque el usuario sea el payer', () => {
    expect(determinarTipoPago({
      operation_type: 'account_fund',
      payment_method_id: 'debin_transfer',
      collector_id: 999,
      payer: { id: userId },
      transaction_amount: 15000,
    }, userId)).toBe('INGRESO');
  });

  it('marca como ingreso un DEBIN recibido cuando el usuario es collector', () => {
    expect(determinarTipoPago({
      operation_type: 'money_transfer',
      payment_method_id: 'debin_transfer',
      collector_id: userId,
      payer: { id: 555 },
    }, userId)).toBe('INGRESO');
  });

  it('marca como egreso la salida CVU hacia otro CBU', () => {
    expect(determinarTipoPago({
      operation_type: 'withdrawal',
      payment_method_id: 'bank_transfer',
      collector_id: 999,
      payer: { id: userId },
    }, userId)).toBe('EGRESO');
    expect(determinarTipoPago({
      operation_type: 'money_transfer',
      payment_type_id: 'bank_transfer',
      collector: { id: 999 },
      payer: { id: userId },
    }, userId)).toBe('EGRESO');
  });

  it('no deja un crédito de settlement en negativo por un pago marcado como payer', () => {
    expect(determinarTipoMovimientoMp({
      transactionType: 'SETTLEMENT',
      netAmount: 8000,
      paymentMethod: 'debin_transfer',
      payment: {
        operation_type: 'money_transfer',
        payment_method_id: 'debin_transfer',
        collector_id: 999,
        payer: { id: userId },
      },
    }, userId)).toBe('INGRESO');
  });

  it('mantiene negativa una salida PAYOUT aunque el CSV traiga el monto en positivo', () => {
    expect(determinarTipoMovimientoMp({
      transactionType: 'PAYOUTS',
      netAmount: 12000,
      paymentMethod: 'bank_transfer',
    })).toBe('EGRESO');
    expect(determinarTipoMovimientoMp({
      transactionType: 'WITHDRAWAL',
      netAmount: -12000,
    })).toBe('EGRESO');
  });

  it('anula un retiro como ingreso', () => {
    expect(determinarTipoMovimientoMp({
      transactionType: 'WITHDRAWAL_CANCEL',
      netAmount: -4000,
    })).toBe('INGRESO');
  });

  it('no niega un fondeo que viene en el reporte de retiros', () => {
    const row = normalizeActivitiesWithdrawRow({
      OPERATION_ID: 'abc',
      OPERATION_TYPE: 'account_fund',
      NET_RECEIVED_AMOUNT: 9000,
      BANK_ACCOUNT: '00000031000',
    });
    expect(row.netAmount).toBeGreaterThan(0);
    expect(determinarTipoMovimientoMp(row)).toBe('INGRESO');
  });

  it('sigue marcando negativo el retiro a otro CBU del reporte de activities', () => {
    const row = normalizeActivitiesWithdrawRow({
      OPERATION_ID: 'def',
      OPERATION_TYPE: 'withdrawal',
      NET_RECEIVED_AMOUNT: 9000,
      BANK_ACCOUNT: '00000031000',
      COUNTERPART_NAME: 'Otra cuenta',
    });
    expect(row.netAmount).toBeLessThan(0);
    expect(row.transactionType).toBe('BANK_TRANSFER');
    expect(determinarTipoMovimientoMp(row)).toBe('EGRESO');
  });

  it('no trata un retiro de account movements como crédito por el substring in', () => {
    const row = normalizeAccountMovement({
      id: 'mov-1',
      amount: 5000,
      type: 'withdrawal',
      detail: 'Transferencia a CBU',
    });
    expect(row.netAmount).toBeLessThan(0);
    expect(determinarTipoMovimientoMp(row)).toBe('EGRESO');
  });
});

describe('nextHistoryChunk', () => {
  const now = new Date('2026-11-24T15:00:00.000Z');

  it('pide un tramo de 58 días anterior a la ventana de 90 días anclado al inicio del día AR', () => {
    const chunk = nextHistoryChunk({ targetSince: '2025-01-01', now, syncDays: 90 });
    expect(chunk.endDate).toBe('2026-08-26T03:00:00.000Z');
    const spanDays = (new Date(chunk.endDate).getTime() - new Date(chunk.beginDate).getTime()) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBe(58);
    expect(chunk.quedaHistorial).toBe(true);
  });

  it('reintenta las mismas fechas cuando hay un tramo pendiente', () => {
    const pendingRange = {
      beginDate: '2026-07-01T03:00:00.000Z',
      endDate: '2026-08-26T03:00:00.000Z',
    };
    const chunk = nextHistoryChunk({ targetSince: '2025-01-01', pendingRange, now, syncDays: 90 });
    expect(chunk.beginDate).toBe(pendingRange.beginDate);
    expect(chunk.endDate).toBe(pendingRange.endDate);
  });

  it('el cursor solo retrocede y no vuelve a cubrir lo ya pedido', () => {
    const first = nextHistoryChunk({ targetSince: '2025-01-01', now, syncDays: 90 });
    const second = nextHistoryChunk({
      targetSince: '2025-01-01',
      coveredUntil: first.beginDate,
      now,
      syncDays: 90,
    });
    expect(second.endDate).toBe(first.beginDate);
    expect(new Date(second.beginDate).getTime()).toBeLessThan(new Date(first.beginDate).getTime());
  });

  it('no pide nada si la fecha ya entra en los últimos 90 días', () => {
    expect(nextHistoryChunk({ targetSince: '2026-11-01', now, syncDays: 90 })).toBeNull();
  });

  it('recorta el último tramo al objetivo y lo marca como cierre', () => {
    const covered = new Date('2025-01-20T03:00:00.000Z');
    const chunk = nextHistoryChunk({
      targetSince: '2025-01-01',
      coveredUntil: covered.toISOString(),
      now,
    });
    expect(chunk.beginDate).toBe(parseHistorySince('2025-01-01').toISOString());
    expect(chunk.endDate).toBe(covered.toISOString());
    expect(chunk.quedaHistorial).toBe(false);
  });
});

describe('saldos acumulados de la cuenta Mercado Pago', () => {
  const ARS = 'ars';
  const fila = (kind, tipo, total, extra = {}) => ({
    _id: {
      kind, tipo, moneda: ARS, compraventa: false, flujo: false, side: 'cuenta', ...extra.id,
    },
    total,
    usd: extra.usd || 0,
    face: extra.face || 0,
  });

  it('reparte el rendimiento entre cuenta, reserva e inversión según el texto', () => {
    expect(ladoRendimientoSaldo('')).toBe('reserva');
    expect(ladoRendimientoSaldo('MercadoPago - Rendimiento')).toBe('reserva');
    expect(ladoRendimientoSaldo('Rendimiento de tu dinero')).toBe('cuenta');
    expect(ladoRendimientoSaldo('Rendimiento dinero en cuenta')).toBe('cuenta');
    expect(ladoRendimientoSaldo('Rendimiento de reserva')).toBe('reserva');
    expect(ladoRendimientoSaldo('asset_management_gain')).toBe('inversion');
    expect(ladoRendimientoSaldo('Rendimiento de reserva en fondo de inversión')).toBe('inversion');
  });

  it('dinero en cuenta: caja más rendimiento propio, sin lo que fue a reserva o fondo', () => {
    const rows = [
      fila('PAYMENT', 'INGRESO', 1000, { id: { flujo: true } }),
      fila('PAYMENT', 'EGRESO', 300, { id: { flujo: true } }),
      fila('RESERVE_LOCK', 'EGRESO', 200),
      fila('RESERVE_RELEASE', 'INGRESO', 50),
      fila('INVESTMENT_IN', 'EGRESO', 100),
      fila('INVESTMENT_OUT', 'INGRESO', 40),
      fila('INVESTMENT_YIELD', 'INGRESO', 5, { id: { side: 'cuenta' } }),
    ];
    expect(calcularSaldosMercadoPago(rows, { monedaPesosId: ARS }).dineroEnCuenta)
      .toBe(1000 - 300 - 200 + 50 - 100 + 40 + 5);
  });

  it('un pago desde reserva baja el reservado y no la cuenta', () => {
    const rows = [
      fila('PAYMENT', 'INGRESO', 1000, { id: { flujo: true } }),
      fila('RESERVE_LOCK', 'EGRESO', 400),
      fila('RESERVE_PAYMENT', 'EGRESO', 90, { id: { flujo: true } }),
    ];
    const saldos = calcularSaldosMercadoPago(rows, { monedaPesosId: ARS });
    expect(saldos.dineroEnCuenta).toBe(1000 - 90 - 400 + 90);
    expect(saldos.reservado).toBe(400 - 90);
  });

  it('reservado e invertido suman su propio rendimiento', () => {
    const rows = [
      fila('RESERVE_LOCK', 'EGRESO', 400),
      fila('RESERVE_RELEASE', 'INGRESO', 100),
      fila('INVESTMENT_YIELD', 'INGRESO', 12, { id: { side: 'reserva' } }),
      fila('INVESTMENT_IN', 'EGRESO', 500),
      fila('INVESTMENT_OUT', 'INGRESO', 200),
      fila('INVESTMENT_YIELD', 'INGRESO', 30, { id: { side: 'inversion' } }),
      fila('INVESTMENT_YIELD', 'EGRESO', 4, { id: { side: 'inversion' } }),
    ];
    const saldos = calcularSaldosMercadoPago(rows, { monedaPesosId: ARS });
    expect(saldos.reservado).toBe(400 - 100 + 12);
    expect(saldos.invertido).toBe(500 - 200 + 30 - 4);
    expect(saldos.rendimientos).toBe(12 + 30 - 4);
  });

  it('dólares: compraventa, movimientos y rendimiento, y pesos de la compraventa en la cuenta', () => {
    const rows = [
      fila('FX_BUY', 'EGRESO', 130000, { usd: 100 }),
      fila('FX_SELL', 'INGRESO', 26000, { usd: 20 }),
      fila('USD_IN', 'INGRESO', 10, { face: 10, id: { moneda: 'usd' } }),
      fila('USD_PAYMENT', 'EGRESO', 5, { face: 5, id: { moneda: 'usd' } }),
      fila('USD_YIELD', 'INGRESO', 0.5, { face: 0.5, id: { moneda: 'usd' } }),
    ];
    const saldos = calcularSaldosMercadoPago(rows, { monedaPesosId: ARS });
    expect(saldos.dolares).toBeCloseTo(100 - 20 + 10 - 5 + 0.5, 6);
    expect(saldos.dineroEnCuenta).toBe(26000 - 130000);
  });
});