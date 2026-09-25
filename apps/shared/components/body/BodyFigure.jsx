import React, { useMemo } from 'react';
import { useTheme } from '@mui/material';
import Body from 'react-muscle-highlighter';

/** Zonas de Pulso → músculos del mapa MIT (react-muscle-highlighter). */
const ZONE_SLUGS = {
  ojos: ['head'],
  cabeza: ['head', 'neck'],
  sangre: ['chest'],
  pecho: ['chest'],
  piel: ['biceps', 'triceps', 'forearm', 'deltoids'],
  brazos: ['biceps', 'triceps', 'forearm', 'deltoids'],
  abdomen: ['abs', 'obliques'],
  piernas: ['quadriceps', 'hamstring', 'calves', 'adductors'],
};

function zonesForSlug(slug) {
  return Object.entries(ZONE_SLUGS)
    .filter(([, slugs]) => slugs.includes(slug))
    .map(([zone]) => zone);
}

/**
 * Figura anatómica de frente. highlights: { [zoneId]: 'attention' | 'selected' | 'both' }.
 */
export default function BodyFigure({
  highlights = {},
  onZoneClick,
  width = 168,
}) {
  const theme = useTheme();
  const attention = theme.palette.warning.main;

  const data = useMemo(() => {
    const bySlug = new Map();
    Object.entries(ZONE_SLUGS).forEach(([zone, slugs]) => {
      const state = highlights[zone];
      if (!state) return;
      slugs.forEach((slug) => {
        const prev = bySlug.get(slug);
        const attention = prev === 'attention' || prev === 'both' || state === 'attention' || state === 'both';
        const selected = prev === 'selected' || prev === 'both' || state === 'selected' || state === 'both';
        if (attention && selected) bySlug.set(slug, 'both');
        else if (selected) bySlug.set(slug, 'selected');
        else if (attention) bySlug.set(slug, 'attention');
      });
    });
    return [...bySlug.entries()].map(([slug, state]) => {
      const isAttention = state === 'attention' || state === 'both';
      const isSelected = state === 'selected' || state === 'both';
      return {
        slug,
        styles: {
          fill: isSelected && !isAttention ? theme.palette.primary.main : (isAttention ? attention : '#2a2a2a'),
          stroke: isSelected ? theme.palette.primary.main : 'none',
          strokeWidth: isSelected ? 1.5 : 0,
        },
      };
    });
  }, [attention, highlights, theme.palette.primary.main]);

  const scale = width / 200;

  return (
    <Body
      data={data}
      side="front"
      gender="male"
      scale={scale}
      border="none"
      defaultFill="#2a2a2a"
      defaultStroke="none"
      onBodyPartPress={(part) => {
        if (!onZoneClick || !part?.slug) return;
        const zones = zonesForSlug(part.slug);
        const hot = zones.find((zone) => highlights[zone]);
        const next = hot || zones[0];
        if (next) onZoneClick(next);
      }}
    />
  );
}
