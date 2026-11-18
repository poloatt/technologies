import React from 'react';
import Monedas from '../../pages/Monedas';
import { MONEDAS_PATH } from '../finanzasDeepLink';
import SetupPageDialog from '../SetupPageDialog';

/** Setup de Monedas como popup contextual (desde Transacciones). */
export default function MonedasSetupDialog({ open, onClose }) {
  return (
    <SetupPageDialog
      open={open}
      onClose={onClose}
      title="Monedas"
      fullPagePath={MONEDAS_PATH}
    >
      <Monedas embedded />
    </SetupPageDialog>
  );
}
