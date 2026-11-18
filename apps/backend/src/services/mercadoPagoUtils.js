/**
 * Utilidades compartidas para integración wallet Mercado Pago (Argentina).
 */

export const MP_TRANSACTION_TYPE_LABELS = {
  SETTLEMENT: 'Pago aprobado',
  REFUND: 'Devolución',
  CHARGEBACK: 'Contracargo',
  DISPUTE: 'Reclamo',
  WITHDRAWAL: 'Transferencia bancaria',
  WITHDRAWAL_CANCEL: 'Transferencia cancelada',
  PAYOUT: 'Retiro de efectivo',
  TRANSFER: 'Transferencia',
  MONEY_TRANSFER: 'Transferencia',
  BANK_TRANSFER: 'Transferencia bancaria',
  CASHBACK: 'Cashback',
  SETTLEMENT_SHIPPING: 'Envío aprobado',
  REFUND_SHIPPING: 'Devolución de envío',
  CHARGEBACK_SHIPPING: 'Contracargo de envío',
  DISPUTE_SHIPPING: 'Reclamo de envío'
};

export function calcularComisiones(pago) {
  const comisiones = {
    mercadopago: 0,
    financieras: 0,
    envio: 0,
    total: 0
  };

  if (pago.fee_details && Array.isArray(pago.fee_details)) {
    for (const fee of pago.fee_details) {
      const amount = Math.abs(fee.amount || 0);
      switch (fee.type) {
        case 'mercadopago_fee':
          comisiones.mercadopago += amount;
          break;
        case 'financing_fee':
          comisiones.financieras += amount;
          break;
        case 'shipping_fee':
          comisiones.envio += amount;
          break;
        default:
          comisiones.mercadopago += amount;
      }
    }
  }

  comisiones.total = comisiones.mercadopago + comisiones.financieras + comisiones.envio;
  return comisiones;
}

export function determinarTipoPago(pago, userId) {
  const mpUserId = Number(userId);
  const collectorId = Number(pago.collector_id);
  const payerId = Number(pago.payer?.id);

  if (collectorId === mpUserId && payerId !== mpUserId) {
    return 'INGRESO';
  }
  if (payerId === mpUserId && collectorId !== mpUserId) {
    return 'EGRESO';
  }
  if (collectorId === mpUserId) {
    return 'INGRESO';
  }
  return 'EGRESO';
}

export function determinarTipoMovimiento(amount) {
  return Number(amount) >= 0 ? 'INGRESO' : 'EGRESO';
}

/**
 * Contraparte visible para wallet personal:
 * - EGRESO (vos pagás): negocio / comercio / descriptor
 * - INGRESO (te pagan): nombre del pagador
 */
export function limpiarNombreContraparte(name) {
  if (!name) return null;
  const cleaned = String(name).trim();
  if (!cleaned) return null;
  const generic = new Set([
    ...Object.values(MP_TRANSACTION_TYPE_LABELS),
    ...Object.keys(MP_TRANSACTION_TYPE_LABELS),
    'MercadoPago',
    'Mercado Pago',
    'Pago',
    'Movimiento',
    'account_money',
    'credit_card',
    'debit_card',
    'bank_transfer'
  ].map((v) => String(v).toLowerCase()));
  if (generic.has(cleaned.toLowerCase())) return null;
  return cleaned;
}

export function extraerContrapartePago(pago, userId) {
  const mpUserId = Number(userId);
  const collectorId = Number(pago?.collector_id);
  const payerId = Number(pago?.payer?.id);
  const userIsPayer = payerId === mpUserId && collectorId !== mpUserId;
  const userIsCollector = collectorId === mpUserId && payerId !== mpUserId;

  const businessName = (
    pago?.point_of_interaction?.business_info?.name ||
    pago?.point_of_interaction?.business_info?.unit ||
    pago?.merchant?.name ||
    ''
  ).trim();
  const itemTitle = (pago?.additional_info?.items?.[0]?.title || '').trim();
  const description = (pago?.description || '').trim();
  const statement = (pago?.statement_descriptor || '').trim();
  const counterpartyFromExtra = (
    pago?.additional_info?.tracking_id ||
    pago?.metadata?.counterparty_name ||
    pago?.metadata?.destination_name ||
    ''
  ).toString().trim();
  const payer = pago?.payer || {};
  const payerName = [payer.first_name, payer.last_name].filter(Boolean).join(' ').trim()
    || payer.nickname
    || payer.email
    || null;

  const isTransfer = String(pago?.operation_type || '').toLowerCase() === 'money_transfer';

  if (userIsPayer) {
    const name = limpiarNombreContraparte(
      businessName || description || itemTitle || statement || counterpartyFromExtra || null
    );
    return {
      role: 'destino',
      label: isTransfer ? 'Transferiste a' : 'Pagaste a',
      name: name || (collectorId ? `Comercio #${collectorId}` : null),
      id: collectorId || null,
      email: null
    };
  }

  if (userIsCollector) {
    const name = limpiarNombreContraparte(
      payerName || description || itemTitle || businessName || null
    );
    return {
      role: 'origen',
      label: isTransfer ? 'Recibiste de' : 'Recibiste de',
      name,
      id: payerId || null,
      email: payer.email || null
    };
  }

  const fallback = limpiarNombreContraparte(
    businessName || description || itemTitle || statement || payerName || counterpartyFromExtra || null
  );
  return {
    role: 'contraparte',
    label: 'Contraparte',
    name: fallback,
    id: null,
    email: payer.email || null
  };
}

