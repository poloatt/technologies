/** Resuelve localData de un entry (sección propia o fallback de la lista). */
export function resolveEntrySection(entry, fallbackSection) {
  return entry?.section || fallbackSection;
}

export function resolveEntryLocalData(entry, fallbackSection, localData, localDataBySection) {
  const section = resolveEntrySection(entry, fallbackSection);
  if (localDataBySection && section) {
    return localDataBySection[section] || null;
  }
  return localData;
}
