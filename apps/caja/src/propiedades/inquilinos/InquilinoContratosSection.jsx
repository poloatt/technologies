import React from 'react';
import { Typography } from '@mui/material';
import ContratoCard from '../contratos/ContratoCard';
import { CuotasProvider } from '../contratos';
import AgregarContratoButton from '../contratos/AgregarContratoButton';
import { propiedadDetailEmptyTextSx } from '../propiedadDetailStyles';
import { getDocumentId } from './inquilinoDetailUtils';

export default function InquilinoContratosSection({
  inquilino,
  onCreateContract,
}) {
  const contratos = inquilino?.contratos || [];

  if (contratos.length === 0) {
    return (
      <>
        <Typography sx={propiedadDetailEmptyTextSx}>Sin contratos</Typography>
        {onCreateContract ? (
          <AgregarContratoButton onClick={() => onCreateContract(inquilino)} sx={{ mt: 1 }} />
        ) : null}
      </>
    );
  }

  return (
    <>
      {contratos.map((contrato, index) => (
        <CuotasProvider
          key={getDocumentId(contrato) || index}
          contratoId={getDocumentId(contrato)}
          formData={contrato}
          relatedData={{ inquilino, propiedad: contrato.propiedad }}
        >
          <ContratoCard contrato={contrato} />
        </CuotasProvider>
      ))}
      {onCreateContract ? (
        <AgregarContratoButton onClick={() => onCreateContract(inquilino)} sx={{ mt: 1 }} />
      ) : null}
    </>
  );
}
