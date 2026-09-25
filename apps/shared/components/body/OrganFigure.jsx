import React from 'react';
import { useTheme } from '@mui/material';
import { ORGAN_PATHS, ORGAN_VIEWBOX } from './organPaths';

const [, , viewWidth, viewHeight] = ORGAN_VIEWBOX.split(' ').map(Number);

const BONE = {
  id: 'bone',
  zone: 'piernas',
  d: ['M 304.96,615.24 C 312.20,616.29 316.20,624.28 315.86,631.00 315.50,638.15 310.59,641.48 309.94,646.17 309.26,651.12 310.55,656.10 310.91,661.00 310.91,661.00 314.03,693.00 314.03,693.00 314.68,698.66 317.24,698.08 320.37,702.10 323.28,705.86 324.43,710.32 323.68,715.00 322.61,721.58 319.00,728.10 312.00,729.66 308.65,730.32 306.23,729.23 304.00,729.66 300.54,730.47 298.27,733.93 293.00,734.43 283.96,735.28 279.47,724.57 280.46,717.00 281.26,710.96 285.85,707.54 286.31,702.28 286.66,698.19 285.57,694.21 285.27,690.17 285.27,690.17 282.00,651.00 282.00,651.00 263.63,647.00 273.59,610.93 293.00,622.00 296.06,617.84 299.29,614.41 304.96,615.24 Z'],
};

/** Tejidos que también representan otra zona de Lab. */
const EXTRA_ZONES = {
  lungs: ['sangre'],
};

function zonesOf(part) {
  return [part.zone, ...(EXTRA_ZONES[part.id] || [])];
}

function stateOf(part, highlights) {
  let attention = false;
  let selected = false;
  zonesOf(part).forEach((zone) => {
    const next = highlights[zone];
    if (next === 'attention' || next === 'both') attention = true;
    if (next === 'selected' || next === 'both') selected = true;
  });
  if (attention && selected) return 'both';
  if (selected) return 'selected';
  if (attention) return 'attention';
  return undefined;
}

/**
 * Silueta con órganos (trazos MIT de biojs-human-tissues).
 * highlights: { [zoneId]: 'attention' | 'selected' | 'both' }.
 */
export default function OrganFigure({
  highlights = {},
  onZoneClick,
  width = 168,
  showBones = false,
  showOrgans = true,
}) {
  const theme = useTheme();
  const attention = theme.palette.warning.main;
  const height = Math.round(width * (viewHeight / viewWidth));

  return (
    <svg
      viewBox={ORGAN_VIEWBOX}
      width={width}
      height={height}
      role="img"
      aria-label="cuerpo con órganos"
      style={{ display: 'block' }}
    >
      {[
        ...ORGAN_PATHS.filter((part) => part.id === 'skin'),
        ...(showBones ? [BONE] : []),
        ...(showOrgans ? ORGAN_PATHS.filter((part) => part.id !== 'skin') : []),
      ].map((part) => {
        const state = stateOf(part, highlights);
        const skin = part.id === 'skin';
        const bone = part.id === 'bone';
        const isAttention = state === 'attention' || state === 'both';
        const isSelected = state === 'selected' || state === 'both';
        const fill = bone
          ? '#d5d5d5'
          : (isSelected && !isAttention
            ? theme.palette.primary.main
            : (!skin && isAttention ? attention : (skin ? '#2a2a2a' : '#3a3a3a')));
        const stroke = isSelected
          ? theme.palette.primary.main
          : (skin && isAttention ? attention : 'none');
        const strokeWidth = isSelected ? 4 : (skin && isAttention ? 3 : 0);
        const zones = zonesOf(part);
        return part.d.map((d, index) => (
          <path
            key={`${part.id}-${index}`}
            d={d}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            style={{ cursor: onZoneClick ? 'pointer' : 'default' }}
            onClick={() => {
              if (!onZoneClick) return;
              const hot = zones.find((zone) => highlights[zone]);
              onZoneClick(hot || zones[0]);
            }}
          />
        ));
      })}
    </svg>
  );
}
