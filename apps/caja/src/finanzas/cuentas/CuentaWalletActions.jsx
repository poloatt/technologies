import React, { useRef, useState } from 'react';
import {
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Sync as SyncIcon,
  Upload as UploadIcon,
  ReceiptLong as ReceiptIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { transaccionesCuentaFilterPath } from '../finanzasDeepLink';

export default function CuentaWalletActions({
  cuentaId,
  conexion,
  branchId = 'finanzas',
  syncing = false,
  importing = false,
  onSync,
  onImportCsv,
  disabled = false,
}) {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const fileInputRef = useRef(null);
  const open = Boolean(anchorEl);

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleSync = () => {
    handleClose();
    onSync?.();
  };

  const handleImport = () => {
    handleClose();
    fileInputRef.current?.click();
  };

  const handleVerTransacciones = () => {
    handleClose();
    navigate(transaccionesCuentaFilterPath(cuentaId, branchId));
  };

  const sinConexion = !conexion?._id;

  return (
    <>
      <Tooltip title="Acciones de cuenta">
        <span>
          <IconButton
            size="small"
            onClick={handleOpen}
            disabled={disabled}
            aria-label="Acciones de cuenta"
            aria-controls={open ? 'cuenta-wallet-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
          >
            {syncing || importing ? (
              <CircularProgress size={18} />
            ) : (
              <MoreVertIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>

      <Menu
        id="cuenta-wallet-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleSync} disabled={sinConexion || syncing}>
          <ListItemIcon>
            <SyncIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Sincronizar ahora"
            secondary={sinConexion ? 'Sin conexión activa' : undefined}
          />
        </MenuItem>
        <MenuItem onClick={handleImport} disabled={sinConexion || importing}>
          <ListItemIcon>
            <UploadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Importar CSV de Mercado Pago" />
        </MenuItem>
        <MenuItem onClick={handleVerTransacciones}>
          <ListItemIcon>
            <ReceiptIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Ver todas en Transacciones" />
        </MenuItem>
      </Menu>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportCsv?.(file);
          e.target.value = '';
        }}
      />
    </>
  );
}
