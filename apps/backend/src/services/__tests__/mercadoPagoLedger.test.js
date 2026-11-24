import { normalizeActivitiesWithdrawRow } from '../mercadoPagoActivitiesService.js';
import {
  MP_MOVEMENT_KINDS,
  acumularBucketInversiones,
  buildLedgerMatch,
  buildListLedgerMatch,
  clasificarMovimientoEconomicoMp,
  determinarTipoMovimientoMp,
  determinarTipoPago,
  isInversionesMovementKind,
  nextHistoryChunk,
  normalizeAccountMovement,
  parseHistorySince,
} from '../mercadoPagoUtils.js';

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

  it('manda partition_transfer a reserva y fuera del flujo', () => {
    const out = clasificarMovimientoEconomicoMp({
      operationType: 'partition_transfer',
      description: 'digital_accounts',
      netAmount: -1500,
    });
    expect(out.movementKind).toBe(MP_MOVEMENT_KINDS.RESERVE_LOCK);
    expect(out.statsExclude).toBe(true);
    expect(isInversionesMovementKind(out.movementKind)).toBe(true);
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

  it('trata digital_accounts_cards como reserva aunque el tipo sea money_transfer', () => {
    const lock = clasificarMovimientoEconomicoMp({
      transactionType: 'MONEY_TRANSFER',
      operationType: 'money_transfer',
      description: 'Varios',
      metadata: { counterpartyName: 'digital_accounts_cards' },
      netAmount: -5500,
    });
    expect(lock.movementKind).toBe(MP_MOVEMENT_KINDS.RESERVE_LOCK);
    expect(lock.statsExclude).toBe(true);
  });

  it('clasifica operation_type investment por el signo', () => {
    const out = clasificarMovimientoEconomicoMp({
      operationType: 'investment',
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
});

describe('buildLedgerMatch', () => {
  it('el flujo excluye inversiones y el listado deja ver ajustes internos', () => {
    const flujo = buildLedgerMatch('flujo');
    const listado = buildListLedgerMatch('flujo');
    expect(flujo['origen.metadata.movementKind'].$nin).toEqual(
      expect.arrayContaining(['RESERVE_LOCK', 'INVESTMENT_YIELD', 'INTERNAL', 'YIELD'])
    );
    expect(listado['origen.metadata.movementKind'].$nin).toEqual(
      expect.arrayContaining(['INVESTMENT_IN', 'RESERVE_RELEASE'])
    );
    expect(listado['origen.metadata.movementKind'].$nin).not.toContain('INTERNAL');
    expect(listado['origen.metadata.statsExclude']).toBeUndefined();
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

  it('compara la reserva consigo misma y deja el rescate de inversión aparte', () => {
    expect(acumularBucketInversiones('RESERVE_LOCK', 'EGRESO', 100)).toEqual({ enviado: 100 });
    expect(acumularBucketInversiones('RESERVE_RELEASE', 'INGRESO', 60)).toEqual({ rescatado: 60 });
    expect(acumularBucketInversiones('INVESTMENT_IN', 'EGRESO', 80)).toEqual({ ingresado: 80 });
    expect(acumularBucketInversiones('INVESTMENT_OUT', 'INGRESO', 40)).toEqual({ rescatadoInversion: 40 });
    expect(acumularBucketInversiones('INVESTMENT_YIELD', 'INGRESO', 5)).toEqual({ rendimientos: 5 });
    expect(acumularBucketInversiones('INVESTMENT_YIELD', 'EGRESO', 2)).toEqual({ rendimientos: -2 });
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

  it('pide un mes anterior a la ventana de 90 días', () => {
    const chunk = nextHistoryChunk({ targetSince: '2025-01-01', now, syncDays: 90 });
    const edge = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    expect(chunk.endDate).toBe(edge.toISOString());
    const begin = new Date(edge);
    begin.setMonth(begin.getMonth() - 1);
    expect(chunk.beginDate).toBe(begin.toISOString());
    expect(chunk.quedaHistorial).toBe(true);
    expect(new Date(chunk.endDate).getTime() - new Date(chunk.beginDate).getTime())
      .toBeLessThanOrEqual(32 * 24 * 60 * 60 * 1000);
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
