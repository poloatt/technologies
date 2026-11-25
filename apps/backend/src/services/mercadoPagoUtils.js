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

function idsMercadoPago(pago) {
  const collectorId = Number(pago?.collector_id ?? pago?.collector?.id);
  const payerId = Number(pago?.payer?.id ?? pago?.payer_id);
  return {
    collectorId: Number.isFinite(collectorId) ? collectorId : null,
    payerId: Number.isFinite(payerId) ? payerId : null
  };
}

function metodoPagoMp(pago) {
  return String(
    pago?.payment_method_id || pago?.payment_type_id || pago?.payment_method?.type || ''
  ).toLowerCase();
}

export function reserveBranchOf(pago) {
  return String(
    pago?.point_of_interaction?.business_info?.branch ||
    pago?.businessBranch ||
    pago?.metadata?.businessBranch ||
    ''
  );
}

function esDebinOBanco(method) {
  const key = String(method || '').toLowerCase();
  return key === 'bank_transfer' || key === 'debin_transfer' || key === 'cbu' || key.includes('debin');
}

/**
 * Dirección del dinero en la cuenta de Mercado Pago.
 * CBU → CVU (fondeo, DEBIN recibido, account_fund) es ingreso.
 * CVU → CBU (withdrawal, payout) es egreso.
 * account_fund entra aunque el usuario figure como payer: es un débito del banco propio.
 */
export function determinarTipoPago(pago, userId) {
  const op = String(pago?.operation_type || '').toLowerCase();
  const method = metodoPagoMp(pago);

  if (op === 'account_fund') return 'INGRESO';
  if (op === 'withdrawal' || op === 'money_withdrawal') return 'EGRESO';

  // Reserva: el usuario es payer y collector. La dirección está en el branch.
  // AM-to-POT sale del disponible hacia la reserva. POT-to-AM vuelve.
  const branch = reserveBranchOf(pago).toLowerCase();
  if (branch.includes('am-to-pot')) return 'EGRESO';
  if (branch.includes('pot-to-am')) return 'INGRESO';

  // Venta de dólares: entran pesos. Compra de dólares: salen pesos.
  // No usa el signo del settlement, que en estos pagos viene siempre positivo.
  const cambio = datosCambioUsd(pago);
  if (cambio?.movementKind === MP_MOVEMENT_KINDS.FX_SELL) return 'INGRESO';
  if (cambio?.movementKind === MP_MOVEMENT_KINDS.FX_BUY) return 'EGRESO';

  // FCI: el pago con dinero en cuenta sale hacia el fondo. El monto de la API
  // viene positivo y el usuario figura de los dos lados, igual que en la reserva.
  // El rescate que vuelve entra por el settlement, no por este pago.
  if (op === 'investment') {
    const desc = String(pago?.description || '');
    if (INVESTMENT_OUT_RE.test(desc) && !INVESTMENT_IN_RE.test(desc)) return 'INGRESO';
    return 'EGRESO';
  }

  const mpUserId = Number(userId);
  const { collectorId, payerId } = idsMercadoPago(pago);
  const userIsCollector = collectorId != null && collectorId === mpUserId;
  const userIsPayer = payerId != null && payerId === mpUserId;
  const debin = method === 'debin_transfer' || method.includes('debin');

  if (userIsCollector && !userIsPayer) return 'INGRESO';
  // Fondeo DEBIN: el usuario puede ser collector y payer a la vez.
  if (debin && userIsCollector) return 'INGRESO';
  if (userIsPayer && !userIsCollector) return 'EGRESO';
  if (userIsCollector) return 'INGRESO';
  // DEBIN sin ids: si el usuario no es quien paga, la plata entra al CVU.
  if (debin && !userIsPayer) return 'INGRESO';
  return 'EGRESO';
}

export function determinarTipoMovimiento(amount) {
  return Number(amount) >= 0 ? 'INGRESO' : 'EGRESO';
}

/**
 * Signo de un movimiento de reporte, activities o account movements.
 * El settlement manda cuando el neto ya viene firmado y el tipo no es una salida explícita.
 * PAYOUT/WITHDRAWAL son salidas aunque el CSV traiga el monto en positivo.
 */
