import React from 'react';
import Cuentas from '../../pages/Cuentas';
import { CUENTAS_PATH } from '../finanzasDeepLink';
import SetupPageDialog from '../SetupPageDialog';

/** Setup de Cuentas como popup contextual (desde Transacciones). */
export default function CuentasSetupDialog({ open, onClose }) {
  return (
    <SetupPageDialog
      open={open}
      onClose={onClose}
      title="Cuentas"
      fullPagePath={CUENTAS_PATH}
    >
      <Cuentas embedded />
    </SetupPageDialog>
  );
}
