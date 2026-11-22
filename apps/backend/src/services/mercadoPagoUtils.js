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
  PAYOUT: 'Transferencia bancaria',
  PAYOUTS: 'Transferencia bancaria',
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
    'bank_transfer',
    'digital_accounts',
    'digital_accounts_cards'
  ].map((v) => String(v).toLowerCase()));
  if (generic.has(cleaned.toLowerCase())) return null;
  if (/\b(digital_accounts(?:_cards)?|asset_management|money_park)\b/i.test(cleaned)) {
    return null;
  }
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

  const isTransfer = esTransferenciaPago(pago);

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
      label: 'Recibiste de',
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

// Heurística textual (también usada en clasificación económica más abajo)
const TRANSFER_RE =
  /transferencia|transferiste|enviaste\s+dinero|envio\s+de\s+dinero|env[ií]o\s+de\s+dinero|p2p|cvu|cbu|alias|money_transfer|account_fund/i;
const BANK_TRANSFER_RE =
  /bank_transfer|transferencia\s+bancaria|retiro\s+a\s+banco|cbu(?!\s*\/\s*cvu)|cuenta\s+bancaria|hacia\s+cbu|a\s+cbu|withdrawal(?!\s*_?\s*cancel)/i;

/**
 * CVU propio → CBU/banco (no P2P entre usuarios MP).
 */
