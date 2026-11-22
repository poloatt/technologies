import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AlertTitle, Button, Box } from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';
import clienteAxios from '@shared/config/axios';

/**
 * Banner global cuando alguna conexión MP tiene sync parcial (settlement falló o pendiente).
 */
export default function MercadoPagoPartialSyncBanner({ onImportCsv, conexionId: conexionIdProp }) {
  const [conexionesParciales, setConexionesParciales] = useState([]);
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  const cargarEstado = useCallback(async () => {
    try {
      const { data } = await clienteAxios.get('/api/bankconnections', {
        params: {
          limit: 50,
          filter: JSON.stringify({ tipo: 'MERCADOPAGO', estado: 'ACTIVA' })
        }
      });
      const docs = data?.docs || [];
      const parciales = docs.filter(
        (c) =>
          c.mercadopago?.syncParcial ||
          c.mercadopago?.diagnostico?.coberturaP2P === 'VACIA'
      );
      setConexionesParciales(parciales);
    } catch (err) {
      console.warn('No se pudo cargar estado sync MP:', err.message);
    }
  }, []);

  useEffect(() => {
    cargarEstado();
  }, [cargarEstado]);

  const conexionId = conexionIdProp || conexionesParciales[0]?._id;

  const handleImport = async (file) => {
    if (!file || !conexionId) return;
    try {
      setImporting(true);
      setImportError(null);
      const csvContent = await file.text();
      await clienteAxios.post(`/api/bankconnections/mercadopago/importar-csv/${conexionId}`, {
        csvContent
      });
      await cargarEstado();
      if (onImportCsv) onImportCsv();
    } catch (err) {
      setImportError(err.response?.data?.message || 'Error importando CSV');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (conexionesParciales.length === 0 && !conexionIdProp) {
    return null;
  }

  const conexion = conexionesParciales.find((c) => c._id === conexionId) || conexionesParciales[0];
  const diag = conexion?.mercadopago?.diagnostico;
  const errorMsg =
    conexion?.mercadopago?.ultimoErrorSettlement ||
    diag?.nota ||
    'Los movimientos de wallet no se sincronizaron por completo.';
  const p2pVacia = diag?.coberturaP2P === 'VACIA';
  const gap = Number(diag?.gapSaldo);
  const showGap = Number.isFinite(gap) && Math.abs(gap) >= 1;

  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            color="inherit"
            size="small"
            component="label"
            startIcon={<UploadIcon />}
            disabled={importing || !conexionId}
          >
            Importar CSV
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => handleImport(e.target.files?.[0])}
            />
          </Button>
        </Box>
      }
    >
      <AlertTitle>
        {p2pVacia
          ? 'Transferencias entre usuarios MP no detectadas'
          : 'Sincronización Mercado Pago parcial'}
      </AlertTitle>
      {errorMsg}
      {p2pVacia && (
        <Box component="span" display="block" sx={{ mt: 0.5, fontSize: '0.85rem' }}>
          Los envíos a amigos o locales por transferencia pueden no aparecer en Transacciones ni en
          ingresos/gastos. El saldo de la cuenta puede verse correcto igual.
        </Box>
      )}
      {showGap && (
        <Box component="span" display="block" sx={{ mt: 0.5, fontSize: '0.85rem' }}>
          Diferencia saldo MP vs flujo registrado: {gap > 0 ? '+' : ''}
          {gap.toLocaleString('es-AR')}.
        </Box>
      )}
      {conexion?.mercadopago?.reportePendiente && (
        <Box component="span" display="block" sx={{ mt: 0.5, fontSize: '0.85rem' }}>
          Hay un reporte en generación; la próxima sync puede completarlo automáticamente.
        </Box>
      )}
      {importError && (
        <Box component="span" display="block" sx={{ mt: 0.5, color: 'error.main' }}>
          {importError}
        </Box>
      )}
    </Alert>
  );
}

/**
 * Banner inline para MercadoPagoDataManager (sync parcial de una conexión).
 */
export function MercadoPagoPartialSyncAlert({ conexion, onImportClick }) {
  if (!conexion?.syncParcial && !conexion?.reportePendiente) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={
        onImportClick ? (
          <Button color="inherit" size="small" startIcon={<UploadIcon />} onClick={onImportClick}>
            Importar CSV
          </Button>
        ) : null
      }
    >
      <AlertTitle>Movimientos incompletos</AlertTitle>
      {conexion.ultimoErrorSettlement ||
        'El reporte Account Money no está disponible. Importá el CSV desde el panel de Mercado Pago.'}
    </Alert>
  );
}
