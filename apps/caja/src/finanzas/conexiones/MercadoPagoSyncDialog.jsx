import React, { useCallback, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import EmergentWindow from '@shared/components/common/EmergentWindow';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';
import MercadoPagoSyncOptions, { SyncModePill } from './MercadoPagoSyncOptions';

function bankConnectionsUrl() {
  const base = String(getApiBaseUrl() || '').replace(/\/$/, '');
  return `${base}/api/bankconnections?limit=20`;
}

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    fetch(bankConnectionsUrl(), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data) => {
        if (cancel) return;
        const docs = Array.isArray(data) ? data : (data?.docs || []);
        const propias = docs.filter((item) => item?.tipo === 'MERCADOPAGO');
        setConexion(pickConexion(propias));
      })
      .catch(() => {
        if (!cancel) setConexion(null);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (!cancel) setLoaded(true);
      });
    return () => {
      cancel = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [open]);

  const connected = loaded && conexionId(conexion);

  return (
    <EmergentWindow
      open={open}
      onClose={onClose}
      title="Sincronizar"
      halfScreen
      headerActions={(
        <SyncModePill historico={historico} disabled={syncing || !connected} onChange={setHistorico} />
      )}
      bodySx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', px: 2 }}>
        <MercadoPagoSyncOptions
          connectionId={conexionId(conexion)}
          ready={loaded}
          historial={conexion?.mercadopago?.historial}
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
      </Box>
    </EmergentWindow>
  );
}
