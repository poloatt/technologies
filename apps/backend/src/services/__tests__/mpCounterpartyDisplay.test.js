import {
  extraerContraparteMovimiento,
  extraerContrapartePago,
  limpiarNombreContraparte,
} from '../mercadoPagoUtils.js';
import {
  formatMpTransactionTitle,
  getCounterparty,
} from '../../../../shared/utils/mpDisplayUtils.js';

describe('mpDisplayUtils — contraparte y título en listado de Transacciones', () => {
  it('mantiene la contraparte real cuando viene bien (ej. UBER)', () => {
    const tx = {
      tipo: 'EGRESO',
      descripcion: 'MercadoPago - UBER · account_money',
      origen: {
        tipo: 'MERCADOPAGO_PAGO',
        metadata: {
          counterpartyName: 'UBER',
          counterpartyLabel: 'Pagaste a',
          paymentMethod: 'account_money',
          movementKind: 'PAYMENT',
        },
      },
    };

    expect(getCounterparty(tx)).toMatchObject({ name: 'UBER', label: 'Pagaste a' });
    expect(formatMpTransactionTitle(tx.descripcion, tx.origen)).toBe('UBER');
  });

  it('usa Detalle MP (meta.description) cuando counterpartyName es genérico (wallet / Dinero en cuenta)', () => {
    const tx = {
      tipo: 'EGRESO',
      descripcion: 'MercadoPago - account_money',
      origen: {
        tipo: 'MERCADOPAGO_PAGO',
        metadata: {
          counterpartyName: 'wallet',
          businessName: 'wallet',
          description: 'PedidosYa',
          paymentMethod: 'account_money',
          movementKind: 'PAYMENT',
        },
      },
    };

    expect(getCounterparty(tx)).toMatchObject({ name: 'PedidosYa', label: 'Pagaste a' });
    expect(formatMpTransactionTitle(tx.descripcion, tx.origen)).toBe('PedidosYa');
  });

  it('usa Detalle MP en transferencias en lugar de mostrar "Transferencia bancaria"', () => {
    const tx = {
      tipo: 'EGRESO',
      descripcion: 'MercadoPago - Transferencia bancaria',
      origen: {
        tipo: 'MERCADOPAGO_MOVIMIENTO',
        metadata: {
          counterpartyName: 'Transferencia bancaria',
          description: 'Transferencia a Juan Pérez',
          movementKind: 'EXTERNAL_TRANSFER',
          isTransfer: true,
        },
      },
    };

    expect(getCounterparty(tx)).toMatchObject({ name: 'Juan Pérez', label: 'Transferiste a' });
    expect(formatMpTransactionTitle(tx.descripcion, tx.origen)).toBe('Juan Pérez');
  });

  it('prefiere statementDescriptor o Detalle MP sobre el fallback sintético "Comercio #123"', () => {
    const tx = {
      tipo: 'EGRESO',
      descripcion: 'MercadoPago - Comercio #987654',
      origen: {
        tipo: 'MERCADOPAGO_PAGO',
        metadata: {
          counterpartyName: 'Comercio #987654',
          itemTitle: 'Producto sin descripción',
          description: 'Farmacity',
          paymentMethod: 'account_money',
          movementKind: 'PAYMENT',
        },
      },
    };

    expect(getCounterparty(tx)).toMatchObject({ name: 'Farmacity', label: 'Pagaste a' });
    expect(formatMpTransactionTitle(tx.descripcion, tx.origen)).toBe('Farmacity');
  });

  it('extrae el proveedor desde descripciones legacy con prefijo de método (account_money - ...)', () => {
    const tx = {
      tipo: 'EGRESO',
      descripcion: 'MercadoPago - account_money - Edesur (Ref: 9911)',
      origen: {
        tipo: 'MERCADOPAGO_PAGO',
        metadata: {
          paymentMethod: 'account_money',
          movementKind: 'PAYMENT',
        },
      },
    };

    expect(getCounterparty(tx)).toMatchObject({ name: 'Edesur', label: 'Pagaste a' });
    expect(formatMpTransactionTitle(tx.descripcion, tx.origen)).toBe('Edesur');
  });

  it('no inventa contraparte cuando realmente solo hay "Dinero en cuenta" o "Transferencia bancaria"', () => {
    const tx = {
      tipo: 'EGRESO',
      descripcion: 'MercadoPago - Dinero en cuenta',
      origen: {
        tipo: 'MERCADOPAGO_PAGO',
        metadata: {
          counterpartyName: 'Dinero en cuenta',
          paymentMethod: 'account_money',
          movementKind: 'PAYMENT',
        },
      },
    };

    expect(getCounterparty(tx)).toBeNull();
    expect(formatMpTransactionTitle(tx.descripcion, tx.origen)).toBe('Dinero en cuenta');
  });
});

describe('mercadoPagoUtils — extracción limpia de contraparte al sincronizar', () => {
  it('ignora business_info.unit genérico ("wallet", "online_payments") y toma description/statement', () => {
    const pago = {
      payer: { id: 100 },
      collector_id: 200,
      payment_method_id: 'account_money',
      description: 'UBER*TRIP',
      point_of_interaction: {
        business_info: { unit: 'online_payments' },
      },
    };

    expect(extraerContrapartePago(pago, 100)).toMatchObject({
      name: 'UBER*TRIP',
      label: 'Pagaste a',
    });
  });

  it('rechaza nombres genéricos de medio de pago o canal', () => {
    expect(limpiarNombreContraparte('Dinero en cuenta')).toBeNull();
    expect(limpiarNombreContraparte('Transferencia bancaria')).toBeNull();
    expect(limpiarNombreContraparte('wallet')).toBeNull();
    expect(limpiarNombreContraparte('online_payments')).toBeNull();
    expect(limpiarNombreContraparte('Producto sin descripción')).toBeNull();
    expect(limpiarNombreContraparte('UBER')).toBe('UBER');
  });

  it('extraerContraparteMovimiento no recorta nombres que contienen "a" o "de" (ej. "La Anónima")', () => {
    const mov = {
      TRANSACTION_TYPE: 'SETTLEMENT',
      DESCRIPTION: 'La Anónima',
      SETTLEMENT_NET_AMOUNT: -15000,
    };

    expect(extraerContraparteMovimiento(mov)).toMatchObject({
      name: 'La Anónima',
      label: 'Pagaste a',
    });

    const movTransfer = {
      TRANSACTION_TYPE: 'BANK_TRANSFER',
      DESCRIPTION: 'Transferencia bancaria',
      SETTLEMENT_NET_AMOUNT: -50000,
    };

    expect(extraerContraparteMovimiento(movTransfer).name).toBeNull();
  });
});