export function esTransferenciaPago(pago) {
  return String(pago?.operation_type || '').toLowerCase() === 'money_transfer';
}

export function formatearDescripcionPago(pago, userId = null) {
  const contraparte = userId != null ? extraerContrapartePago(pago, userId) : null;
  const isTransfer = String(pago?.operation_type || '').toLowerCase() === 'money_transfer';
  const metodo = isTransfer
    ? 'Transferencia'
    : (pago.payment_method?.type || pago.payment_method_id || 'Pago');

  if (contraparte?.name) {
    let descripcion = `MercadoPago - ${contraparte.name}`;
    if (pago.description && pago.description !== contraparte.name) {
      descripcion += ` · ${metodo}`;
    } else if (isTransfer) {
      descripcion += ` · Transferencia`;
    }
    return descripcion;
  }

  let descripcion = `MercadoPago - ${metodo}`;
  if (pago.description) {
    descripcion += ` - ${pago.description}`;
  }
  if (pago.external_reference) {
    descripcion += ` (Ref: ${pago.external_reference})`;
  }
  return descripcion;
}

function parseMetadataField(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

export function esTipoTransferenciaMovimiento(type) {
  const key = String(type || '').toUpperCase();
  return (
    key === 'WITHDRAWAL' ||
    key === 'WITHDRAWAL_CANCEL' ||
    key === 'PAYOUT' ||
    key === 'TRANSFER' ||
    key === 'MONEY_TRANSFER' ||
    key === 'BANK_TRANSFER'
  );
}

export function extraerContraparteMovimiento(row) {
  const description = (
    row.DESCRIPTION || row.description || row.raw?.DESCRIPTION || row.detail || ''
  ).trim();
  const externalRef = (
    row.EXTERNAL_REFERENCE || row.external_reference || row.raw?.EXTERNAL_REFERENCE || ''
  ).trim();
  const metadata = parseMetadataField(
    row.METADATA || row.metadata || row.raw?.METADATA || row.raw?.metadata
  );
  const txType = String(
    row.TRANSACTION_TYPE || row.transaction_type || row.transactionType || row.type || ''
  ).toUpperCase();
  const isTransfer = esTipoTransferenciaMovimiento(txType);

  const metaName =
    metadata?.counterparty_name ||
    metadata?.destination_name ||
    metadata?.bank_name ||
    metadata?.alias ||
    metadata?.holder_name ||
    metadata?.name ||
    null;
  const metaCbu = metadata?.cbu || metadata?.cvu || metadata?.account_number || null;

  // Patrones frecuentes en CSV Account Money AR / movements
  const patterns = [
    /(?:transferencia|pago|envio|envío|a|de|hacia|from|to)\s+(.+)$/i,
    /^(.+?)\s+-\s+(?:cvu|cbu|alias)/i,
  ];
  let name = metaName || null;
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match?.[1]) {
      name = match[1].trim();
      break;
    }
  }
  if (!name && description && description.length >= 3 && description.length <= 80) {
    name = description;
  }
  if (!name && externalRef) name = externalRef;
  if (!name && metaCbu) name = `Cuenta ${metaCbu}`;
  name = limpiarNombreContraparte(name);

  const net = Number(row.netAmount ?? row.SETTLEMENT_NET_AMOUNT ?? 0);
  const isIngreso = net >= 0;
  let label = 'Contraparte';
  if (name) {
    if (isTransfer) label = isIngreso ? 'Recibiste de' : 'Transferiste a';
    else label = isIngreso ? 'Recibiste de' : 'Pagaste a';
  }

  return {
    role: isIngreso ? 'origen' : 'destino',
    label,
    name: name || null,
    id: null,
    email: null
  };
}

/**
 * Normaliza un movimiento de /account/movements o /mercadopago_account/movements
 * al shape que usa procesarMovimientosReporte.
 */
