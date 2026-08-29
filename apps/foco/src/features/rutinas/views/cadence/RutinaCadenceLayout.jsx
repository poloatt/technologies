import React from 'react';
import RutinaCadenceFlatLayout from './RutinaCadenceFlatLayout';

/** Vista de rutinas por cadencia (Mañana → Tarde → Noche → Hecho → Lunes → …). */
export default function RutinaCadenceLayout({
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
