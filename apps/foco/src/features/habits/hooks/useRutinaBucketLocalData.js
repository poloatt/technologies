import { useCallback, useEffect, useRef, useState } from 'react';
import { rutinaItemValuesDiffer } from '@shared/habits';

/**
 * Estado local optimista por sección para un bucket de cadencia (varias secciones).
 */
export default function useRutinaBucketLocalData(sections = [], rutina) {
  const sectionsKey = sections.join('|');

  const buildInitial = useCallback(() => {
    const out = {};
    sections.forEach((section) => {
      out[section] = rutina?.[section] ? { ...rutina[section] } : {};
    });
    return out;
  }, [sectionsKey, rutina?._id]);

  const [localDataBySection, setLocalDataBySection] = useState(buildInitial);
  const localDataRef = useRef(localDataBySection);

  useEffect(() => {
    localDataRef.current = localDataBySection;
  }, [localDataBySection]);

  useEffect(() => {
    setLocalDataBySection(buildInitial());
  }, [buildInitial]);

  useEffect(() => {
    if (!rutina) return;

    sections.forEach((section) => {
      const sectionData = rutina[section];
      if (!sectionData) return;

      const currentLocal = localDataRef.current[section] || {};
      const hasChanges = Object.keys(sectionData).some((itemId) => (
        rutinaItemValuesDiffer(sectionData[itemId], currentLocal[itemId])
      ));

      if (!hasChanges) return;

      setLocalDataBySection((prev) => {
        const sectionPrev = prev[section] || {};
        const updated = { ...sectionPrev };
        let changed = false;

        Object.keys(sectionData).forEach((itemId) => {
          const serverValue = sectionData[itemId];
          const localValue = sectionPrev[itemId];

          if (localValue === undefined || localValue === null) {
            updated[itemId] = serverValue;
            changed = true;
            return;
          }

          if (rutinaItemValuesDiffer(serverValue, localValue)) {
            updated[itemId] = serverValue;
            changed = true;
          }
        });

        if (!changed) return prev;
        return { ...prev, [section]: updated };
      });
    });
  }, [rutina, sectionsKey]);

  return [localDataBySection, setLocalDataBySection];
}
