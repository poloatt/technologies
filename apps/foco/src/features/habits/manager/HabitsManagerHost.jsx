import React, { useEffect, useState } from 'react';
import { HabitsManager } from './HabitsManager';
import { listenOpenHabitsManager } from './openHabitsManager';

/** Escucha `openHabitsManager` (y legacy `openHabitTemplates`) y monta el diálogo de gestión. */
export default function HabitsManagerHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => listenOpenHabitsManager(() => setOpen(true)), []);

  return (
    <HabitsManager
      open={open}
      onClose={() => setOpen(false)}
    />
  );
}
