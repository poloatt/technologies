import React from 'react';
import { Box, useTheme } from '@mui/material';
import { BODY_ZONES, zoneNeedsAttention } from '@shared/pulso';

const ZONE_SHAPES = {
  cabeza: 'M100 28c18 0 32 16 32 36s-14 34-32 34-32-14-32-34 14-36 32-36z',
  ojos: 'M82 58h12v8h-12zm36 0h12v8h-12z',
  pecho: 'M72 108h56v36H72z',
  sangre: 'M128 118h18v28h-18z',
  abdomen: 'M74 146h52v40H74z',
  piel: 'M48 112h22v70H48zm82 0h22v70h-22z',
  piernas: 'M78 190h18v90H78zm26 0h18v90h-18z',
};

export default function BodyMap({ controles = [], selectedZone, onSelectZone }) {
  const theme = useTheme();
  const attention = theme.palette.warning.main;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
      <svg viewBox="0 0 200 300" width="180" height="270" role="img" aria-label="Mapa corporal">
        <path d="M100 24c22 0 38 18 38 42 0 16-8 28-16 36l8 16c22 8 36 28 36 52v28c0 10-8 16-16 16h-8l6 72h-22l-8-72h-16l-8 72H70l6-72h-8c-8 0-16-6-16-16v-28c0-24 14-44 36-52l8-16c-8-8-16-20-16-36 0-24 16-42 40-42z" fill="none" stroke={theme.palette.divider} strokeWidth="2" />
        {BODY_ZONES.map((zone) => {
          const path = ZONE_SHAPES[zone.id];
          if (!path) return null;
          const hot = zoneNeedsAttention(zone.id, controles);
          const selected = selectedZone === zone.id;
          return (
            <path
              key={zone.id}
              d={path}
              role="button"
              aria-label={zone.label}
              fill={hot ? attention : 'transparent'}
              fillOpacity={hot ? 0.85 : 0}
              stroke={selected ? theme.palette.primary.main : 'transparent'}
              strokeWidth="2"
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectZone(selected ? null : zone.id)}
            />
          );
        })}
      </svg>
    </Box>
  );
}