export function normalizeAccountMovement(mov) {
  if (!mov || typeof mov !== 'object') return null;

  const amountRaw = Number(
    mov.amount ?? mov.transaction_amount ?? mov.net_credit_amount ?? mov.net_debit_amount ?? 0
  );
  const typeHint = String(mov.type || mov.movement_type || mov.detail || '').toLowerCase();
  const isCredit =
    typeHint.includes('credit') ||
    typeHint.includes('income') ||
    typeHint.includes('in') ||
    Number(mov.amount) > 0 ||
    Number(mov.net_credit_amount) > 0;
  const signedNet = isCredit ? Math.abs(amountRaw) : -Math.abs(amountRaw);

  const detail = (
    mov.detail ||
    mov.description ||
    mov.concept ||
    mov.reference ||
    mov.label ||
    ''
  ).toString();
  const detailLower = detail.toLowerCase();
  let transactionType = 'SETTLEMENT';
  if (
    detailLower.includes('transfer') ||
    detailLower.includes('retiro') ||
    detailLower.includes('withdraw') ||
    typeHint.includes('withdraw') ||
    typeHint.includes('transfer')
  ) {
    transactionType = 'WITHDRAWAL';
  } else if (mov.operation_type) {
    const op = String(mov.operation_type).toUpperCase();
    if (op === 'MONEY_TRANSFER' || op === 'WITHDRAWAL') transactionType = 'WITHDRAWAL';
  }

  const sourceId = String(
    mov.id || mov.movement_id || mov.detail_id || mov.reference_id || mov.source_id || ''
  );
  if (!sourceId) return null;

  const raw = {
    ...mov,
    SOURCE_ID: sourceId,
    TRANSACTION_TYPE: transactionType,
    DESCRIPTION: detail,
    TRANSACTION_AMOUNT: Math.abs(amountRaw),
    SETTLEMENT_NET_AMOUNT: signedNet,
    TRANSACTION_DATE: mov.date_created || mov.date || mov.creation_date,
    PAYMENT_METHOD: mov.payment_method || mov.method || '',
    PAYMENT_METHOD_TYPE: mov.payment_method_type || '',
    EXTERNAL_REFERENCE: mov.reference || mov.external_reference || '',
    METADATA: mov.metadata || null
  };

  return {
    id: sourceId,
    sourceId,
    transactionType,
    description: detail,
    paymentMethod: raw.PAYMENT_METHOD,
    paymentMethodType: raw.PAYMENT_METHOD_TYPE,
    amount: Math.abs(amountRaw),
    netAmount: signedNet,
    feeAmount: Math.abs(Number(mov.fee_amount || mov.fee || 0)),
    currency: mov.currency_id || mov.currency || 'ARS',
    date: raw.TRANSACTION_DATE,
    externalReference: raw.EXTERNAL_REFERENCE,
    raw,
    source: 'account_movements'
  };
}

export function mapearTipoTransaccionMp(type) {
  if (!type) return 'Movimiento';
  const key = String(type).toUpperCase();
  return MP_TRANSACTION_TYPE_LABELS[key] || type;
}

export function getMpSyncDays() {
  return parseInt(process.env.MP_SYNC_DAYS || '90', 10);
}

export function formatearDescripcionMovimiento(row) {
  const tipoRaw =
    row.TRANSACTION_TYPE || row.transaction_type || row.transactionType || row.type || 'Movimiento';
  const tipoLabel = mapearTipoTransaccionMp(tipoRaw);
  const metodo = row.PAYMENT_METHOD || row.payment_method || row.paymentMethod || '';
  const description = limpiarNombreContraparte(row.DESCRIPTION || row.description || '');
  const contraparte = extraerContraparteMovimiento(row);

  if (contraparte?.name) {
    return `MercadoPago - ${contraparte.name}`;
  }

  if (description) {
    return `MercadoPago - ${description}`;
  }

  if (metodo) {
    return `MercadoPago - ${metodo}`;
  }

  // Evitar persistir "MercadoPago - Pago aprobado" como si fuera el comercio
  if (esTipoTransferenciaMovimiento(tipoRaw)) {
    return `MercadoPago - ${tipoLabel}`;
  }

  const ref = row.EXTERNAL_REFERENCE || row.external_reference;
  return ref ? `MercadoPago - Ref: ${ref}` : 'MercadoPago - Movimiento';
}

export function mapearEstadoPago(status) {
  const estados = {
    approved: 'COMPLETADA',
    pending: 'PENDIENTE',
    in_process: 'PENDIENTE',
    rejected: 'CANCELADA',
    cancelled: 'CANCELADA',
    refunded: 'CANCELADA'
  };
  return estados[status] || 'PENDIENTE';
}

export function deduplicarPagos(pagos) {
  const map = new Map();
  for (const pago of pagos) {
    if (pago?.id != null) {
      map.set(String(pago.id), pago);
    }
  }
  return Array.from(map.values());
}

export function mpAuthHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Attadia/1.0'
  };
}
