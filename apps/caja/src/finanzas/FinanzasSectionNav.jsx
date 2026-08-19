import React from 'react';
import CajaBranchSectionNav from '../navigation/CajaBranchSectionNav';
import { getCajaHubBranchConfig } from '../hub/config/attaHubBranchConfig';

const BRANCH_ID = 'finanzas';

/** Navegación contextual Finanzas. */
export default function FinanzasSectionNav({ variant = 'hub' }) {
  const config = getCajaHubBranchConfig(BRANCH_ID);
  return (
    <CajaBranchSectionNav
      branchId={config.branchId}
      sectionMeta={config.sectionMeta}
      statsEndpoints={config.statsEndpoints}
      hubSectionCards={variant === 'hub' ? config.hubSectionCards : undefined}
      hubExcludePageIds={variant === 'hub' ? config.hubExcludePageIds : undefined}
      stripPages={variant === 'strip' ? config.getStripPages : undefined}
      ariaLabel={config.ariaLabel}
      variant={variant}
    />
  );
}
