import { useEffect, useRef, useState } from 'react';
import { rutinaItemValuesDiffer } from '@shared/habits';

/**
 * Estado local de una sección de rutina con sincronización desde props y contexto.
 */
export default function useRutinaSectionLocalData(section, data, rutina) {
  const dataRef = useRef(data);
  const [localData, setLocalData] = useState(data);
  const localDataRef = useRef(localData);

  useEffect(() => {
    localDataRef.current = localData;
  }, [localData]);

  useEffect(() => {
    if (JSON.stringify(dataRef.current) !== JSON.stringify(data)) {
      dataRef.current = data;
      setLocalData(data);
    }
  }, [data, section]);

  useEffect(() => {
    const sectionData = rutina?.[section];
    if (!sectionData) return;

    const currentLocalData = localDataRef.current;
    const hasChanges = Object.keys(sectionData).some((itemId) => {
      const serverValue = sectionData[itemId];
      const localValue = currentLocalData[itemId];
      return rutinaItemValuesDiffer(serverValue, localValue);
    });

    if (!hasChanges) return;

    setLocalData((prevData) => {
      const updated = { ...prevData };
      Object.keys(sectionData).forEach((itemId) => {
        const serverValue = sectionData[itemId];
        const localValue = prevData[itemId];

        if (localValue === undefined || localValue === null) {
          updated[itemId] = serverValue;
          return;
        }

        if (rutinaItemValuesDiffer(serverValue, localValue)) {
          updated[itemId] = serverValue;
        }
      });
      return updated;
    });
  }, [rutina, section]);

  return [localData, setLocalData];
}
