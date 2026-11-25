import React, { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import EmergentWindow from '@shared/components/common/EmergentWindow';
import MercadoPagoConnectButton from './MercadoPagoConnectButton';
import MercadoPagoSyncOptions, { SyncModePill } from './MercadoPagoSyncOptions';

function pickConexion(docs) {
  const list = Array.isArray(docs) ? docs : [];
  return list.find((item) => item?.estado === 'ACTIVA') || list[0] || null;
}

function conexionId(conexion) {
  return conexion?.id || conexion?._id || null;
}

/** Modal del botón Sincronizar: sync rápido o histórico, o conectar si no hay cuenta. */
export default function MercadoPagoSyncDialog({ open, onClose, onSuccess }) {
  const [conexion, setConexion] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [historico, setHistorico] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const handleBusy = useCallback((value) => setSyncing(value), []);

  useEffect(() => {
    if (!open) return undefined;
    let cancel = false;
    setHistorico(false);
    setLoaded(false);
    const token = localStorage.getItem('token');
    fetch('/api/bankconnections?limit=20', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data) => {
        if (cancel) return;
        const propias = (data?.docs || []).filter((item) => item?.tipo === 'MERCADOPAGO');
        setConexion(pickConexion(propias));
      })
      .catch(() => {
        if (!cancel) setConexion(null);
      })
      .finally(() => {
        if (!cancel) setLoaded(true);
      });
    return () => {
      cancel = true;
    };
  }, [open]);

  const connected = loaded && conexionId(conexion);

  return (
    <EmergentWindow
      open={open}
      onClose={onClose}
      title="Sincronizar"
      halfScreen
      headerActions={connected ? (
        <SyncModePill historico={historico} disabled={syncing} onChange={setHistorico} />
      ) : null}
      bodySx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', px: 2 }}>
        {!loaded ? (
          <CircularProgress size={22} />
        ) : conexionId(conexion) ? (
          <MercadoPagoSyncOptions
            connectionId={conexionId(conexion)}
            historial={conexion.mercadopago?.historial}
            historico={historico}
            onHistoricoChange={setHistorico}
            showPill={false}
            onBusyChange={handleBusy}
            onSynced={(result) => {
              const chunk = result?.resultado?.historial;
              if (chunk) {
                setConexion((current) => (current
                  ? { ...current, mercadopago: { ...current.mercadopago, historial: chunk } }
                  : current));
              }
              onSuccess?.(result);
              window.dispatchEvent(new CustomEvent('cuentasRefreshed'));
            }}
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%', maxWidth: 360 }}>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Conectá Mercado Pago para importar la cuenta.
            </Typography>
            <MercadoPagoConnectButton
              fullWidth
              onSuccess={() => {
                onSuccess?.();
                onClose?.();
                window.dispatchEvent(new CustomEvent('cuentasRefreshed'));
              }}
              onError={(error) => {
                console.error('Error en conexión MercadoPago:', error);
              }}
            />
          </Box>
        )}
      </Box>
    </EmergentWindow>
  );
}
