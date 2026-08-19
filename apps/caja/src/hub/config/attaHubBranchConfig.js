import {
  getFinanzasBranchPages,
  getInventarioBranchPages,
  getPropiedadesBranchPages,
} from '@shared/navigation/appNavResolver';
import {
  CuentasHubSection,
  DeudoresHubSection,
  FinanzasPropiedadesHubSection,
  InversionesHubSection,
  MonedasHubSection,
  TransaccionesHubSection,
} from '../../finanzas/hub';
import { FINANZAS_SECTION_META, FINANZAS_STATS_ENDPOINTS } from '../../finanzas/finanzasSectionMeta';
import {
  ContratosHubSection,
  InquilinosHubSection,
  PropiedadesHubSection,
} from '../../propiedades/hub';
import { INVENTARIO_SECTION_META } from '../../inventario/inventarioSectionMeta';
import { INVENTARIO_STATS_ENDPOINTS } from '../../inventario/inventarioStatsEndpoints';
import { PROPIEDADES_SECTION_META } from '../../propiedades/propiedadesSectionMeta';
import { PROPIEDADES_STATS_ENDPOINTS } from '../../propiedades/propiedadesStatsEndpoints';
import { InventarioHubSection } from '../../inventario/hub';

/** Registro unificado de hubs Caja por rama. */
export const CAJA_HUB_BRANCHES = {
  finanzas: {
    branchId: 'finanzas',
    ariaLabel: 'Secciones de Finanzas',
    sectionMeta: FINANZAS_SECTION_META,
    statsEndpoints: FINANZAS_STATS_ENDPOINTS,
    hubSectionCards: {
      transacciones: TransaccionesHubSection,
      cuentas: CuentasHubSection,
      monedas: MonedasHubSection,
      inversiones: InversionesHubSection,
      deudores: DeudoresHubSection,
      propiedades: FinanzasPropiedadesHubSection,
      inventario: InventarioHubSection,
    },
    hubExcludePageIds: [],
    getStripPages: getFinanzasBranchPages,
  },
  propiedades: {
    branchId: 'propiedades',
    ariaLabel: 'Secciones de Propiedades',
    sectionMeta: PROPIEDADES_SECTION_META,
    statsEndpoints: PROPIEDADES_STATS_ENDPOINTS,
    hubSectionCards: {
      propiedades: PropiedadesHubSection,
      inquilinos: InquilinosHubSection,
      contratos: ContratosHubSection,
    },
    hubExcludePageIds: ['cuentas', 'transacciones'],
    getStripPages: getPropiedadesBranchPages,
  },
  inventario: {
    branchId: 'inventario',
    ariaLabel: 'Secciones de Inventario',
    sectionMeta: INVENTARIO_SECTION_META,
    statsEndpoints: INVENTARIO_STATS_ENDPOINTS,
    hubSectionCards: {
      inventario: InventarioHubSection,
    },
    hubExcludePageIds: [
      'inventario-en-propiedades',
      'vehiculos',
      'inventario-sin-ubicacion',
      'cuentas',
      'transacciones',
    ],
    getStripPages: getInventarioBranchPages,
  },
};

export function getCajaHubBranchConfig(branchId) {
  return CAJA_HUB_BRANCHES[branchId] ?? null;
}
