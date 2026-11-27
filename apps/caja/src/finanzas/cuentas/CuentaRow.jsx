import React from 'react';
import { Box, CircularProgress, Skeleton, Typography } from '@mui/material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { useCajaSetup } from '../../atta/useCajaSetup';
import getCuentaTipoIcon from './getCuentaTipoIcon';
import { getHubSubsectionSx } from '@shared/styles/hubSectionStyles';
import { getHubListRowSx, hubLabelSx, hubValueSx } from '../../hub';
import {
  CUENTA_HUB_ROW,
  getMonedaFromCuenta,
  getMonedasFromCuenta,
  isCuentaMultimoneda,
  saldoReportadoMercadoPago,
} from './cuentaConstants';
import { useCuentaBalance } from './useCuentaBalance';

function formatBalance(balance, showValues, loading, simbolo) {
  if (loading) return '…';
  if (!showValues) return '****';
  return `${simbolo} ${balance.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function CuentaRowSkeleton() {
  return (
    <Skeleton
      variant="rounded"
      height={CUENTA_HUB_ROW.minHeight}
      animation="wave"
      sx={{
        ...getHubSubsectionSx(),
        mb: CUENTA_HUB_ROW.mb,
        minHeight: CUENTA_HUB_ROW.minHeight,
      }}
    />
  );
}

function CuentaRow({ cuenta, selected = false, onSelect }) {
  const { openSetup } = useCajaSetup();
  const { showValues } = useValuesVisibility();
  const cuentaId = cuenta.id || cuenta._id;
  const { balance, balanceByMonedaId, loading } = useCuentaBalance(cuentaId);
  const saldoMp = saldoReportadoMercadoPago(cuenta);
  const saldo = saldoMp != null ? saldoMp : balance;
  const { simbolo, color } = getMonedaFromCuenta(cuenta);
  const isMultimoneda = isCuentaMultimoneda(cuenta);
  const monedasHabilitadas = isMultimoneda ? getMonedasFromCuenta(cuenta) : [];

  const handleClick = (e) => {
    e.stopPropagation();
    if (onSelect) onSelect(cuentaId);
    else openSetup('cuentas', { cuentaId });
  };

  return (
    <Box
      id={`cuenta-row-${cuentaId}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e);
        }
      }}
      sx={{
        ...getHubListRowSx({ selected }),
        height: 'auto',
        minHeight: CUENTA_HUB_ROW.minHeight,
        py: CUENTA_HUB_ROW.py,
        px: CUENTA_HUB_ROW.px,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: CUENTA_HUB_ROW.gap,
        mb: CUENTA_HUB_ROW.mb,
        cursor: 'pointer',
        '&:last-child': { mb: 0 },
        '&:hover': {
          bgcolor: 'action.selected',
        },
      }}
    >
      {getCuentaTipoIcon(cuenta.tipo, { fontSize: 16 })}
      <Typography variant="caption" noWrap sx={{ ...hubLabelSx, flex: 1, textTransform: 'none' }}>
        {cuenta.nombre}
      </Typography>
      {isMultimoneda && monedasHabilitadas.length > 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {monedasHabilitadas.map((moneda) => {
            const saldoMoneda = balanceByMonedaId[moneda.id] ?? 0;
            return (
              <Typography
                key={moneda.id}
                variant="caption"
                noWrap
                sx={{
                  ...hubValueSx,
                  mt: 0,
                  color: saldoMoneda >= 0 ? moneda.color : 'error.main',
                  opacity: loading ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                {formatBalance(saldoMoneda, showValues, loading, moneda.simbolo)}
              </Typography>
            );
          })}
        </Box>
      ) : (
        <Typography
          variant="caption"
          noWrap
          sx={{
            ...hubValueSx,
            mt: 0,
            color: saldo >= 0 ? color : 'error.main',
            opacity: loading && saldoMp == null ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          {formatBalance(saldo, showValues, loading && saldoMp == null, simbolo)}
          {loading && (
            <CircularProgress size={8} thickness={4} sx={{ ml: 0.5, verticalAlign: 'middle' }} />
          )}
        </Typography>
      )}
    </Box>
  );
}

export default React.memo(CuentaRow);
