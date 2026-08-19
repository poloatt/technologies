import React from 'react';
import { Box, CircularProgress, Skeleton, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { cuentaDetailPath } from '../finanzasDeepLink';
import getCuentaTipoIcon from './getCuentaTipoIcon';
import { getHubSubsectionSx } from '@shared/styles/hubSectionStyles';
import { getHubListRowSx, hubLabelSx, hubValueSx } from '../../hub';
import { CUENTA_HUB_ROW, getMonedaFromCuenta } from './cuentaConstants';
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

function CuentaRow({ cuenta, selected = false, onSelect, branchId = 'finanzas' }) {
  const navigate = useNavigate();
  const { showValues } = useValuesVisibility();
  const cuentaId = cuenta.id || cuenta._id;
  const { balance, loading } = useCuentaBalance(cuentaId);
  const { simbolo, color } = getMonedaFromCuenta(cuenta);

  const handleClick = (e) => {
    e.stopPropagation();
    if (onSelect) onSelect(cuentaId);
    else navigate(cuentaDetailPath(cuentaId, branchId));
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
      <Typography
        variant="caption"
        noWrap
        sx={{
          ...hubValueSx,
          mt: 0,
          color: balance >= 0 ? color : 'error.main',
          opacity: loading ? 0.5 : 1,
          flexShrink: 0,
        }}
      >
        {formatBalance(balance, showValues, loading, simbolo)}
        {loading && (
          <CircularProgress size={8} thickness={4} sx={{ ml: 0.5, verticalAlign: 'middle' }} />
        )}
      </Typography>
    </Box>
  );
}

export default React.memo(CuentaRow);
