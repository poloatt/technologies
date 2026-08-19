import React from 'react';
import { ButtonBase } from '@mui/material';
import { ExpandMoreOutlined } from '@mui/icons-material';
import { hubExpandButtonSx } from '@shared/styles/hubSectionStyles';

export default function HubExpandFooter({ expanded, onToggle, restCount }) {
  if (!restCount) return null;

  return (
    <ButtonBase onClick={onToggle} sx={hubExpandButtonSx}>
      <ExpandMoreOutlined
        sx={{
          fontSize: 16,
          transition: 'transform 0.2s',
          transform: expanded ? 'rotate(180deg)' : 'none',
        }}
      />
      <span>{expanded ? 'Ver menos' : `Ver ${restCount} más`}</span>
    </ButtonBase>
  );
}
