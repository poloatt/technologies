import React, { useMemo } from 'react';
import { Link } from '@mui/material';
import { OpenInNewOutlined, PersonOutline } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAPI } from '@shared/hooks/useAPI';
import { isPathActive } from '@shared/navigation/appNavResolver';
import { CajaHubSectionCard, HubItemsPreview, HubRow } from '../../hub';
import ContratoForm from '../contratos/ContratoForm';
import AgregarContratoButton from '../contratos/AgregarContratoButton';
import { useContratoFormLauncher } from '../contratos/useContratoFormLauncher';
import { PROPIEDADES_HUB_PREVIEW_COUNT } from './propiedadesHubConstants';
import {
  countContratosForInquilino,
  getInquilinoNombre,
  normalizeDocId,
} from './propiedadesHubUtils';

const INQUILINOS_PATH = '/propiedades/inquilinos';
const CONTRATOS_PATH = '/propiedades/contratos';

function formatContratosLabel(count) {
  if (count === 1) return '1 contrato';
  return `${count} contratos`;
}

export default function InquilinosHubSection() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isActive = isPathActive(pathname, INQUILINOS_PATH);

  const contratoLauncher = useContratoFormLauncher({
    onSubmitted: () => {
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { type: 'contrato' } }));
    },
  });

  const { data: inquilinosData, loading: loadingInquilinos } = useAPI('/api/inquilinos', {
    enableCache: true,
    cacheDuration: 60000,
    params: { limit: 100 },
  });

  const { data: contratosData, loading: loadingContratos } = useAPI('/api/contratos', {
    enableCache: true,
    cacheDuration: 60000,
    params: { limit: 300 },
  });

  const loading = loadingInquilinos || loadingContratos;

  const inquilinos = useMemo(() => {
    const docs = inquilinosData?.docs ?? (Array.isArray(inquilinosData) ? inquilinosData : []);
    const contratos = contratosData?.docs ?? (Array.isArray(contratosData) ? contratosData : []);
    return docs.map((i) => {
      const id = normalizeDocId(i);
      const contratosCount = countContratosForInquilino(id, contratos);
      return { ...i, id, contratosCount };
    });
  }, [inquilinosData, contratosData]);

  const handleAddContrato = (e, inquilino) => {
    e.stopPropagation();
    contratoLauncher.openForInquilino(inquilino);
  };

  return (
    <>
      <CajaHubSectionCard title="Inquilinos" iconKey="person" path={INQUILINOS_PATH} isActive={isActive}>
        <HubItemsPreview
          loading={loading}
          items={inquilinos}
          previewCount={PROPIEDADES_HUB_PREVIEW_COUNT}
          emptyLabel="Sin inquilinos"
          renderRow={(inquilino) => {
            const { contratosCount } = inquilino;
            return (
              <HubRow
                key={inquilino.id}
                icon={<PersonOutline sx={{ fontSize: 16, color: 'text.secondary' }} />}
                primary={getInquilinoNombre(inquilino)}
                secondary={
                  contratosCount > 0 ? (
                    <Link
                      component="button"
                      variant="caption"
                      underline="hover"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(CONTRATOS_PATH);
                      }}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.25,
                        color: 'primary.main',
                        fontWeight: 600,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        p: 0,
                        fontSize: 'inherit',
                        fontFamily: 'inherit',
                      }}
                    >
                      Ver contratos
                      <OpenInNewOutlined sx={{ fontSize: 12 }} />
                    </Link>
                  ) : (
                    inquilino.email
                  )
                }
                trailing={
                  contratosCount > 0 ? (
                    formatContratosLabel(contratosCount)
                  ) : (
                    <AgregarContratoButton onClick={(e) => handleAddContrato(e, inquilino)} />
                  )
                }
                trailingColor={contratosCount > 0 ? 'primary.main' : 'text.secondary'}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(INQUILINOS_PATH);
                }}
              />
            );
          }}
        />
      </CajaHubSectionCard>

      {contratoLauncher.open && (
        <ContratoForm
          open={contratoLauncher.open}
          initialData={contratoLauncher.initialData}
          relatedData={contratoLauncher.relatedData}
          onClose={contratoLauncher.close}
          onSubmit={contratoLauncher.handleSubmitted}
        />
      )}
    </>
  );
}
