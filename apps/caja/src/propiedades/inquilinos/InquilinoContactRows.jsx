import React from 'react';
import { Typography } from '@mui/material';
import {
  BadgeOutlined as BadgeIcon,
  EmailOutlined as EmailIcon,
  PhoneOutlined as PhoneIcon,
} from '@mui/icons-material';
import { TareaFormRow } from '@shared/components/forms/tareaFormUi';
import { propiedadDetailEmptyTextSx } from '../propiedadDetailStyles';

export default function InquilinoContactRows({ inquilino }) {
  const { email, telefono, dni, nacionalidad, ocupacion } = inquilino || {};
  const hasContact = email || telefono || dni || nacionalidad || ocupacion;

  if (!hasContact) {
    return (
      <TareaFormRow icon={BadgeIcon} showDivider>
        <Typography sx={propiedadDetailEmptyTextSx}>Sin datos de contacto</Typography>
      </TareaFormRow>
    );
  }

  return (
    <>
      {email ? (
        <TareaFormRow icon={EmailIcon} showDivider>
          <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.45, color: 'text.primary' }}>
            {email}
          </Typography>
        </TareaFormRow>
      ) : null}

      {telefono ? (
        <TareaFormRow icon={PhoneIcon} showDivider>
          <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.45, color: 'text.primary' }}>
            {telefono}
          </Typography>
        </TareaFormRow>
      ) : null}

      {dni ? (
        <TareaFormRow icon={BadgeIcon} showDivider>
          <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.45, color: 'text.primary' }}>
            DNI {dni}
          </Typography>
        </TareaFormRow>
      ) : null}

      {nacionalidad || ocupacion ? (
        <TareaFormRow icon={BadgeIcon} showDivider>
          <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.45, color: 'text.primary' }}>
            {[nacionalidad, ocupacion].filter(Boolean).join(' · ')}
          </Typography>
        </TareaFormRow>
      ) : null}
    </>
  );
}
