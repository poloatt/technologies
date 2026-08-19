import React, { useCallback, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import {
  AccountBalanceOutlined as AccountBalanceIcon,
  Sync as SyncIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useAPI } from '@shared/hooks/useAPI';
import { useMercadoPago } from '@shared/hooks/useMercadoPago';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import clienteAxios from '@shared/config/axios';
import { TransaccionTable } from '../transacciones';
import { MercadoPagoPartialSyncAlert } from '../conexiones/MercadoPagoPartialSyncBanner';
import { getCuentasPath } from '../finanzasDeepLink';
import { useCuentaBalance } from './useCuentaBalance';
import CuentaWalletHeader from './CuentaWalletHeader';

export default function CuentaTransaccionesPanel({
  cuenta,
  onRefresh,
  embedded = false,
  branchId = 'finanzas',
}) {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { syncConnection, loading: syncing } = useMercadoPago();
  const { showValues } = useValuesVisibility();
  const [importing, setImporting] = useState(false);

  const cuentaId = cuenta?.id || cuenta?._id;
  const isMercadoPago = cuenta?.tipo === 'MERCADO_PAGO';

  const { balance: saldoCalculado, loading: saldoCalculadoLoading } = useCuentaBalance(cuentaId);

  const { data: transaccionesData, loading, refetch } = useAPI(
    cuentaId ? `/api/transacciones/by-cuenta/${cuentaId}` : null,
    {
      params: { limit: 500, sort: '-fecha', estado: 'PAGADO' },
      dependencies: [cuentaId],
      enableCache: false,
    }
  );

  const { data: conexionesData } = useAPI(
    isMercadoPago && cuentaId ? '/api/bankconnections' : null,
    {
      params: {
        limit: 10,
        filter: JSON.stringify({ tipo: 'MERCADOPAGO', cuenta: cuentaId }),
      },
      dependencies: [cuentaId, isMercadoPago],
      enableCache: true,
    }
  );

  const transacciones = transaccionesData?.docs || [];
  const conexion = conexionesData?.docs?.[0];

  const handleClose = () => {
    navigate(getCuentasPath(branchId), { replace: true });
  };

  const handleSync = async () => {
    if (!conexion?._id) return;
    try {
      await syncConnection(conexion._id);
      await refetch();
      onRefresh?.();
    } catch (err) {
      enqueueSnackbar(err.message || 'Error al sincronizar', { variant: 'error' });
    }
  };

  const handleImportCsv = async (file) => {
    if (!file || !conexion?._id) return;
    try {
      setImporting(true);
      const csvContent = await file.text();
      await clienteAxios.post(
        `/api/bankconnections/mercadopago/importar-csv/${conexion._id}`,
        { csvContent }
      );
      enqueueSnackbar('CSV importado correctamente', { variant: 'success' });
      await refetch();
      onRefresh?.();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Error importando CSV', { variant: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = useCallback(async (transaccion) => {
    try {
      await clienteAxios.delete(`/api/transacciones/${transaccion._id || transaccion.id}`);
      await refetch();
      onRefresh?.();
    } catch {
      enqueueSnackbar('Error al eliminar transacción', { variant: 'error' });
    }
  }, [refetch, onRefresh, enqueueSnackbar]);

  if (!cuenta) return null;

  const Wrapper = embedded ? Box : Paper;
  const wrapperProps = embedded
    ? { sx: { overflow: 'hidden' } }
    : { sx: { mt: 2, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' } };

  return (
    <Wrapper {...wrapperProps}>
      <CuentaWalletHeader
        cuenta={cuenta}
        conexion={conexion}
        saldoCalculado={saldoCalculado}
        saldoCalculadoLoading={saldoCalculadoLoading}
        syncing={syncing}
        importing={importing}
        onSync={handleSync}
        onImportCsv={handleImportCsv}
        onClose={handleClose}
        branchId={branchId}
      />

      {isMercadoPago && conexion && (
        <Box sx={{ px: 2, pt: 1 }}>
          <MercadoPagoPartialSyncAlert
            conexion={{
              syncParcial: conexion.mercadopago?.syncParcial,
              reportePendiente: conexion.mercadopago?.reportePendiente,
              ultimoErrorSettlement: conexion.mercadopago?.ultimoErrorSettlement,
            }}
            onImportClick={() => document.getElementById(`mp-csv-input-${cuentaId}`)?.click()}
          />
          <input
            id={`mp-csv-input-${cuentaId}`}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => handleImportCsv(e.target.files?.[0])}
          />
        </Box>
      )}

      <Box sx={{ flex: 1, overflow: 'auto', px: isMercadoPago && conexion?.mercadopago?.syncParcial ? 0 : 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : transacciones.length === 0 ? (
          <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
            <AccountBalanceIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No hay transacciones en esta cuenta.
            </Typography>
            {isMercadoPago && (
              <>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, mb: 2 }}>
                  Conectá Mercado Pago para importar movimientos automáticamente.
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={syncing ? <CircularProgress size={14} color="inherit" /> : <SyncIcon />}
                    onClick={handleSync}
                    disabled={!conexion || syncing}
                  >
                    Sincronizar
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={importing ? <CircularProgress size={14} /> : <UploadIcon />}
                    onClick={() => document.getElementById(`mp-csv-input-${cuentaId}`)?.click()}
                    disabled={!conexion || importing}
                  >
                    Importar CSV histórico
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    Exportá el CSV &quot;Dinero en cuenta&quot; desde el panel de Mercado Pago.
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        ) : (
          <TransaccionTable
            transacciones={transacciones}
            onDelete={handleDelete}
            showValues={showValues}
            variant="accountDetail"
          />
        )}
      </Box>
    </Wrapper>
  );
}