export function esTransferenciaBancariaPago(pago) {
  if (!pago || typeof pago !== 'object') return false;
  const op = String(pago.operation_type || '').toLowerCase();
  if (op === 'withdrawal' || op === 'money_withdrawal' || op === 'bank_transfer') return true;

  const methodId = String(pago.payment_method_id || '').toLowerCase();
  const methodType = String(
    pago.payment_type_id || pago.payment_method?.type || ''
  ).toLowerCase();
  if (
    methodId === 'bank_transfer' ||
    methodId === 'cbu' ||
    methodType === 'bank_transfer'
  ) {
    return true;
  }

  const meta = pago.metadata && typeof pago.metadata === 'object' ? pago.metadata : {};
  if (meta.bank_account || meta.cbu || meta.bank_id || meta.destination_cbu) return true;

  const blob = [
    pago.description,
    pago.statement_descriptor,
    methodId,
    methodType,
    meta.concept,
    meta.detail,
    meta.type,
    meta.bank_account
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return BANK_TRANSFER_RE.test(blob);
}

/**
 * Detecta cualquier salida/entrada de fondos tipo transferencia:
 * P2P (CVU→CVU / usuario MP) o bancaria (CVU→CBU).
 */
export function esTransferenciaPago(pago) {
  if (!pago || typeof pago !== 'object') return false;
  if (esTransferenciaBancariaPago(pago)) return true;

  const op = String(pago.operation_type || '').toLowerCase();
  if (op === 'money_transfer' || op === 'account_fund') return true;

  const methodId = String(pago.payment_method_id || '').toLowerCase();
  const methodType = String(
    pago.payment_type_id || pago.payment_method?.type || ''
  ).toLowerCase();
  if (methodId === 'cvu') return true;

  const blob = [
    pago.description,
    pago.statement_descriptor,
    pago.external_reference,
    methodId,
    methodType,
    pago.metadata?.concept,
    pago.metadata?.detail,
    pago.metadata?.type
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (TRANSFER_RE.test(blob)) return true;

  // account_money solo cuenta como transferencia si el texto/op lo sugiere
  // (si no, suele ser pago con saldo a un comercio)
  if (
    (methodType === 'account_money' || methodId === 'account_money') &&
    (op.includes('transfer') || op === 'account_fund' || /transfer|cvu|enviaste|p2p/i.test(blob))
  ) {
    return true;
  }

  return false;
}

export function formatearDescripcionPago(pago, userId = null) {
  const contraparte = userId != null ? extraerContrapartePago(pago, userId) : null;
  const isTransfer = esTransferenciaPago(pago);
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
    key === 'PAYOUTS' || // settlement AR usa plural con include_withdraw
    key === 'TRANSFER' ||
    key === 'MONEY_TRANSFER' ||
    key === 'BANK_TRANSFER' ||
    key === 'ACCOUNT_FUND' ||
    key === 'CVU' ||
    key === 'P2P'
  );
}

/**
 * Clasificación económica para stats (evitar doble conteo).
 * Extracción reserva → disponible es interno; la transferencia real sí cuenta.
 */
export const MP_MOVEMENT_KINDS = {
  PAYMENT: 'PAYMENT',
  P2P_TRANSFER: 'P2P_TRANSFER',
  EXTERNAL_TRANSFER: 'EXTERNAL_TRANSFER',
  CASH_WITHDRAWAL: 'CASH_WITHDRAWAL',
  RESERVE_RELEASE: 'RESERVE_RELEASE',
  RESERVE_LOCK: 'RESERVE_LOCK',
  YIELD: 'YIELD',
  REFUND: 'REFUND',
  CHARGEBACK: 'CHARGEBACK',
  FEE: 'FEE',
  INTERNAL: 'INTERNAL',
  UNKNOWN: 'UNKNOWN'
};

export const MP_MOVEMENT_KIND_LABELS = {
  PAYMENT: 'Pago',
  P2P_TRANSFER: 'Transferencia a usuario',
  EXTERNAL_TRANSFER: 'Transferencia bancaria',
  CASH_WITHDRAWAL: 'Retiro de efectivo',
  RESERVE_RELEASE: 'Desde reserva',
  RESERVE_LOCK: 'A reserva',
  YIELD: 'Rendimiento',
  REFUND: 'Devolución',
  CHARGEBACK: 'Contracargo',
  FEE: 'Comisión',
  INTERNAL: 'Movimiento interno',
  UNKNOWN: 'Movimiento'
};

// Evitar match amplio de "reserva" suelto (falsos positivos sobre pagos/descripciones)
// digital_accounts / wallet: códigos crudos de parking/reserva en Account Money AR
const RESERVE_RELEASE_RE =
  /extracci[oó]n\s+de\s+reserva|sacar\s+de\s+reserva|release.?reserve|unpark|disponible\s+desde\s+reserva|investment.?unlock|reserve_for_.*_cancel|asset_management_withdrawal|salida\s+de\s+reserva/i;
const RESERVE_LOCK_RE =
  /a\s+reserva|enviar\s+a\s+reserva|guardar\s+en\s+reserva|envio\s+a\s+reserva|env[ií]o\s+a\s+reserva|lock.?reserve|parking|investment.?lock|reserve_for_(?!.*_cancel)/i;
const RESERVE_INTERNAL_CODE_RE =
  /\b(digital_accounts(?:_cards)?|asset_management(?:_deposit)?|money_park)\b/i;
const YIELD_RE =
  /rendimiento|rendimientos|inter[eé]s|intereses|asset_management_gain|asset_management_loss|yield|ganancia\s+de\s+inversi/i;
const INTERNAL_RE =
  /movimiento\s+interno|ajuste|balance\s+adjustment|pre_payout|pos_payout|available_balance|initial_available/i;

function textoClasificacionMp({ description, transactionType, operationType, paymentMethod, metadata, raw }) {
  const meta = metadata && typeof metadata === 'object' ? metadata : {};
  return [
    description,
    transactionType,
    operationType,
    paymentMethod,
    raw?.DESCRIPTION,
    raw?.TRANSACTION_TYPE,
    meta.concept,
    meta.detail,
    meta.type,
    meta.description,
    meta.event_type,
    meta.reason,
    typeof meta === 'object' ? JSON.stringify(meta) : ''
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * @returns {{ movementKind: string, statsExclude: boolean, label: string, isTransfer: boolean, isInternal: boolean }}
 */
export function clasificarMovimientoEconomicoMp(input = {}) {
  const transactionType = String(
    input.transactionType || input.TRANSACTION_TYPE || input.type || ''
  ).toUpperCase();
  const operationType = String(
    input.operationType || input.operation_type || input.raw?.OPERATION_TYPE || ''
  ).toLowerCase();
  const description = String(
    input.description || input.DESCRIPTION || input.detail || ''
  );
  const paymentMethod = String(
    input.paymentMethod || input.payment_method || input.PAYMENT_METHOD || ''
  );
  const metadata = parseMetadataField(
    input.metadata || input.METADATA || input.raw?.METADATA || input.raw?.metadata
  );
  const netAmount = Number(
    input.netAmount ?? input.SETTLEMENT_NET_AMOUNT ?? input.amount ?? 0
  );
  const blob = textoClasificacionMp({
    description,
    transactionType,
    operationType,
    paymentMethod,
    metadata,
    raw: input.raw
  });

  // 1) Rendimientos / intereses (sí cuentan como ingreso/egreso financiero)
  if (YIELD_RE.test(blob) || transactionType === 'CASHBACK') {
    return {
      movementKind: MP_MOVEMENT_KINDS.YIELD,
      statsExclude: false,
      label: MP_MOVEMENT_KIND_LABELS.YIELD,
      isTransfer: false,
      isInternal: false
    };
  }

  // 2) Reservas: interno (no contar dos veces si después transfieren)
  if (RESERVE_RELEASE_RE.test(blob) && !RESERVE_LOCK_RE.test(blob)) {
    return {
      movementKind: MP_MOVEMENT_KINDS.RESERVE_RELEASE,
      statsExclude: true,
      label: MP_MOVEMENT_KIND_LABELS.RESERVE_RELEASE,
      isTransfer: false,
      isInternal: true
    };
  }
  if (RESERVE_LOCK_RE.test(blob) && !TRANSFER_RE.test(blob)) {
    return {
      movementKind: MP_MOVEMENT_KINDS.RESERVE_LOCK,
      statsExclude: true,
      label: MP_MOVEMENT_KIND_LABELS.RESERVE_LOCK,
      isTransfer: false,
      isInternal: true
    };
  }
  // Códigos crudos MP (digital_accounts, wallet…): dirección por signo neto
  if (RESERVE_INTERNAL_CODE_RE.test(blob) && !TRANSFER_RE.test(blob)) {
    const isRelease = netAmount > 0;
    return {
      movementKind: isRelease
        ? MP_MOVEMENT_KINDS.RESERVE_RELEASE
        : MP_MOVEMENT_KINDS.RESERVE_LOCK,
      statsExclude: true,
      label: isRelease
        ? MP_MOVEMENT_KIND_LABELS.RESERVE_RELEASE
        : MP_MOVEMENT_KIND_LABELS.RESERVE_LOCK,
      isTransfer: false,
      isInternal: true
    };
  }

  // 3) Transferencias reales / retiros
  // P2P = CVU→CVU / usuario MP. Bancaria = CVU→CBU (WITHDRAWAL / bank_transfer).
  if (transactionType === 'WITHDRAWAL_CANCEL') {
    return {
      movementKind: MP_MOVEMENT_KINDS.EXTERNAL_TRANSFER,
      statsExclude: true, // cancela un retiro: no distorsionar flujo neto como gasto nuevo
      label: 'Transferencia cancelada',
      isTransfer: true,
      isInternal: false
    };
  }

  const paymentMethodLower = String(paymentMethod || '').toLowerCase();
  const metaBank =
    metadata?.bank_account ||
    metadata?.cbu ||
    metadata?.destination_cbu ||
    metadata?.bank_id ||
    null;
  const looksBank =
    Boolean(metaBank) ||
    operationType === 'withdrawal' ||
    operationType === 'money_withdrawal' ||
    operationType === 'bank_transfer' ||
    transactionType === 'BANK_TRANSFER' ||
    transactionType === 'WITHDRAWAL' ||
    paymentMethodLower === 'bank_transfer' ||
    paymentMethodLower === 'cbu' ||
    BANK_TRANSFER_RE.test(`${paymentMethodLower} ${blob}`);

  if (looksBank) {
    return {
      movementKind: MP_MOVEMENT_KINDS.EXTERNAL_TRANSFER,
      statsExclude: false,
      label: MP_MOVEMENT_KIND_LABELS.EXTERNAL_TRANSFER,
      isTransfer: true,
      isInternal: false
    };
  }

  if (
    operationType === 'money_transfer' ||
    operationType === 'account_fund' ||
    transactionType === 'MONEY_TRANSFER' ||
    transactionType === 'ACCOUNT_FUND' ||
    transactionType === 'TRANSFER' ||
    transactionType === 'P2P'
  ) {
    return {
      movementKind: MP_MOVEMENT_KINDS.P2P_TRANSFER,
      statsExclude: false,
      label: MP_MOVEMENT_KIND_LABELS.P2P_TRANSFER,
      isTransfer: true,
      isInternal: false
    };
  }
  if (transactionType === 'PAYOUT' || transactionType === 'PAYOUTS') {
    // Docs: PAYOUT = efectivo. En AR con include_withdraw el CSV trae PAYOUTS
    // (plural) para salidas de dinero (CVU→CBU y similares) con DESCRIPTION vacía.
    // Sin metadatos no se distingue ATM vs CBU → tratar como transferencia externa.
    const looksCashAtm =
      /atm|efectivo|cash|extracci[oó]n|retiro\s*en\s*efectivo/i.test(
        `${paymentMethod} ${blob}`
      );
    if (looksCashAtm) {
      return {
        movementKind: MP_MOVEMENT_KINDS.CASH_WITHDRAWAL,
        statsExclude: false,
        label: MP_MOVEMENT_KIND_LABELS.CASH_WITHDRAWAL,
        isTransfer: true,
        isInternal: false
      };
    }
    return {
      movementKind: MP_MOVEMENT_KINDS.EXTERNAL_TRANSFER,
      statsExclude: false,
      label: MP_MOVEMENT_KIND_LABELS.EXTERNAL_TRANSFER,
      isTransfer: true,
      isInternal: false
    };
  }
  if (TRANSFER_RE.test(blob)) {
    return {
      movementKind: MP_MOVEMENT_KINDS.P2P_TRANSFER,
      statsExclude: false,
      label: MP_MOVEMENT_KIND_LABELS.P2P_TRANSFER,
      isTransfer: true,
      isInternal: false
    };
  }

  // 4) Comercio / disputas
  if (transactionType === 'REFUND' || transactionType === 'REFUND_SHIPPING') {
    return {
      movementKind: MP_MOVEMENT_KINDS.REFUND,
      statsExclude: false,
      label: MP_MOVEMENT_KIND_LABELS.REFUND,
      isTransfer: false,
      isInternal: false
    };
  }
  if (transactionType === 'CHARGEBACK' || transactionType === 'DISPUTE' || transactionType.includes('CHARGEBACK') || transactionType.includes('DISPUTE')) {
    return {
      movementKind: MP_MOVEMENT_KINDS.CHARGEBACK,
      statsExclude: false,
      label: MP_MOVEMENT_KIND_LABELS.CHARGEBACK,
      isTransfer: false,
      isInternal: false
    };
  }
  if (INTERNAL_RE.test(blob)) {
    return {
      movementKind: MP_MOVEMENT_KINDS.INTERNAL,
      statsExclude: true,
      label: MP_MOVEMENT_KIND_LABELS.INTERNAL,
      isTransfer: false,
      isInternal: true
    };
  }
  if (
    transactionType === 'SETTLEMENT' ||
    transactionType === 'SETTLEMENT_SHIPPING' ||
    operationType === 'regular_payment' ||
    operationType === 'pos_payment'
  ) {
    return {
      movementKind: MP_MOVEMENT_KINDS.PAYMENT,
      statsExclude: false,
      label: MP_MOVEMENT_KIND_LABELS.PAYMENT,
      isTransfer: false,
      isInternal: false
    };
  }

  // Heurística: SETTLEMENT/unknown negativo sin descripción de pago → posible salida
  if (!transactionType && netAmount < 0 && TRANSFER_RE.test(blob)) {
    return {
      movementKind: MP_MOVEMENT_KINDS.P2P_TRANSFER,
      statsExclude: false,
      label: MP_MOVEMENT_KIND_LABELS.P2P_TRANSFER,
      isTransfer: true,
      isInternal: false
    };
  }

  return {
    movementKind: MP_MOVEMENT_KINDS.UNKNOWN,
    statsExclude: false,
    label: MP_MOVEMENT_KIND_LABELS.UNKNOWN,
    isTransfer: false,
    isInternal: false
  };
}

export function buildStatsExcludeMatch() {
  // Excluye movimientos internos (reservas, ajustes) del cálculo de ingresos/gastos
  return { 'origen.metadata.statsExclude': { $ne: true } };
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
  const metaCbu =
    metadata?.cbu ||
    metadata?.cvu ||
    metadata?.bank_account ||
    metadata?.account_number ||
    null;

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
  if (/reserva|rendimiento|asset_management|parking|inversi/i.test(detailLower)) {
    // Dejar SETTLEMENT: clasificarMovimientoEconomicoMp distingue reserva/rendimiento
    transactionType = 'SETTLEMENT';
  } else if (
    detailLower.includes('cbu') ||
    detailLower.includes('banco') ||
    detailLower.includes('bank_transfer') ||
    typeHint.includes('bank') ||
    String(mov.payment_method || mov.payment_method_type || '').toLowerCase().includes('bank')
  ) {
    transactionType = 'BANK_TRANSFER';
  } else if (
    detailLower.includes('transfer') ||
    detailLower.includes('retiro') ||
    detailLower.includes('withdraw') ||
    typeHint.includes('withdraw') ||
    typeHint.includes('transfer')
  ) {
    transactionType = 'WITHDRAWAL';
  } else if (mov.operation_type) {
    const op = String(mov.operation_type).toUpperCase();
    if (op === 'MONEY_TRANSFER') transactionType = 'MONEY_TRANSFER';
    else if (op === 'BANK_TRANSFER') transactionType = 'BANK_TRANSFER';
    else if (op === 'WITHDRAWAL') transactionType = 'WITHDRAWAL';
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
  const economic = clasificarMovimientoEconomicoMp(row);

  if (contraparte?.name) {
    return `MercadoPago - ${contraparte.name}`;
  }

  if (economic.movementKind === MP_MOVEMENT_KINDS.RESERVE_RELEASE) {
    return 'MercadoPago - Desde reserva';
  }
  if (economic.movementKind === MP_MOVEMENT_KINDS.RESERVE_LOCK) {
    return 'MercadoPago - A reserva';
  }
  if (economic.movementKind === MP_MOVEMENT_KINDS.YIELD) {
    return description ? `MercadoPago - Rendimiento · ${description}` : 'MercadoPago - Rendimiento';
  }
  if (economic.isTransfer) {
    return description
      ? `MercadoPago - ${description}`
      : `MercadoPago - ${economic.label}`;
  }

  if (description) {
    return `MercadoPago - ${description}`;
  }

  if (metodo) {
    return `MercadoPago - ${metodo}`;
  }

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
