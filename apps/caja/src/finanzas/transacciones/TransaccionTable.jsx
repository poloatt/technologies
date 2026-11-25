import React, { useState } from 'react';
import {
  Box,
  Chip,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useResponsive } from '@shared/hooks';
import { formatFinanzasMonto, formatFinanzasMontoCompact } from '@shared/utils/formatFinanzasMonto';
import {
  buildTransactionListMeta,
  formatMpTransactionTitle,
  formatPaymentMethodLabel,
  getComisionesTotal,
  getCounterparty,
  getOrigenMetadata,
  hasNetoDistinct,
  isMercadoPagoOrigen,
  isMpInternalAccountMovement,
  isNeutralLedgerRow,
  isYieldLedgerRow,
  ledgerCompactLabel,
  neutralLedgerCaption,
  neutralLedgerOrigin,
  formatMpInternalReserveTitle,
  mapearTipoTransaccionMpDisplay,
} from '@shared/utils/mpDisplayUtils';
import { getEstadoColor, getStatusIconComponent } from '@shared/components/common/StatusSystem';
import { dolarSignedAmount } from './ledgerKindFilters';
import {
  EditOutlined as EditIcon,
  DeleteOutlined as DeleteIcon,
  AccountBalanceOutlined as AccountIcon,
  Receipt,
  Fastfood,
  HealthAndSafety,
  Checkroom as Shirt,
  LocalBar as Cocktail,
  DirectionsBus,
  Devices,
  MoreHoriz,
  SouthWestRounded,
  NorthEastRounded,
  AccountBalanceWalletOutlined,
  SwapHorizRounded,
} from '@mui/icons-material';

