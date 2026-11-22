import {
  MP_MOVEMENT_KINDS,
  acumularBucketInversiones,
  buildLedgerMatch,
  buildListLedgerMatch,
  clasificarMovimientoEconomicoMp,
  isInversionesMovementKind,
} from '../mercadoPagoUtils.js';

describe('clasificarMovimientoEconomicoMp libros', () => {
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

  it('acumula enviado, rescatado y rendimiento neto', () => {
    expect(acumularBucketInversiones('RESERVE_LOCK', 'EGRESO', 100)).toEqual({ enviado: 100 });
    expect(acumularBucketInversiones('INVESTMENT_OUT', 'INGRESO', 40)).toEqual({ rescatado: 40 });
    expect(acumularBucketInversiones('INVESTMENT_YIELD', 'INGRESO', 5)).toEqual({ rendimientos: 5 });
    expect(acumularBucketInversiones('INVESTMENT_YIELD', 'EGRESO', 2)).toEqual({ rendimientos: -2 });
  });
});
