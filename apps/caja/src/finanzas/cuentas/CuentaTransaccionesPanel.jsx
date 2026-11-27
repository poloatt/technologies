import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import {
  AccountBalanceOutlined as AccountBalanceIcon,
  Add as AddIcon,
  Sync as SyncIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useAPI } from '@shared/hooks/useAPI';
import { useValuesVisibility } from '@shared/context/ValuesVisibilityContext';
import clienteAxios from '@shared/config/axios';
import { TransaccionTable, TransaccionForm } from '../transacciones';
import { MercadoPagoPartialSyncAlert } from '../conexiones/MercadoPagoPartialSyncBanner';
import MercadoPagoSyncDialog from '../conexiones/MercadoPagoSyncDialog';
import { useCajaSetup } from '../../atta/useCajaSetup';
import { useCuentaBalance } from './useCuentaBalance';
import CuentaWalletHeader from './CuentaWalletHeader';

export default function CuentaTransaccionesPanel({
  cuenta,
  onRefresh,
  embedded = false,
  branchId = 'finanzas',
}) {
  const { closeCuenta } = useCajaSetup();
  const { enqueueSnackbar } = useSnackbar();
  const { showValues } = useValuesVisibility();
  const [importing, setImporting] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState(null);

  const cuentaId = cuenta?.id || cuenta?._id;
  const isMercadoPago = cuenta?.tipo === 'MERCADO_PAGO';
  // Mercado Pago se actualiza solo por sincronización o CSV; el resto admite altas manuales.
  const permiteAltaManual = !isMercadoPago && cuenta?.activo !== false;

  const {
    balance: saldoCalculado,
    balanceByMonedaId,
    loading: saldoCalculadoLoading,
  } = useCuentaBalance(cuentaId);

  const { data: transaccionesData, loading, refetch } = useAPI(
    cuentaId ? `/api/transacciones/by-cuenta/${cuentaId}` : null,
    {
      // Sin filtro de estado: los pendientes también se ven (no suman al saldo hasta marcarse pagados).
      params: { limit: 500, sort: '-fecha' },
      dependencies: [cuentaId],
      enableCache: false,
    }
  );

  const { data: conexionesData, refetch: refetchConexiones } = useAPI(
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
    closeCuenta();
  };

  const handleSync = () => {
    if (!conexion?._id) return;
    setSyncOpen(true);
  };

  const handleSynced = async () => {
    await Promise.all([refetch(), refetchConexiones()]);
    onRefresh?.();
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
      window.dispatchEvent(new Event('contactosRefreshed'));
      onRefresh?.();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Error importando CSV', { variant: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const selfDispatchRef = useRef(false);

  // Tras cualquier cambio: refresca la lista y avisa para recalcular saldos (header, Cuentas, hub).
  const notifyChange = useCallback(async () => {
    await refetch();
    selfDispatchRef.current = true;
    window.dispatchEvent(new Event('transaccionesRefreshed'));
  }, [refetch]);

  useEffect(() => {
    const handleExternalRefresh = () => {
      if (selfDispatchRef.current) {
        selfDispatchRef.current = false;
        return;
      }
      refetch();
    };
    window.addEventListener('transaccionesRefreshed', handleExternalRefresh);
    return () => window.removeEventListener('transaccionesRefreshed', handleExternalRefresh);
  }, [refetch]);

  const handleDelete = useCallback(async (transaccion) => {
    try {
      await clienteAxios.delete(`/api/transacciones/${transaccion._id || transaccion.id}`);
      await notifyChange();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Error al eliminar transacción', { variant: 'error' });
    }
  }, [notifyChange, enqueueSnackbar]);

  const handleChangeEstado = useCallback(async (transaccion, estado) => {
    try {
      await clienteAxios.patch(`/api/transacciones/${transaccion._id || transaccion.id}/estado`, { estado });
      await notifyChange();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Error al cambiar el estado', { variant: 'error' });
    }
  }, [notifyChange, enqueueSnackbar]);

  const handleAdd = useCallback(() => {
    setEditing(null);
    setFormKey((prev) => prev + 1);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((transaccion) => {
    setEditing({ ...transaccion, cuenta: cuentaId });
    setFormKey((prev) => prev + 1);
    setFormOpen(true);
  }, [cuentaId]);

  // Propaga los errores para que el form quede abierto; el aviso de éxito lo muestra el form.
  const handleFormSubmit = useCallback(async (formData) => {
    const body = {
      descripcion: formData.descripcion,
      monto: parseFloat(formData.monto),
      fecha: formData.fecha,
      categoria: formData.categoria,
      estado: formData.estado || 'PAGADO',
      tipo: formData.tipo,
      cuenta: cuentaId,
      ...(formData.moneda ? { moneda: formData.moneda } : {}),
      ...(formData.contacto !== undefined ? { contacto: formData.contacto || null } : {}),
    };
    if (editing) {
      await clienteAxios.put(`/api/transacciones/${editing._id || editing.id}`, body);
    } else {
      await clienteAxios.post('/api/transacciones', body);
    }
    await notifyChange();
  }, [cuentaId, editing, notifyChange]);

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
        balanceByMonedaId={balanceByMonedaId}
        saldoCalculadoLoading={saldoCalculadoLoading}
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

      {permiteAltaManual && (
        <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAdd}
            sx={{ borderRadius: 0 }}
          >
            Agregar movimiento
          </Button>
        </Box>
      )}

      <Box sx={{ flex: 1, overflow: 'auto' }}>
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
            {permiteAltaManual && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Cargá el primer movimiento con &quot;Agregar movimiento&quot;.
              </Typography>
            )}
            {isMercadoPago && (
              <>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, mb: 2 }}>
                  Conectá Mercado Pago para importar movimientos automáticamente.
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<SyncIcon />}
                    onClick={handleSync}
                    disabled={!conexion}
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
            onEdit={handleEdit}
            onDelete={handleDelete}
            onChangeEstado={handleChangeEstado}
            showValues={showValues}
            variant="accountDetail"
          />
        )}
      </Box>
      <MercadoPagoSyncDialog open={syncOpen} onClose={() => setSyncOpen(false)} onSuccess={handleSynced} />
      {formOpen && (
        <TransaccionForm
          key={formKey}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={handleFormSubmit}
          initialData={editing || { cuenta: cuentaId }}
          isEditing={!!editing}
          lockCuenta
        />
      )}
    </Wrapper>
  );
}
