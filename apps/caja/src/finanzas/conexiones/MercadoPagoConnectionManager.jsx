import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Box,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  TextField,
  MenuItem
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useMercadoPago } from '@shared/hooks/useMercadoPago';
import MercadoPagoConnectButton from './MercadoPagoConnectButton';
import { isMercadoPagoEnabled } from '@shared/config/mercadopago';
import MercadoPagoStatusIndicator from './MercadoPagoStatusIndicator';
import MercadoPagoDataManager from './MercadoPagoDataManager';
import { MercadoPagoPartialSyncAlert } from './MercadoPagoPartialSyncBanner';

export default function MercadoPagoConnectionManager({ connectionId, onConnectionUpdate }) {
  const {
    loading,
    processing,
    connectionStatus,
    syncConnection,
    verifyConnection,
    getCompleteData,
    processData,
    getConnectionStatus
  } = useMercadoPago();

  const [showDataManager, setShowDataManager] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncOptions, setSyncOptions] = useState({
    force: false,
    since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 días atrás
  });
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [processOptions, setProcessOptions] = useState({
    procesarPagos: true,
    procesarMovimientos: true
  });
  const [lastSync, setLastSync] = useState(null);
  const [syncParcial, setSyncParcial] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Actualizar estado de conexión periódicamente
  useEffect(() => {
    const interval = setInterval(() => {
      getConnectionStatus();
    }, 30000); // Cada 30 segundos

    return () => clearInterval(interval);
  }, [getConnectionStatus]);

  const handleSync = async () => {
    if (!connectionId) {
      setError('ID de conexión requerido');
      return;
    }

    try {
      setError(null);
      const result = await syncConnection(connectionId, syncOptions);
      const parcial = result?.resultado?.syncParcial;
      setSyncParcial(Boolean(parcial));
      setSuccess(
        parcial
          ? 'Sincronización parcial: revisá movimientos o importá CSV manual'
          : 'Sincronización completada exitosamente'
      );
      setLastSync(new Date().toISOString());
      setShowSyncDialog(false);
      if (parcial) {
        setShowDataManager(true);
      }
      
      if (onConnectionUpdate) {
        onConnectionUpdate(result);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleVerify = async () => {
    if (!connectionId) {
      setError('ID de conexión requerido');
      return;
    }

    try {
      setError(null);
      const result = await verifyConnection(connectionId);
      setSuccess('Verificación completada exitosamente');
      
      if (onConnectionUpdate) {
        onConnectionUpdate(result);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleProcessData = async () => {
    if (!connectionId) {
      setError('ID de conexión requerido');
      return;
    }

    try {
      setError(null);
      const result = await processData(connectionId, processOptions);
      setSuccess('Datos procesados exitosamente');
      setShowProcessDialog(false);
      
      if (onConnectionUpdate) {
        onConnectionUpdate(result);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDataProcessed = (data) => {
    setSuccess('Datos procesados exitosamente');
    if (onConnectionUpdate) {
      onConnectionUpdate(data);
    }
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Nunca';
    return new Date(timestamp).toLocaleString('es-ES');
  };

  if (!isMercadoPagoEnabled()) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Alert severity="info">
            <Typography variant="h6">Mercado Pago está deshabilitado</Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
              <Typography variant="h6" gutterBottom>
                Gestión de Conexión MercadoPago
              </Typography>
              <MercadoPagoStatusIndicator 
                connectionId={connectionId}
                onStatusChange={(status) => {
                  // El estado se actualiza automáticamente
                }}
              />
              {lastSync && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Última sincronización: {formatLastSync(lastSync)}
                </Typography>
              )}
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {!connectionId ? (
                  <MercadoPagoConnectButton 
                    onSuccess={() => {
                      setSuccess('Conexión iniciada exitosamente');
                      if (onConnectionUpdate) {
                        onConnectionUpdate({ status: 'connecting' });
                      }
                    }}
                    onError={(error) => setError(error.message)}
                  />
                ) : (
                  <>
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={handleVerify}
                      disabled={loading}
                      size="small"
                      sx={{ borderRadius: 0 }}
                    >
                      Verificar
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<SyncIcon />}
                      onClick={() => setShowSyncDialog(true)}
                      disabled={loading}
                      size="small"
                      sx={{ borderRadius: 0 }}
                    >
                      Sincronizar
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={() => setShowDataManager(!showDataManager)}
                      disabled={loading}
                      size="small"
                      sx={{ borderRadius: 0 }}
                    >
                      Datos
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<SettingsIcon />}
                      onClick={() => setShowProcessDialog(true)}
                      disabled={processing}
                      size="small"
                      sx={{ borderRadius: 0 }}
                    >
                      Procesar
                    </Button>
                  </>
                )}
              </Box>
            </Grid>
          </Grid>

          {/* Alertas */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity={syncParcial ? 'warning' : 'success'} sx={{ mt: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {syncParcial && connectionId && (
            <MercadoPagoPartialSyncAlert
              conexion={{ syncParcial: true }}
              onImportClick={() => setShowDataManager(true)}
            />
          )}

          {/* Indicadores de estado */}
          {(loading || processing) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {loading ? 'Procesando...' : 'Procesando datos...'}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Gestor de datos */}
      {showDataManager && connectionId && (
        <MercadoPagoDataManager 
          conexionId={connectionId}
          onDataProcessed={handleDataProcessed}
        />
      )}

      {/* Diálogo de sincronización */}
      <Dialog 
        open={showSyncDialog} 
        onClose={() => setShowSyncDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderRadius: 0 }}>
          Opciones de Sincronización
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={syncOptions.force}
                    onChange={(e) => setSyncOptions(prev => ({ ...prev, force: e.target.checked }))}
                    sx={{ borderRadius: 0 }}
                  />
                }
                label="Forzar sincronización completa"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Fecha desde"
                type="date"
                value={syncOptions.since}
                onChange={(e) => setSyncOptions(prev => ({ ...prev, since: e.target.value }))}
                fullWidth
                InputProps={{ sx: { borderRadius: 0 } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setShowSyncDialog(false)}
            sx={{ borderRadius: 0 }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSync}
            variant="contained"
            disabled={loading}
            sx={{ borderRadius: 0 }}
          >
            Sincronizar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de procesamiento */}
      <Dialog 
        open={showProcessDialog} 
        onClose={() => setShowProcessDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderRadius: 0 }}>
          Opciones de Procesamiento
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={processOptions.procesarPagos}
                    onChange={(e) => setProcessOptions(prev => ({ ...prev, procesarPagos: e.target.checked }))}
                    sx={{ borderRadius: 0 }}
                  />
                }
                label="Procesar pagos"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={processOptions.procesarMovimientos}
                    onChange={(e) => setProcessOptions(prev => ({ ...prev, procesarMovimientos: e.target.checked }))}
                    sx={{ borderRadius: 0 }}
                  />
                }
                label="Procesar movimientos de cuenta"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setShowProcessDialog(false)}
            sx={{ borderRadius: 0 }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleProcessData}
            variant="contained"
            disabled={processing}
            sx={{ borderRadius: 0 }}
          >
            Procesar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
} 