import React from 'react';
import CollapsibleSection from '../collapse/CollapsibleSection';

/**
 * Sección agrupada de tareas (HOY, MAÑANA, RETRASADAS, etc.).
 * Wrapper sobre CollapsibleSection compartido.
 */
export default function TaskGroupSection(props) {
  return (
    <CollapsibleSection
      chevronPosition="start"
      animated={false}
      withShadow
      {...props}
    />
  );
}
