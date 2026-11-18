import React from 'react';
import { Box, Card } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import HubSectionHeader from './HubSectionHeader';
import {
  getHubSectionCardSx,
  hubSectionBodySx,
} from '../../styles/hubSectionStyles';

/** Tarjeta hub navegable: cabecera + cuerpo preview (Finanzas, Propiedades, Inventario). */
export default function HubSectionCard({
  title,
  iconKey,
  path,
  isActive,
  children,
  cardSx,
  headerSx,
  bodySx,
}) {
  const navigate = useNavigate();

  return (
    <Card
      className="hub-section-card"
      elevation={0}
      sx={{ ...getHubSectionCardSx(isActive), ...cardSx }}
    >
      <HubSectionHeader
        title={title}
        iconKey={iconKey}
        isActive={isActive}
        onTitleClick={() => navigate(path)}
        headerSx={headerSx}
      />

      {children != null && children !== false ? (
        <Box
          className="hub-section-body"
          sx={{ ...hubSectionBodySx, ...bodySx }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
            {children}
          </Box>
        </Box>
      ) : null}
    </Card>
  );
}
