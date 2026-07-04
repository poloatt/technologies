/**
 * Persiste el toggle de un ítem de rutina con parche optimista opcional y rollback.
 */
export async function persistRutinaItemToggle({
  rutinaId,
  section,
  itemId,
  newValue,
  previousValue,
  markItemComplete,
  patchRutinaSection,
}) {
  const itemData = { [itemId]: newValue };

  patchRutinaSection?.(rutinaId, section, itemData);

  try {
    return await markItemComplete(rutinaId, section, itemData);
  } catch (error) {
    if (patchRutinaSection) {
      const rollbackData = previousValue === undefined
        ? { [itemId]: undefined }
        : { [itemId]: previousValue };
      patchRutinaSection(rutinaId, section, rollbackData);
    }
    throw error;
  }
}
