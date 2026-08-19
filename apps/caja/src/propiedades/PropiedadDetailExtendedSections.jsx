import React from 'react';
import {
  PeopleOutlined as PeopleIcon,
  MeetingRoomOutlined as AmbientesIcon,
  DescriptionOutlined as ContratosIcon,
  FolderOutlined as DocumentosIcon,
} from '@mui/icons-material';
import {
  SeccionInquilinos,
  SeccionDocumentos,
  SeccionContratos,
} from './SeccionesPropiedad';
import PropiedadHabitacionesSection from './PropiedadHabitacionesSection';
import PropiedadDetailFlatSection from './PropiedadDetailFlatSection';
import { getDocumentId } from './propiedadFormUtils';

/** Secciones solo visibles en detalle (no en form de alta/edición básica). */
export default function PropiedadDetailExtendedSections({
  propiedad,
  propiedades = [],
  onChanged,
  initialHabitacionId = null,
}) {
  const habitaciones = propiedad?.habitaciones || [];
  const inquilinos = propiedad?.inquilinos || [];
  const inventarios = propiedad?.inventarios || [];
  const documentos = propiedad?.documentos || [];
  const contratos = propiedad?.contratos || [];

  return (
    <>
      <PropiedadDetailFlatSection icon={PeopleIcon} title="Inquilinos">
        <SeccionInquilinos propiedad={propiedad} inquilinos={inquilinos} variant="detail" />
      </PropiedadDetailFlatSection>

      <PropiedadDetailFlatSection icon={AmbientesIcon} title="Ambientes">
        <PropiedadHabitacionesSection
          propiedadId={getDocumentId(propiedad)}
          habitaciones={habitaciones}
          inventarios={inventarios}
          propiedades={propiedades.length ? propiedades : [propiedad]}
          onChanged={onChanged}
          initialHabitacionId={initialHabitacionId}
        />
      </PropiedadDetailFlatSection>

      <PropiedadDetailFlatSection icon={ContratosIcon} title="Contratos">
        <SeccionContratos contratos={contratos} variant="detail" />
      </PropiedadDetailFlatSection>

      <PropiedadDetailFlatSection icon={DocumentosIcon} title="Documentos" showDivider={false}>
        <SeccionDocumentos documentos={documentos} propiedad={propiedad} variant="detail" />
      </PropiedadDetailFlatSection>
    </>
  );
}
