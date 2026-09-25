const RULES = {
  cabeza: [
    { id: 'craneo', label: 'Cráneo', hint: 'Huesos del cráneo', test: /cráneo|esfenoides|etmoides|frontal|occipital|parietal|temporal|vómer/ },
    { id: 'cara', label: 'Cara', hint: 'Huesos de la cara', test: /cigomático|cornete|lacrimal|nasal|palatino/ },
    { id: 'dientes', label: 'Dientes', hint: 'Maxilar y mandíbula', test: /maxilar|mandíbula/ },
    { id: 'cuello', label: 'Cuello', hint: 'Vértebras cervicales', test: /atlas|axis|cervical|hioides/ },
  ],
  pecho: [
    { id: 'costillas', label: 'Costillas', hint: 'Costillas individuales', test: /costilla/ },
    { id: 'columna', label: 'Columna torácica', hint: 'Vértebras y discos', test: /torácica/ },
    { id: 'esternon', label: 'Esternón', hint: 'Manubrio, cuerpo y xifoides', test: /esternón|xifoides|manubrio/ },
    { id: 'clavicula', label: 'Clavícula', hint: 'Derecha e izquierda', test: /clavícula/ },
    { id: 'escapula', label: 'Escápula', hint: 'Derecha e izquierda', test: /escápula/ },
    { id: 'abdomen', label: 'Abdomen', hint: 'Columna lumbar y sacro', test: /lumbar|sacro/ },
  ],
  brazos: [
    { id: 'brazo', label: 'Brazo', hint: 'Húmero, radio y cúbito', test: /húmero|radio |cúbito/ },
    { id: 'mano', label: 'Mano', hint: 'Carpo, metacarpo y falanges', test: /metacarpiano|falange|escafoides|semilunar|ganchoso|pisiforme|trapecio|trapezoide|hueso grande/ },
  ],
  piernas: [
    { id: 'cadera', label: 'Cadera', hint: 'Hueso ilíaco', test: /ilíaco/ },
    { id: 'pierna', label: 'Pierna', hint: 'Fémur, tibia, fíbula y rótula', test: /fémur|tibia|fíbula|rótula/ },
    { id: 'pie', label: 'Pie', hint: 'Tarso, metatarso y falanges', test: /astrágalo|calcáneo|metatarsiano|falange|cuboides|cuneiforme|navicular/ },
  ],
};

export function boneMatchesGroup(zone, groupId, name) {
  const rule = (RULES[zone] || []).find((item) => item.id === groupId)
    || Object.values(RULES).flat().find((item) => item.id === groupId);
  if (!rule) return true;
  return rule.test.test(name);
}

export function groupBones(zone, names) {
  const rules = RULES[zone] || [];
  const used = new Set();
  const groups = [];
  rules.forEach((rule) => {
    const bones = names.filter((name) => rule.test.test(name) && !used.has(name));
    bones.forEach((name) => used.add(name));
    if (bones.length) groups.push({ id: rule.id, label: rule.label, hint: rule.hint, bones });
  });
  const rest = names.filter((name) => !used.has(name));
  if (rest.length) groups.push({ id: 'otros', label: 'Otros', hint: '', bones: rest });
  return groups;
}
