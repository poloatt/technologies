import React, { useMemo } from 'react';
import { DescriptionOutlined } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAPI } from '@shared/hooks/useAPI';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard, HubItemsPreview, HubRow } from '../../hub';
import { PROPIEDADES_HUB_PREVIEW_COUNT } from './propiedadesHubConstants';
import {
  getContratoEstado,
  getContratoInquilinoNombre,
  normalizeDocId,
} from './propiedadesHubUtils';

const CONTRATOS_PATH = '/propiedades/contratos';

function formatEstadoLabel(estado) {
  if (estado === 'ACTIVO') return 'Activo';
  if (estado === 'FINALIZADO') return 'Finalizado';
  if (estado === 'MANTENIMIENTO') return 'Mantenimiento';
  return 'Planeado';
}

export default function ContratosHubSection() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isActive = isPathActive(pathname, CONTRATOS_PATH);

  const { data, loading } = useAPI('/api/contratos', {
    enableCache: true,
    cacheDuration: 60000,
    params: { limit: 100 },
  });

  const contratos = useMemo(() => {
    const docs = data?.docs ?? (Array.isArray(data) ? data : []);
    return docs.map((c) => ({
      ...c,
      id: normalizeDocId(c),
      estadoLabel: formatEstadoLabel(getContratoEstado(c)),
      inquilinoNombre: getContratoInquilinoNombre(c),
    }));
  }, [data]);

  return (
    <CajaHubSectionCard
      title="Contratos"
      iconKey="description"
      path={CONTRATOS_PATH}
      isActive={isActive}
    >
      <HubItemsPreview
        loading={loading}
        items={contratos}
        previewCount={PROPIEDADES_HUB_PREVIEW_COUNT}
        emptyLabel="Sin contratos"
        renderRow={(contrato) => (
          <HubRow
            key={contrato.id}
            icon={<DescriptionOutlined sx={{ fontSize: 16, color: 'text.secondary' }} />}
            primary={contrato.inquilinoNombre}
            secondary={contrato.estadoLabel}
            trailing={contrato.estadoLabel}
            trailingColor={contrato.estado === 'ACTIVO' ? 'primary.main' : 'text.secondary'}
            onClick={(e) => {
              e.stopPropagation();
              navigate(CONTRATOS_PATH);
            }}
          />
        )}
      />
    </CajaHubSectionCard>
  );
}
