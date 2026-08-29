import React from 'react';
import RutinaCadenceFlatLayout from './RutinaCadenceFlatLayout';

/** Desktop: misma lista plana que mobile (sin nav Hoy / Esta semana). */
export default function RutinaCadenceDesktopLayout({
  rutina,
  readOnly = false,
}) {
  return (
    <RutinaCadenceFlatLayout
      rutina={rutina}
      readOnly={readOnly}
    />
  );
}