function DetailRow({ label, value, icon = null }) {
  if (value == null || value === '') return null;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        minHeight: 28,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          flexShrink: 0,
        }}
      >
        {icon}
        {label}
      </Typography>
      <Box
        sx={{
          fontSize: '0.8125rem',
          color: 'text.primary',
          textAlign: 'right',
          fontWeight: 500,
          lineHeight: 1.3,
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

function positionSign(kind, tipo) {
  if (kind === 'RESERVE_LOCK' || kind === 'INVESTMENT_IN' || kind === 'FX_SELL' || kind === 'USD_IN') return '+';
  // Un rescate de reserva puede entrar a la cuenta (INGRESO): el signo depende del tipo.
  if (kind === 'RESERVE_RELEASE') return tipo === 'INGRESO' ? '+' : '−';
  if (kind === 'INVESTMENT_OUT' || kind === 'FX_BUY' || kind === 'USD_OUT' || kind === 'USD_PAYMENT') return '−';
  return tipo === 'EGRESO' ? '−' : '+';
}

function formatUsdList(monto, showValues) {
  if (!showValues) return 'U$D ••••';
  const n = Number(monto) || 0;
  const body = Math.abs(n).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (n < 0) return `−U$D ${body}`;
  if (n > 0) return `+U$D ${body}`;
  return `U$D ${body}`;
}

const TransaccionTable = ({
  transacciones,
  onEdit,
  onDelete,
  showValues = true,
  variant = 'default',
  inColor,
}) => {
  const [expandedRow, setExpandedRow] = useState(null);
  const { isMobile, theme } = useResponsive();
  const isAccountDetail = variant === 'accountDetail';
  const ledgerRows = variant === 'ledger';

  const handleRowClick = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const getMontoColor = (transaccion, { internal = false } = {}) => {
    if (internal) return 'text.disabled';
    return transaccion.tipo === 'INGRESO'
      ? (transaccion.cuenta?.moneda?.color || 'success.main')
      : 'error.main';
  };

  const formatMonto = (monto, compact = true) => {
    if (!showValues) return '****';
    const simbolo = '';
    return compact
      ? formatFinanzasMontoCompact(monto, { simbolo })
      : formatFinanzasMonto(monto, { simbolo });
  };

  const formatFechaFull = (fecha) => {
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatEstado = (estado) => {
    if (!estado) return '—';
    let normalized = estado;
    if (estado === 'PAGADO') normalized = 'COMPLETADA';
    if (estado === 'CANCELADO') normalized = 'CANCELADA';
    return normalized.charAt(0) + normalized.slice(1).toLowerCase();
  };

  const getEstadoIcon = (estado) => {
    let estadoNormalizado = estado;
    if (estado === 'PAGADO') estadoNormalizado = 'COMPLETADA';
    if (estado === 'CANCELADO') estadoNormalizado = 'CANCELADA';
    const color = getEstadoColor(estadoNormalizado, 'TRANSACCION');
    const iconElement = getStatusIconComponent(estadoNormalizado, 'TRANSACCION');
    return React.cloneElement(iconElement, { sx: { fontSize: 16, color } });
  };

  const getRowIcon = (transaccion, { internal = false } = {}) => {
    const common = { sx: { fontSize: 18 } };

    if (internal) {
      return (
        <SwapHorizRounded
          sx={{ ...common.sx, color: 'text.disabled', fontSize: 14 }}
        />
      );
    }

    const mp = isMercadoPagoOrigen(transaccion.origen);
    if (mp) {
      return (
        <AccountBalanceWalletOutlined
          sx={{
            ...common.sx,
            color: transaccion.tipo === 'INGRESO' ? 'success.main' : 'text.secondary',
          }}
        />
      );
    }

    if (transaccion.tipo === 'INGRESO') {
      return <SouthWestRounded sx={{ ...common.sx, color: 'success.main' }} />;
    }
    if (transaccion.tipo === 'EGRESO') {
      return <NorthEastRounded sx={{ ...common.sx, color: 'error.main' }} />;
    }

    const iconProps = { sx: { fontSize: 18, color: 'text.secondary' } };
    switch (transaccion.categoria) {
      case 'Contabilidad y Facturas':
        return <Receipt {...iconProps} />;
      case 'Comida y Mercado':
        return <Fastfood {...iconProps} />;
      case 'Salud y Belleza':
        return <HealthAndSafety {...iconProps} />;
      case 'Ropa':
        return <Shirt {...iconProps} />;
      case 'Fiesta':
        return <Cocktail {...iconProps} />;
      case 'Transporte':
        return <DirectionsBus {...iconProps} />;
      case 'Tecnología':
        return <Devices {...iconProps} />;
      default:
        return <MoreHoriz {...iconProps} />;
    }
  };

  const simbolo = (t) => t.cuenta?.moneda?.simbolo || '$';

  return (
    <TableContainer
      sx={{
        width: '100%',
        overflowX: 'auto',
        backgroundColor: 'transparent',
        '& .MuiTableCell-root': {
          border: 'none',
          py: isAccountDetail ? 1.25 : 1,
          px: 1.5,
          fontSize: '0.875rem',
          lineHeight: 1.25,
          whiteSpace: 'normal',
        },
        '& .MuiTableRow-root': {
          borderBottom: '1px solid',
          borderColor: 'divider',
        },
        '& .MuiTableRow-root:last-of-type': {
          borderBottom: 'none',
        },
      }}
    >
      <Table size="small" sx={{ minWidth: isMobile ? 'unset' : 420 }}>
        <TableBody>
          {transacciones.map((transaccion) => {
            const rowId = transaccion.id || transaccion._id;
            const expanded = expandedRow === rowId;
            const ledgerMove = ledgerRows || isNeutralLedgerRow(transaccion);
            const yieldRow = isYieldLedgerRow(transaccion);
            const internal = ledgerMove || isMpInternalAccountMovement(transaccion);
            const meta = getOrigenMetadata(transaccion.origen);
            const amountSign = ledgerRows
              ? positionSign(meta.movementKind, transaccion.tipo)
              : (transaccion.tipo === 'EGRESO' ? '−' : '+');
            const dolarNeto = ledgerRows ? dolarSignedAmount(transaccion) : null;
            const dolarColor = dolarNeto == null
              ? null
              : (dolarNeto < 0 ? 'error.main' : (inColor || 'text.primary'));
            const titled = formatMpTransactionTitle(
              transaccion.descripcion,
              transaccion.origen
            );
            const compactLabel = ledgerCompactLabel(transaccion);
            const title = compactLabel
              ? compactLabel
              : ledgerMove
                ? titled
                : internal
                  ? formatMpInternalReserveTitle(transaccion)
                  : titled;
            const counterparty = internal ? null : getCounterparty(transaccion);
            const metaLine = buildTransactionListMeta(transaccion, {
              includeDate: true,
            });
            const mpOrigen = isMercadoPagoOrigen(transaccion.origen);
            const comisionesTotal = getComisionesTotal(transaccion);
            const showNeto = !internal && hasNetoDistinct(transaccion);
            const methodLabel = formatPaymentMethodLabel(
              meta.paymentMethod,
              meta.paymentMethodId
            );
            const typeLabel = mapearTipoTransaccionMpDisplay(meta.transactionType);
            const origenLabel = internal
              ? neutralLedgerOrigin(transaccion)
              : transaccion.origen?.tipo === 'MERCADOPAGO_MOVIMIENTO'
                ? 'Movimiento de wallet'
                : transaccion.origen?.tipo === 'MERCADOPAGO_PAGO'
                  ? 'Pago Mercado Pago'
                  : null;

            return (
              <React.Fragment key={rowId}>
                <TableRow
                  onClick={() => handleRowClick(rowId)}
                  sx={{
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    bgcolor: expanded ? 'action.hover' : 'transparent',
                    opacity: internal && !yieldRow && dolarNeto == null ? 0.72 : 1,
                    '&:hover': { bgcolor: 'action.hover', opacity: internal && !yieldRow && dolarNeto == null ? 0.9 : 1 },
                  }}
                >
                  <TableCell
                    sx={{
                      width: '100%',
                      py: internal ? 0.25 : undefined,
                    }}
                  >
                    {internal ? (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                          minHeight: 20,
                        }}
                      >
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            bgcolor: 'transparent',
                          }}
                        >
                          {getRowIcon(transaccion, { internal: true })}
                        </Box>
                        <Box
                          sx={{
                            minWidth: 0,
                            flex: 1,
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 0.65,
                            flexWrap: 'nowrap',
                            overflow: 'hidden',
                          }}
                        >
                          <Typography
                            sx={{
                              fontWeight: 450,
                              fontSize: '0.75rem',
                              color: 'text.secondary',
                              lineHeight: 1.15,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {title}
                          </Typography>
                          {!compactLabel && metaLine && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'text.disabled',
                                fontSize: '0.6875rem',
                                lineHeight: 1.15,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {metaLine}
                            </Typography>
                          )}
                        </Box>
                        <Typography
                          sx={{
                            fontWeight: yieldRow ? 650 : 500,
                            fontSize: '0.75rem',
                            color: dolarColor || (yieldRow ? getMontoColor(transaccion) : 'text.disabled'),
                            fontVariantNumeric: 'tabular-nums',
                            lineHeight: 1.15,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {dolarNeto == null
                            ? `${amountSign}${simbolo(transaccion)} ${formatMonto(transaccion.monto)}`
                            : formatUsdList(dolarNeto, showValues)}
                        </Typography>
                      </Box>
                    ) : (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          bgcolor: 'action.hover',
                          mt: 0.15,
                        }}
                      >
                        {getRowIcon(transaccion)}
                      </Box>

                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: 1.5,
                          }}
                        >
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            {counterparty?.label && counterparty?.name && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', lineHeight: 1.2, mb: 0.15 }}
                              >
                                {counterparty.label}
                              </Typography>
                            )}
                            <Typography
                              sx={{
                                fontWeight: 560,
                                fontSize: '0.875rem',
                                color: 'text.primary',
                                lineHeight: 1.3,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                            >
                              {title}
                            </Typography>
                          </Box>

                          <Box sx={{ textAlign: 'right', flexShrink: 0, minWidth: 88 }}>
                            <Typography
                              sx={{
                                fontWeight: 650,
                                fontSize: '0.875rem',
                                color: getMontoColor(transaccion),
                                fontVariantNumeric: 'tabular-nums',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {transaccion.tipo === 'EGRESO' ? '−' : '+'}
                              {simbolo(transaccion)} {formatMonto(transaccion.monto)}
                            </Typography>
                            {showNeto && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', fontVariantNumeric: 'tabular-nums' }}
                              >
                                neto {simbolo(transaccion)} {formatMonto(transaccion.montoNeto)}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 0.75,
                            mt: 0.5,
                          }}
                        >
                          <Chip
                            size="small"
                            label={transaccion.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              borderRadius: 1,
                              bgcolor:
                                transaccion.tipo === 'INGRESO'
                                  ? 'success.main'
                                  : 'error.main',
                              color: 'common.white',
                              opacity: 0.9,
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                          {mpOrigen && (
                            <Chip
                              size="small"
                              label="MP"
                              variant="outlined"
                              sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                borderRadius: 1,
                                borderColor: 'divider',
                                color: 'text.secondary',
                                '& .MuiChip-label': { px: 0.75 },
                              }}
                            />
                          )}
                          {metaLine && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                lineHeight: 1.2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: { xs: '58vw', sm: 360 },
                              }}
                            >
                              {metaLine}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>
                    )}
                  </TableCell>
                </TableRow>

                {expanded && (
                <TableRow>
                  <TableCell sx={{ p: 0 }}>
                      <Box
                        sx={{
                          mx: 1.5,
                          mb: 1.25,
                          mt: 0.25,
                          px: 1.5,
                          py: 1.25,
                          borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: internal ? 'action.hover' : 'background.paper',
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                          {internal && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'text.secondary',
                                lineHeight: 1.35,
                                mb: 0.25,
                              }}
                            >
                              {neutralLedgerCaption(transaccion)}
                            </Typography>
                          )}
                          <DetailRow label="Fecha" value={formatFechaFull(transaccion.fecha)} />
                          {!internal && (
                            <DetailRow
                              label="Estado"
                              value={
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                  {getEstadoIcon(transaccion.estado)}
                                  {formatEstado(transaccion.estado)}
                                </Box>
                              }
                            />
                          )}
                          {transaccion.cuenta?.nombre && (
                            <DetailRow
                              label="Cuenta"
                              icon={<AccountIcon sx={{ fontSize: 14 }} />}
                              value={transaccion.cuenta.nombre}
                            />
                          )}
                          {!internal && transaccion.categoria && (
                            <DetailRow label="Categoría" value={transaccion.categoria} />
                          )}
                          {!internal && counterparty?.name && (
                            <DetailRow
                              label={counterparty.label || 'Contraparte'}
                              value={
                                counterparty.email
                                  ? `${counterparty.name} (${counterparty.email})`
                                  : counterparty.name
                              }
                            />
                          )}
                          {origenLabel && <DetailRow label="Origen" value={origenLabel} />}
                          {!internal && typeLabel && <DetailRow label="Tipo MP" value={typeLabel} />}
                          {!internal && methodLabel && <DetailRow label="Método" value={methodLabel} />}
                          {!internal && meta.description && meta.description !== counterparty?.name && (
                            <DetailRow label="Detalle MP" value={meta.description} />
                          )}
                          {!internal && meta.installments > 1 && (
                            <DetailRow label="Cuotas" value={`${meta.installments}`} />
                          )}

                          {!internal && (showNeto || comisionesTotal > 0) && (
                            <>
                              <Divider sx={{ my: 0.5 }} />
                              <DetailRow
                                label="Monto bruto"
                                value={`${simbolo(transaccion)} ${formatMonto(transaccion.monto, false)}`}
                              />
                              {comisionesTotal > 0 && (
                                <DetailRow
                                  label="Comisiones"
                                  value={`− ${simbolo(transaccion)} ${formatMonto(comisionesTotal, false)}`}
                                />
                              )}
                              {transaccion.comisiones?.mercadopago > 0 && (
                                <DetailRow
                                  label="· Mercado Pago"
                                  value={`${simbolo(transaccion)} ${formatMonto(transaccion.comisiones.mercadopago, false)}`}
                                />
                              )}
                              {transaccion.comisiones?.financieras > 0 && (
                                <DetailRow
                                  label="· Financiación"
                                  value={`${simbolo(transaccion)} ${formatMonto(transaccion.comisiones.financieras, false)}`}
                                />
                              )}
                              {showNeto && (
                                <DetailRow
                                  label="Monto neto"
                                  value={`${simbolo(transaccion)} ${formatMonto(transaccion.montoNeto, false)}`}
                                />
                              )}
                            </>
                          )}
                        </Box>

                        {(onEdit || onDelete) && (
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              gap: 0.5,
                              mt: 1.25,
                              pt: 1,
                              borderTop: '1px solid',
                              borderColor: 'divider',
                            }}
                          >
                            {onEdit && (
                              <Tooltip title="Editar" arrow>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(transaccion);
                                  }}
                                  sx={{
                                    color: 'text.secondary',
                                    '&:hover': {
                                      color: 'primary.main',
                                      bgcolor: theme.palette.primary.main + '14',
                                    },
                                  }}
                                >
                                  <EditIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {onDelete && (
                              <Tooltip title="Eliminar" arrow>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(transaccion);
                                  }}
                                  sx={{
                                    color: 'text.secondary',
                                    '&:hover': {
                                      color: 'error.main',
                                      bgcolor: theme.palette.error.main + '14',
                                    },
                                  }}
                                >
                                  <DeleteIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        )}
                      </Box>
                  </TableCell>
                </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default TransaccionTable;