export function determinarTipoMovimientoMp(mov = {}, userId = null) {
  const type = String(mov.transactionType || mov.TRANSACTION_TYPE || '').toUpperCase();
  const op = String(
    mov.operationType ||
      mov.payment?.operation_type ||
      mov.raw?.OPERATION_TYPE ||
      mov.raw?.METADATA?.operation_type ||
      ''
  ).toLowerCase();
  const method = String(
    mov.paymentMethod || mov.paymentMethodType || mov.payment?.payment_type_id || mov.payment?.payment_method_id || ''
  ).toLowerCase();
  const net = Number(mov.netAmount ?? mov.amount ?? mov.SETTLEMENT_NET_AMOUNT ?? 0);

  if (op === 'account_fund' || type === 'ACCOUNT_FUND') return 'INGRESO';
  if (type === 'WITHDRAWAL_CANCEL') return 'INGRESO';

  // El reporte trae el neto en positivo para las dos direcciones de la reserva.
  const branch = reserveBranchOf(mov.payment || mov).toLowerCase();
  if (branch.includes('am-to-pot')) return 'EGRESO';
  if (branch.includes('pot-to-am')) return 'INGRESO';

  // Crédito de settlement (cobro o DEBIN acreditado). El neto firmado gana
  // sobre un operation_type de retiro copiado por el reporte de activities.
  if ((type === 'SETTLEMENT' || type === 'SETTLEMENT_SHIPPING') && net > 0) {
    return 'INGRESO';
  }
  if ((type === 'SETTLEMENT' || type === 'SETTLEMENT_SHIPPING') && net < 0) {
    return 'EGRESO';
  }

  if (
    type === 'WITHDRAWAL' ||
    type === 'PAYOUT' ||
    type === 'PAYOUTS' ||
    op === 'withdrawal' ||
    op === 'money_withdrawal'
  ) {
    return 'EGRESO';
  }

  // Transferencia bancaria con neto firmado: positivo entra, negativo sale.
  if (type === 'BANK_TRANSFER' && net > 0) return 'INGRESO';
  if (type === 'BANK_TRANSFER' && net < 0) return 'EGRESO';
  if (esDebinOBanco(method) && net > 0 && op !== 'money_transfer') return 'INGRESO';

  if (mov.payment && userId != null) {
    return determinarTipoPago(mov.payment, userId);
  }

  return determinarTipoMovimiento(net);
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
  // debin_transfer = banco→MP (ingreso CBU); bank_transfer/cbu = vínculo bancario
  if (
    methodId === 'bank_transfer' ||
    methodId === 'cbu' ||
    methodId === 'debin_transfer' ||
    methodId.includes('debin') ||
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
  INVESTMENT_IN: 'INVESTMENT_IN',
  INVESTMENT_OUT: 'INVESTMENT_OUT',
  FX_SELL: 'FX_SELL',
  FX_BUY: 'FX_BUY',
  USD_IN: 'USD_IN',
  USD_OUT: 'USD_OUT',
  USD_PAYMENT: 'USD_PAYMENT',
  CARD_PURCHASE: 'CARD_PURCHASE',
  INVESTMENT_YIELD: 'INVESTMENT_YIELD',
  YIELD: 'YIELD',
  CASHBACK: 'CASHBACK',
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
  INVESTMENT_IN: 'A inversión',
  INVESTMENT_OUT: 'Desde inversión',
  FX_SELL: 'Venta de dólares',
  FX_BUY: 'Compra de dólares',
  USD_IN: 'Dólares recibidos',
  USD_OUT: 'Dólares enviados',
  USD_PAYMENT: 'Pago en dólares',
  CARD_PURCHASE: 'Compra con tarjeta',
  INVESTMENT_YIELD: 'Rendimiento',
  YIELD: 'Rendimiento',
  CASHBACK: 'Cashback',
  REFUND: 'Devolución',
  CHARGEBACK: 'Contracargo',
  FEE: 'Comisión',
  INTERNAL: 'Movimiento interno',
  UNKNOWN: 'Movimiento'
};

// Evitar match amplio de "reserva" suelto (falsos positivos sobre pagos/descripciones)
// digital_accounts / wallet: códigos crudos de parking/reserva en Account Money AR
const RESERVE_RELEASE_RE =
  /extracci[oó]n\s+de\s+(?:(?:la|tu|mi)\s+)?reserva|sacar\s+de\s+(?:(?:la|tu|mi)\s+)?reserva|retir(?:ar|aste|o)\s+de\s+(?:(?:la|tu|mi)\s+)?reserva|release.?reserve|unpark|desde\s+(?:(?:la|tu|mi)\s+)?reserva|reserve_for_.*_cancel|salida\s+de\s+(?:(?:la|tu|mi)\s+)?reserva/i;
const RESERVE_LOCK_RE =
  /a\s+(?:(?:la|tu|mi)\s+)?reserva|enviar\s+a\s+(?:(?:la|tu|mi)\s+)?reserva|guardar\s+en\s+(?:(?:la|tu|mi)\s+)?reserva|env[ií]o\s+a\s+(?:(?:la|tu|mi)\s+)?reserva|pasar\s+a\s+(?:(?:la|tu|mi)\s+)?reserva|mover\s+a\s+(?:(?:la|tu|mi)\s+)?reserva|lock.?reserve|parking|reserve_for_(?!.*_cancel)/i;
// digital_accounts_cards es la partición de la tarjeta, no la Reserva.
const RESERVE_INTERNAL_CODE_RE =
  /\b(digital_accounts|money_park)\b/i;
const INVESTMENT_OUT_RE =
  /asset_management_withdrawal|investment.?unlock|rescate\s+de\s+inversi|retir(?:ar|o)\s+(?:de\s+)?inversi/i;
const INVESTMENT_IN_RE =
  /asset_management_deposit|investment.?lock|suscripci[oó]n\s+de\s+inversi|enviar\s+a\s+inversi|aporte\s+a\s+inversi/i;
const INVESTMENT_CODE_RE = /\basset_management\b/i;
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
    meta.counterpartyName,
    meta.businessName,
    meta.itemTitle
    // No JSON.stringify(meta): paymentMethodType=bank_transfer en ventas SETTLEMENT
    // contaminaba la heurística de CVU→CBU. La contraparte sí: ahí aparece digital_accounts.
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

const MP_CREDIT_METHOD_IDS = new Set([
  'visa',
  'master',
  'amex',
  'naranja',
  'cabal',
  'argencard',
  'cencosud',
  'diners',
  'cmr',
  'magna',
  'nevada',
  'cordobesa',
  'tarshop',
  'shopping'
]);

const MP_DEBIT_METHOD_IDS = new Set([
  'debvisa',
  'debmaster',
  'maestro',
  'debcabal',
  'debamex'
]);

function medioEsCredito(method, methodType, methodId) {
  const ids = [method, methodType, methodId].map((value) => String(value || '').toLowerCase());
  if (ids.some((id) => id === 'debit_card' || MP_DEBIT_METHOD_IDS.has(id))) return false;
  return ids.some((id) => id === 'credit_card' || MP_CREDIT_METHOD_IDS.has(id));
}

function mediosDe(input = {}) {
  return [
    input.paymentMethod,
    input.paymentMethodType,
    input.paymentMethodId,
    input.payment_method,
    input.payment_type_id,
    input.payment_method_id,
    input.payment_method_type,
  ].map((value) => String(value || '').toLowerCase());
}

/** Un pago o un cargo de tarjeta no es una compraventa de dólares. */
function esPagoOTarjeta(input = {}) {
  const op = String(input.operationType || input.operation_type || '').toLowerCase();
  if (op === 'regular_payment' || op === 'pos_payment') return true;
  const medios = mediosDe(input);
  return medios.some((id) => (
    id === 'debit_card' || id === 'credit_card'
    || MP_DEBIT_METHOD_IDS.has(id) || MP_CREDIT_METHOD_IDS.has(id)
  ));
}

/**
 * Cambio ARS/USD de Mercado Pago. El operation_type sigue siendo investment,
 * pero la plata de un lado está en dólares. Una suscripción a un fondo
 * (destino distinto de USD, o Marketplace de inversiones) no entra acá.
 * Un pago con la punta del pagador en USD tampoco: es un gasto en dólares.
 * @returns {{ movementKind: string, usdAmount: number, exchangeRate: number, exchangeOperation: string|null, payerCurrency: string|null, collectorCurrency: string|null } | null}
 */
export function datosCambioUsd(input = {}) {
  const exchange = String(input.exchangeOperation || input.exchange_operation || '').toUpperCase();
  const payerCcy = String(
    input.payerCurrency || input.amounts?.payer?.currency_id || ''
  ).toUpperCase();
  const collectorCcy = String(
    input.collectorCurrency || input.amounts?.collector?.currency_id || ''
  ).toUpperCase();
  const destination = String(
    input.destinationAsset ||
    input.point_of_interaction?.transaction_data?.destination_asset ||
    ''
  ).toUpperCase();
  const branch = String(
    input.businessBranch ||
    input.point_of_interaction?.business_info?.branch ||
    ''
  ).toLowerCase();
  const subType = String(
    input.subType || input.point_of_interaction?.sub_type || ''
  ).toUpperCase();
  const op = String(input.operationType || input.operation_type || '').toLowerCase();
  if (destination && destination !== 'USD') return null;
  if (/marketplace|inversiones|\bfci\b/.test(branch)) return null;
  if (subType === 'SUBSCRIPTION') return null;
  if (esPagoOTarjeta(input)) return null;
  const esConversion = exchange === 'SELL' || exchange === 'BUY' || op === 'investment';
  if (!esConversion) return null;

  let movementKind = null;
  if (payerCcy === 'USD' || exchange === 'SELL') movementKind = MP_MOVEMENT_KINDS.FX_SELL;
  else if (collectorCcy === 'USD' || exchange === 'BUY') movementKind = MP_MOVEMENT_KINDS.FX_BUY;
  if (!movementKind) return null;

  const payerAmount = Number(input.amounts?.payer?.transaction ?? input.usdAmount ?? 0);
  const collectorAmount = Number(input.amounts?.collector?.transaction ?? input.usdAmount ?? 0);
  const usdAmount = movementKind === MP_MOVEMENT_KINDS.FX_SELL
    ? (payerCcy === 'USD' ? payerAmount : Number(input.usdAmount) || 0)
    : (collectorCcy === 'USD' ? collectorAmount : Number(input.usdAmount) || 0);
  const exchangeRate = Number(
    input.exchangeRate || input.point_of_interaction?.transaction_data?.exchange_rate || 0
  );
  return {
    movementKind,
    usdAmount,
    exchangeRate,
    exchangeOperation: exchange || null,
    payerCurrency: payerCcy || null,
    collectorCurrency: collectorCcy || null,
  };
}

/**
 * Movimiento que ya está en dólares: entra, sale o se usa para pagar.
 * Un cambio ARS/USD no entra acá; lo resuelve datosCambioUsd.
 * Un pago Master puede liquidar al comercio en pesos y igual sacar dólares del pagador.
 */
export function datosPosicionUsd(input = {}) {
  const exchange = String(input.exchangeOperation || input.exchange_operation || '').toUpperCase();
  if (exchange === 'SELL' || exchange === 'BUY') return null;

  const currency = String(input.currency || input.currency_id || input.currencyId || '').toUpperCase();
  const payerCcy = String(input.payerCurrency || input.amounts?.payer?.currency_id || '').toUpperCase();
  const collectorCcy = String(input.collectorCurrency || input.amounts?.collector?.currency_id || '').toUpperCase();
  const payerUsd = payerCcy === 'USD';
  const collectorUsd = collectorCcy === 'USD';
  const currencyUsd = currency === 'USD';
  if (!currencyUsd && !payerUsd && !collectorUsd) return null;

  const op = String(input.operationType || input.operation_type || '').toLowerCase();
  const medios = mediosDe(input);
  const esPago = op === 'regular_payment' || op === 'pos_payment'
    || medios.some((id) => (
      id === 'debit_card' || id === 'credit_card' || id === 'account_money' || id === 'available_money'
      || MP_DEBIT_METHOD_IDS.has(id) || MP_CREDIT_METHOD_IDS.has(id)
    ));
  const payerAmount = Math.abs(Number(input.amounts?.payer?.transaction ?? 0));
  const collectorAmount = Math.abs(Number(input.amounts?.collector?.transaction ?? 0));
  const face = Math.abs(Number(
    input.usdAmount ?? input.transaction_amount ?? input.amount ?? input.netAmount ?? 0
  ));

  let usd = 0;
  let movementKind = MP_MOVEMENT_KINDS.USD_IN;
  if (payerUsd && collectorCcy && !collectorUsd) {
    usd = payerAmount || (currencyUsd ? face : 0);
    movementKind = esPago ? MP_MOVEMENT_KINDS.USD_PAYMENT : MP_MOVEMENT_KINDS.USD_OUT;
  } else if (collectorUsd && payerCcy && !payerUsd) {
    usd = collectorAmount || (currencyUsd ? face : 0);
    movementKind = MP_MOVEMENT_KINDS.USD_IN;
  } else {
    usd = face || payerAmount || collectorAmount;
    if (esPago) movementKind = MP_MOVEMENT_KINDS.USD_PAYMENT;
    else if (op === 'withdrawal' || op === 'money_withdrawal' || op === 'payout') {
      movementKind = MP_MOVEMENT_KINDS.USD_OUT;
    } else if (op !== 'account_fund') {
      const net = Number(input.netAmount ?? input.amount ?? 0);
      if (net < 0) movementKind = MP_MOVEMENT_KINDS.USD_OUT;
    }
  }
  if (!usd) return null;
  return { movementKind, usdAmount: usd, currency: 'USD' };
}

/**
 * Compra del usuario pagada con tarjeta de crédito. El neto positivo es un
 * cobro (la plata entra) y se queda en el flujo. La validación de tarjeta no
 * es una compra.
 * @returns {{ movementKind: string } | null}
 */
export function datosCompraTarjeta(input = {}) {
  const operationType = String(
    input.operationType || input.operation_type || ''
  ).toLowerCase();
  if (operationType === 'card_validation') return null;
  const method = String(
    input.paymentMethod || input.payment_method || input.PAYMENT_METHOD || ''
  ).toLowerCase();
  const methodType = String(
    input.paymentMethodType ||
    input.payment_method_type ||
    input.PAYMENT_METHOD_TYPE ||
    input.raw?.PAYMENT_METHOD_TYPE ||
    ''
  ).toLowerCase();
  const methodId = String(
    input.paymentMethodId ||
    input.payment_method_id ||
    input.metadata?.paymentMethodId ||
    input.raw?.PAYMENT_METHOD ||
    ''
  ).toLowerCase();
  if (!medioEsCredito(method, methodType, methodId)) return null;
  const net = Number(input.netAmount ?? input.amount ?? NaN);
  if (!(Number.isFinite(net) && net < 0)) return null;
  return { movementKind: MP_MOVEMENT_KINDS.CARD_PURCHASE };
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

  // 1) Rendimientos de reserva/inversión: libro inversiones, no flujo operativo.
  if (YIELD_RE.test(blob)) {
    return {
      movementKind: MP_MOVEMENT_KINDS.INVESTMENT_YIELD,
      statsExclude: true,
      label: MP_MOVEMENT_KIND_LABELS.INVESTMENT_YIELD,
      isTransfer: false,
      isInternal: false
    };
  }

  // Cashback promocional es plata que entra al disponible. No es rendimiento.
  if (transactionType === 'CASHBACK') {
    return {
      movementKind: MP_MOVEMENT_KINDS.CASHBACK,
      statsExclude: false,
      label: MP_MOVEMENT_KIND_LABELS.CASHBACK,
      isTransfer: false,
      isInternal: false
    };
  }

  // 2) Dólares antes que el FCI: Mercado Pago también les pone operation_type investment.
  const cambio = datosCambioUsd(input);
  if (cambio) {
    return {
      movementKind: cambio.movementKind,
      statsExclude: true,
      label: MP_MOVEMENT_KIND_LABELS[cambio.movementKind],
      isTransfer: false,
      isInternal: false
    };
  }

  const posicionUsd = datosPosicionUsd(input);
  if (posicionUsd) {
    const pagoUsd = posicionUsd.movementKind === MP_MOVEMENT_KINDS.USD_PAYMENT;
    return {
      movementKind: posicionUsd.movementKind,
      statsExclude: true,
      label: MP_MOVEMENT_KIND_LABELS[posicionUsd.movementKind],
      isTransfer: !pagoUsd,
      isInternal: false
    };
  }

  // 3) Inversiones (FCI / asset management) antes que el regex de reserva:
  // asset_management_* no es el parking de Reserva.
  const looksInvestment =
    operationType === 'investment' ||
    INVESTMENT_OUT_RE.test(blob) ||
    INVESTMENT_IN_RE.test(blob) ||
    INVESTMENT_CODE_RE.test(blob);

  if (looksInvestment) {
    const branch = reserveBranchOf(input).toLowerCase();
    const txType = String(input.transactionType || input.raw?.TRANSACTION_TYPE || '').toUpperCase();
    const settlementCredit = txType.startsWith('SETTLEMENT') && netAmount > 0;
    const marketplace = /marketplace|inversiones|\bfci\b/.test(branch);
    let outgoing = false;
    if (INVESTMENT_OUT_RE.test(blob) && !INVESTMENT_IN_RE.test(blob)) {
      outgoing = true;
    } else if (INVESTMENT_IN_RE.test(blob) && !INVESTMENT_OUT_RE.test(blob)) {
      outgoing = false;
    } else if (settlementCredit) {
      outgoing = true;
    } else if (marketplace || operationType === 'investment') {
      // Pago al FCI: la plata sale de la cuenta aunque el monto venga positivo.
      outgoing = false;
    } else {
      outgoing = netAmount > 0;
    }
    const kind = outgoing
      ? MP_MOVEMENT_KINDS.INVESTMENT_OUT
      : MP_MOVEMENT_KINDS.INVESTMENT_IN;
    return {
      movementKind: kind,
      statsExclude: true,
      label: MP_MOVEMENT_KIND_LABELS[kind],
      isTransfer: false,
      isInternal: false
    };
  }

  // 4) Reservas / parking interno (NO deben entrar a stats de flujo).
  // partition_transfer + digital_accounts = disponible ↔ reserva dentro de MP.
  // No exigir !TRANSFER_RE: la descripción suele decir "· Transferencia".
  const looksReserveInternal =
    operationType === 'partition_transfer' ||
    RESERVE_INTERNAL_CODE_RE.test(blob) ||
    RESERVE_RELEASE_RE.test(blob) ||
    RESERVE_LOCK_RE.test(blob);

  const methodType = String(
    input.paymentMethodType ||
    input.PAYMENT_METHOD_TYPE ||
    input.raw?.PAYMENT_METHOD_TYPE ||
    metadata?.paymentMethodType ||
    metadata?.payment_method_type ||
    ''
  ).toLowerCase();
  const counterpartyReal = limpiarNombreContraparte(
    metadata?.counterpartyName || metadata?.businessName
  );
  const itemTitle = String(metadata?.itemTitle || '').trim();
  const itemReal = itemTitle && !/^producto sin descripci[oó]n$/i.test(itemTitle);
  const descriptionReal = String(description || metadata?.description || '').trim();
  // available_money sin comercio es un pago con dinero en cuenta. El reporte
  // no trae el nombre del comercio; no es un pase a reserva.

  if (looksReserveInternal) {
    const branch = reserveBranchOf({
      businessBranch: input.businessBranch || metadata?.businessBranch,
      metadata,
      point_of_interaction: input.payment?.point_of_interaction || input.point_of_interaction
    }).toLowerCase();
    // La etiqueta que escribimos nosotros ("Desde reserva") no es evidencia.
    const etiquetaPropia = /mercado\s*pago\s*-\s*(desde reserva|a reserva)\b/i.test(description);
    let release = false;
    if (branch.includes('am-to-pot')) release = false;
    else if (branch.includes('pot-to-am')) release = true;
    else if (!etiquetaPropia && RESERVE_RELEASE_RE.test(blob) && !RESERVE_LOCK_RE.test(blob)) {
      release = true;
    } else if (!etiquetaPropia && RESERVE_LOCK_RE.test(blob) && !RESERVE_RELEASE_RE.test(blob)) {
      release = false;
    } else {
      release = netAmount > 0;
    }
    return {
      movementKind: release
        ? MP_MOVEMENT_KINDS.RESERVE_RELEASE
        : MP_MOVEMENT_KINDS.RESERVE_LOCK,
      statsExclude: true,
      label: release
        ? MP_MOVEMENT_KIND_LABELS.RESERVE_RELEASE
        : MP_MOVEMENT_KIND_LABELS.RESERVE_LOCK,
      isTransfer: false,
      isInternal: true
    };
  }

  const methodId = String(
    paymentMethod || metadata?.paymentMethod || metadata?.paymentMethodId || ''
  ).trim();
  // Rendimiento diario de reserva, inversión o dinero en cuenta.
  // El settlement no dice "rendimiento": es un crédito sin medio y sin comercio.
  if (
    (transactionType === 'SETTLEMENT' || transactionType === 'SETTLEMENT_SHIPPING') &&
    !methodType &&
    !methodId &&
    !descriptionReal &&
    !counterpartyReal &&
    !itemReal &&
    netAmount > 0
  ) {
    return {
      movementKind: MP_MOVEMENT_KINDS.INVESTMENT_YIELD,
      statsExclude: true,
      label: MP_MOVEMENT_KIND_LABELS.INVESTMENT_YIELD,
      isTransfer: false,
      isInternal: false
    };
  }

  // Compra pagada con tarjeta: no sale de la billetera. El cobro con tarjeta
  // (neto positivo) sigue en el flujo.
  const tarjeta = datosCompraTarjeta(input);
  if (tarjeta) {
    return {
      movementKind: tarjeta.movementKind,
      statsExclude: true,
      label: MP_MOVEMENT_KIND_LABELS.CARD_PURCHASE,
      isTransfer: false,
      isInternal: false
    };
  }

  // 4) Comercio SETTLEMENT antes de heurística bank_transfer:
  // en AR el CSV trae PAYMENT_METHOD_TYPE=bank_transfer en ventas QR/DEBIN cobradas,
  // y NO son salidas CVU→CBU (esas son PAYOUTS/WITHDRAWAL).
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

  // 5) Transferencias reales / retiros
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
    paymentMethodLower === 'debin_transfer' ||
    paymentMethodLower.includes('debin') ||
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

  // 6) Comercio / disputas
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

/** Libro inversiones: reservas, aportes/rescates y rendimientos. YIELD es el kind viejo. */
export const MP_INVERSIONES_KINDS = Object.freeze([
  MP_MOVEMENT_KINDS.RESERVE_LOCK,
  MP_MOVEMENT_KINDS.RESERVE_RELEASE,
  MP_MOVEMENT_KINDS.INVESTMENT_IN,
  MP_MOVEMENT_KINDS.INVESTMENT_OUT,
  MP_MOVEMENT_KINDS.INVESTMENT_YIELD,
  MP_MOVEMENT_KINDS.YIELD
]);

/** Libro dólares: movimientos, compraventa y pagos en USD. No entran al flujo. */
export const MP_DOLARES_KINDS = Object.freeze([
  MP_MOVEMENT_KINDS.FX_SELL,
  MP_MOVEMENT_KINDS.FX_BUY,
  MP_MOVEMENT_KINDS.USD_IN,
  MP_MOVEMENT_KINDS.USD_OUT,
  MP_MOVEMENT_KINDS.USD_PAYMENT
]);

/** Libro créditos: compras con tarjeta. Los cobros con tarjeta no entran. */
export const MP_CREDITOS_KINDS = Object.freeze([
  MP_MOVEMENT_KINDS.CARD_PURCHASE
]);

export const MP_FLUJO_EXCLUDED_KINDS = Object.freeze([
  ...MP_INVERSIONES_KINDS,
  ...MP_DOLARES_KINDS,
  ...MP_CREDITOS_KINDS,
  MP_MOVEMENT_KINDS.INTERNAL
]);

const RENDIMIENTO_KINDS = new Set([
  MP_MOVEMENT_KINDS.INVESTMENT_YIELD,
  MP_MOVEMENT_KINDS.YIELD
]);

export function isInversionesMovementKind(kind) {
  return MP_INVERSIONES_KINDS.includes(kind);
}

export function isDolaresMovementKind(kind) {
  return MP_DOLARES_KINDS.includes(kind);
}

export function isCreditosMovementKind(kind) {
  return MP_CREDITOS_KINDS.includes(kind);
}

/**
 * Filtro de libro.
 * flujo: stats de caja (sin reservas, inversiones, rendimientos ni ajustes).
 * inversiones: solo ese libro.
 */
export function buildLedgerMatch(ledger = 'flujo') {
  if (ledger === 'inversiones') {
    return {
      'origen.metadata.movementKind': { $in: [...MP_INVERSIONES_KINDS] }
    };
  }
  if (ledger === 'dolares') {
    return {
      'origen.metadata.movementKind': { $in: [...MP_DOLARES_KINDS] }
    };
  }
  if (ledger === 'creditos') {
    return {
      'origen.metadata.movementKind': { $in: [...MP_CREDITOS_KINDS] }
    };
  }
  return {
    'origen.metadata.statsExclude': { $ne: true },
    'origen.metadata.isInternal': { $ne: true },
    'origen.metadata.movementKind': { $nin: [...MP_FLUJO_EXCLUDED_KINDS] }
  };
}

/**
 * Listados. El flujo oculta el libro inversiones y sigue mostrando ajustes internos.
 */
export function buildListLedgerMatch(ledger = 'flujo') {
  if (ledger === 'inversiones') return buildLedgerMatch('inversiones');
  if (ledger === 'dolares') return buildLedgerMatch('dolares');
  if (ledger === 'creditos') return buildLedgerMatch('creditos');
  return {
    'origen.metadata.movementKind': {
      $nin: [...MP_INVERSIONES_KINDS, ...MP_DOLARES_KINDS, ...MP_CREDITOS_KINDS]
    }
  };
}

/**
 * Recorta el libro a los kinds pedidos.
 * `none` no matchea nada. Vacío o ausente deja el libro completo.
 * En flujo se ignoran kinds del libro inversiones.
 */
export function applyMovementKindFilter(query, ledger, raw) {
  if (raw == null || raw === '') return;
  const requested = raw === 'none'
    ? []
    : [...new Set(String(raw).split(',').map((item) => item.trim()).filter(Boolean))];
  const allowed = requested.filter((kind) => {
    if (ledger === 'inversiones') return MP_INVERSIONES_KINDS.includes(kind);
    if (ledger === 'dolares') return MP_DOLARES_KINDS.includes(kind);
    if (ledger === 'creditos') return MP_CREDITOS_KINDS.includes(kind);
    return !MP_FLUJO_EXCLUDED_KINDS.includes(kind);
  });
  const field = 'origen.metadata.movementKind';
  const current = query[field] || {};
  if (current.$in) {
    const allow = new Set(allowed);
    query[field] = { ...current, $in: current.$in.filter((kind) => allow.has(kind)) };
    return;
  }
  query[field] = { ...current, $in: allowed };
}

const YIELD_INVERSION_RE = /asset_management|inversi|\bfci\b|investment/i;

/** El crédito diario sin texto es de la reserva. Solo pasa a la inversión si el movimiento lo dice. */
export function ladoRendimiento(texto = '') {
  return YIELD_INVERSION_RE.test(String(texto || '')) ? 'inversion' : 'reserva';
}

/** Suma montos de un grupo de kinds. Rendimiento resta los egresos (pérdidas). */
export function acumularBucketInversiones(kind, tipo, monto, yieldSide) {
  const amount = Number(monto) || 0;
  // La reserva se compara consigo misma. Un rescate de inversión no es plata que volvió de la reserva.
  if (kind === MP_MOVEMENT_KINDS.RESERVE_LOCK) return { enviado: amount };
  if (kind === MP_MOVEMENT_KINDS.RESERVE_RELEASE) return { rescatado: amount };
  if (kind === MP_MOVEMENT_KINDS.INVESTMENT_IN) return { ingresado: amount };
  if (kind === MP_MOVEMENT_KINDS.INVESTMENT_OUT) return { rescatadoInversion: amount };
  if (RENDIMIENTO_KINDS.has(kind)) {
    const signed = tipo === 'EGRESO' ? -amount : amount;
    if (yieldSide === 'inversion') return { rendimientosInversion: signed };
    return { rendimientosReserva: signed };
  }
  return {};
}

/** El settlement trae el neto en positivo para los dos lados. La dirección del dólar manda. */
export function tipoDeCambioUsd(kind) {
  if (kind === MP_MOVEMENT_KINDS.FX_SELL || kind === MP_MOVEMENT_KINDS.USD_IN) return 'INGRESO';
  if (
    kind === MP_MOVEMENT_KINDS.FX_BUY
    || kind === MP_MOVEMENT_KINDS.USD_OUT
    || kind === MP_MOVEMENT_KINDS.USD_PAYMENT
  ) return 'EGRESO';
  return null;
}

/**
 * Un reporte sin el pago adjunto no alcanza para ver el cambio.
 * Si la fila ya era de dólares, no la devolvemos a inversiones ni al flujo.
 */
export function conservarClasificacionUsd(prevMeta = {}, next = {}) {
  if (!isDolaresMovementKind(prevMeta.movementKind) || isDolaresMovementKind(next.movementKind)) {
    return next;
  }
  const kind = prevMeta.movementKind;
  return {
    ...next,
    movementKind: kind,
    statsExclude: true,
    isInternal: false,
    label: MP_MOVEMENT_KIND_LABELS[kind],
    usdAmount: next.usdAmount || prevMeta.usdAmount || 0,
    exchangeRate: next.exchangeRate || prevMeta.exchangeRate || 0,
    exchangeOperation: next.exchangeOperation || prevMeta.exchangeOperation || null,
    payerCurrency: next.payerCurrency || prevMeta.payerCurrency || null,
    collectorCurrency: next.collectorCurrency || prevMeta.collectorCurrency || null,
  };
}

/**
 * Un settlement sin el medio de pago no alcanza para ver la tarjeta.
 * Si la fila ya era una compra con tarjeta, no vuelve al flujo.
 */
export function conservarClasificacionTarjeta(prevMeta = {}, next = {}) {
  if (!isCreditosMovementKind(prevMeta.movementKind) || isCreditosMovementKind(next.movementKind)) {
    return next;
  }
  // Un pago en dólares que antes quedó como compra en pesos tiene que poder salir de Créditos.
  if (isDolaresMovementKind(next.movementKind)) return next;
  return {
    ...next,
    movementKind: MP_MOVEMENT_KINDS.CARD_PURCHASE,
    statsExclude: true,
    isInternal: false,
    label: MP_MOVEMENT_KIND_LABELS.CARD_PURCHASE,
    installments: next.installments || prevMeta.installments || 1,
    installmentAmount: next.installmentAmount || prevMeta.installmentAmount || 0,
    paymentMethod: next.paymentMethod || prevMeta.paymentMethod || 'credit_card',
    paymentMethodType: next.paymentMethodType || prevMeta.paymentMethodType || 'credit_card',
  };
}

/** Pesos y dólares de una compra o venta. `usd` es la cantidad de dólares, no el monto en pesos. */
export function acumularBucketDolares(kind, monto, usd) {
  const amount = Number(monto) || 0;
  const dollars = Number(usd) || 0;
  if (kind === MP_MOVEMENT_KINDS.FX_SELL) return { usdVendido: dollars, pesosVenta: amount };
  if (kind === MP_MOVEMENT_KINDS.FX_BUY) return { usdComprado: dollars, pesosCompra: amount };
  const face = dollars || amount;
  if (kind === MP_MOVEMENT_KINDS.USD_IN) return { usdRecibido: face };
  if (kind === MP_MOVEMENT_KINDS.USD_OUT) return { usdEnviado: face };
  if (kind === MP_MOVEMENT_KINDS.USD_PAYMENT) return { usdPagado: face };
  return {};
}

/**
 * Saldo de reserva importado: pases de todo el historial más el rendimiento acreditado en la reserva.
 * El rendimiento del período se muestra aparte.
 */
export function stockReserva({
  enviado = 0,
  rescatado = 0,
  rendimientosReserva = 0,
} = {}) {
  return (Number(enviado) || 0) - (Number(rescatado) || 0) + (Number(rendimientosReserva) || 0);
}

/** Saldo que quedó: reservado − volvió, más invertido − rescatado, más el rendimiento de cada cuenta. */
export function resultadoFci({
  enviado = 0,
  rescatado = 0,
  ingresado = 0,
  rescatadoInversion = 0,
  rendimientos = 0,
  rendimientosReserva = null,
  rendimientosInversion = null,
} = {}) {
  const reserva = (Number(enviado) || 0) - (Number(rescatado) || 0);
  const inversion = (Number(ingresado) || 0) - (Number(rescatadoInversion) || 0);
  const tienePartes = rendimientosReserva != null || rendimientosInversion != null;
  const rendimiento = tienePartes
    ? (Number(rendimientosReserva) || 0) + (Number(rendimientosInversion) || 0)
    : (Number(rendimientos) || 0);
  return reserva + inversion + rendimiento;
}

export function buildStatsExcludeMatch() {
  return buildLedgerMatch('flujo');
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
  const explicitDebit = /\b(debit|withdrawal|payout|money_out|outgoing|withdraw)\b/.test(typeHint);
  const explicitCredit = /\b(credit|incoming|income|account_fund|money_in)\b/.test(typeHint);
  let signedNet;
  if (explicitCredit && !explicitDebit) signedNet = Math.abs(amountRaw);
  else if (explicitDebit && !explicitCredit) signedNet = -Math.abs(amountRaw);
  else if (Number(mov.net_debit_amount) > 0 && !(Number(mov.net_credit_amount) > 0)) {
    signedNet = -Math.abs(amountRaw);
  } else if (Number(mov.amount) < 0) signedNet = -Math.abs(amountRaw);
  else if (Number(mov.amount) > 0 || Number(mov.net_credit_amount) > 0) signedNet = Math.abs(amountRaw);
  else signedNet = amountRaw < 0 ? amountRaw : -Math.abs(amountRaw);

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

const HISTORY_DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD se lee como inicio del día en Argentina. Un ISO se usa tal cual. */
export function parseHistorySince(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00.000-03:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Inicio de la ventana diaria. No retrocede más allá de esos días. */
export function dailySyncSince(now = new Date(), days = getMpSyncDays()) {
  const span = Number.isFinite(days) && days > 0 ? days : 90;
  return new Date(now.getTime() - span * HISTORY_DAY_MS);
}

function formatHistoryDay(date) {
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

/**
 * Siguiente mes a importar, caminando hacia atrás.
 * Sin cubiertoHasta, el borde es el inicio de la ventana diaria.
 * Null cuando el objetivo ya está adentro de lo cubierto.
 */
export function nextHistoryChunk({
  targetSince,
  coveredUntil = null,
  now = new Date(),
  syncDays = getMpSyncDays(),
} = {}) {
  const target = parseHistorySince(targetSince);
  if (!target) return null;
  const edge = coveredUntil ? parseHistorySince(coveredUntil) : dailySyncSince(now, syncDays);
  if (!edge || edge.getTime() <= target.getTime()) return null;
  const begin = new Date(edge);
  begin.setMonth(begin.getMonth() - 1);
  if (begin.getTime() < target.getTime()) begin.setTime(target.getTime());
  return {
    objetivo: target.toISOString(),
    beginDate: begin.toISOString(),
    endDate: edge.toISOString(),
    quedaHistorial: begin.getTime() > target.getTime(),
    mesLabel: `${formatHistoryDay(begin)} – ${formatHistoryDay(new Date(edge.getTime() - 1))}`,
  };
}

export function formatearDescripcionMovimiento(row) {
  const tipoRaw =
    row.TRANSACTION_TYPE || row.transaction_type || row.transactionType || row.type || 'Movimiento';
  const tipoLabel = mapearTipoTransaccionMp(tipoRaw);
  const metodo = row.PAYMENT_METHOD || row.payment_method || row.paymentMethod || '';
  const description = limpiarNombreContraparte(row.DESCRIPTION || row.description || '');
  const contraparte = extraerContraparteMovimiento(row);
  const economic = clasificarMovimientoEconomicoMp(row);

  if (
    isInversionesMovementKind(economic.movementKind) ||
    isDolaresMovementKind(economic.movementKind) ||
    economic.isInternal
  ) {
    return `MercadoPago - ${economic.label}`;
  }
  if (economic.movementKind === MP_MOVEMENT_KINDS.CASHBACK) {
    return 'MercadoPago - Cashback';
  }

  if (contraparte?.name) {
    return `MercadoPago - ${contraparte.name}`;
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
