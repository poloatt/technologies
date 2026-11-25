import React from 'react';
import { Box, Chip, IconButton, Typography } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import { formatFinanzasMonto } from '@shared/utils/formatFinanzasMonto';
import { formatRelativeSyncTime } from '@shared/utils/mpDisplayUtils';
import getCuentaTipoIcon from './getCuentaTipoIcon';
import { getMonedaFromCuenta } from './cuentaConstants';
import CuentaWalletActions from './CuentaWalletActions';

export default function CuentaWalletHeader({
  cuenta,
  conexion,
  saldoCalculado,
  syncing = false,
  importing = false,
  onSync,
  onImportCsv,
  onClose,
  branchId = 'finanzas',
}) {
  const { showValues } = useValuesVisibility();
  const { simbolo, color } = getMonedaFromCuenta(cuenta);
  const isMercadoPago = cuenta?.tipo === 'MERCADO_PAGO';

  const saldoMp = cuenta?.mercadopago?.disponibleRetiro ?? (isMercadoPago ? cuenta?.saldo : null);
  const saldoMpNumero = saldoMp == null || Number.isNaN(Number(saldoMp)) ? null : Number(saldoMp);

  const heroBalance = saldoMpNumero != null ? saldoMpNumero : saldoCalculado;
  const heroColor = heroBalance >= 0 ? color : 'error.main';

  const ultimaSync =
    conexion?.configuracion?.ultimaSincronizacion ||
    conexion?.mercadopago?.ultimaSincronizacion;

  const syncParcial = conexion?.mercadopago?.syncParcial;

  let estadoChip = null;
  if (isMercadoPago && conexion) {
    if (syncParcial) {
      estadoChip = { label: 'Sync parcial', color: 'warning' };
    } else {
      estadoChip = { label: 'Conectada', color: 'success' };
    }
  } else if (isMercadoPago && !conexion) {
    estadoChip = { label: 'Desconectada', color: 'default' };
  }

  return (
    <Box
      sx={{
        px: 2,
        py: 2,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            {getCuentaTipoIcon(cuenta?.tipo, { fontSize: 20 })}
            <Typography variant="subtitle1" noWrap sx={{ flex: 1 }}>
              {cuenta?.nombre}
            </Typography>
          </Box>

          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: heroColor,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {showValues
              ? formatFinanzasMonto(heroBalance, { simbolo })
              : '****'}
          </Typography>

          {isMercadoPago && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 1 }}>
              {estadoChip && (
                <Chip
                  label={estadoChip.label}
                  size="small"
                  color={estadoChip.color}
                  variant="outlined"
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
              )}
              {ultimaSync && (
                <Typography variant="caption" color="text.secondary">
                  Última sync: {formatRelativeSyncTime(ultimaSync)}
                </Typography>
              )}
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {onClose && (
            <IconButton size="small" onClick={onClose} aria-label="Volver">
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          {isMercadoPago && (
            <CuentaWalletActions
              cuentaId={cuenta?.id || cuenta?._id}
              conexion={conexion}
              branchId={branchId}
              syncing={syncing}
              importing={importing}
              onSync={onSync}
              onImportCsv={onImportCsv}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}
