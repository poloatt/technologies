import React from 'react';
import FinanzasSectionNav from './FinanzasSectionNav';
import { PropiedadesSectionNav } from '../propiedades';
import { InventarioSectionNav } from '../inventario';

/** Nav strip/hub según rama Caja activa. */
export default function BranchFinanzasSectionNav({ branchId, variant = 'strip' }) {
  if (branchId === 'propiedades') {
    return <PropiedadesSectionNav variant={variant} />;
  }
  if (branchId === 'inventario') {
    return <InventarioSectionNav variant={variant} />;
  }
  return <FinanzasSectionNav variant={variant} />;
}
