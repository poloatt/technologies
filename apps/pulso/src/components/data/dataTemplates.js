/**
 * Músculos agrupados por región clínica, en el orden en que se reconocen.
 * El detalle fino queda dentro de cada grupo.
 */
export const MUSCLE_SECTIONS = [
  {
    zone: 'cabeza',
    label: 'Cabeza',
    groups: [
      { id: 'cara', label: 'Cara', bones: ['Masetero', 'Temporal', 'Expresión'] },
      { id: 'cuello', label: 'Cuello', bones: ['Esternocleidomastoideo', 'Escalenos'] },
    ],
  },
  {
    zone: 'pecho',
    label: 'Pecho',
    groups: [
      { id: 'pectoral', label: 'Pectoral', bones: ['Pectoral mayor', 'Pectoral menor'] },
      { id: 'espalda', label: 'Espalda', bones: ['Trapecio', 'Dorsal ancho', 'Romboides', 'Lumbares'] },
      { id: 'torax', label: 'Caja torácica', bones: ['Serrato', 'Intercostales'] },
    ],
  },
  {
    zone: 'abdomen',
    label: 'Abdomen',
    groups: [
      { id: 'abdominales', label: 'Abdominales', bones: ['Recto abdominal', 'Transverso'] },
      { id: 'oblicuos', label: 'Oblicuos', bones: ['Oblicuo externo', 'Oblicuo interno'] },
      { id: 'pelvis', label: 'Suelo pélvico', bones: ['Suelo pélvico'] },
    ],
  },
  {
    zone: 'brazos',
    label: 'Brazos',
    groups: [
      { id: 'hombro', label: 'Hombro', bones: ['Deltoides', 'Manguito rotador'] },
      { id: 'biceps', label: 'Bíceps', bones: ['Bíceps', 'Braquial'] },
      { id: 'triceps', label: 'Tríceps', bones: ['Tríceps'] },
      { id: 'antebrazo', label: 'Antebrazo', bones: ['Flexores', 'Extensores'] },
    ],
  },
  {
    zone: 'piernas',
    label: 'Piernas',
    groups: [
      { id: 'gluteos', label: 'Glúteos', bones: ['Glúteo mayor', 'Glúteo medio'] },
      { id: 'cuadriceps', label: 'Cuádriceps', bones: ['Recto femoral', 'Vastos'] },
      { id: 'isquios', label: 'Isquiotibiales', bones: ['Bíceps femoral', 'Semitendinoso', 'Semimembranoso'] },
      { id: 'aductores', label: 'Aductores', bones: ['Aductores'] },
      { id: 'gemelos', label: 'Gemelos', bones: ['Gemelos', 'Sóleo'] },
    ],
  },
];

/**
 * Aparatos y sistemas. Cada uno se divide en órganos, sin un nivel de subgrupos.
 */
export const ORGAN_SECTIONS = [
  {
    id: 'circulatorio',
    zone: 'pecho',
    label: 'Circulatorio',
    organs: [
      { id: 'corazon', label: 'Corazón' },
      { id: 'arterias', label: 'Arterias' },
      { id: 'venas', label: 'Venas' },
      { id: 'sangre', label: 'Sangre' },
      { id: 'ganglios', label: 'Ganglios' },
    ],
  },
  {
    id: 'respiratorio',
    zone: 'pecho',
    label: 'Respiratorio',
    organs: [
      { id: 'pulmones', label: 'Pulmones' },
      { id: 'traquea', label: 'Tráquea' },
      { id: 'bronquios', label: 'Bronquios' },
      { id: 'laringe', label: 'Laringe' },
      { id: 'faringe', label: 'Faringe' },
      { id: 'amigdalas', label: 'Amígdalas' },
      { id: 'diafragma', label: 'Diafragma' },
    ],
  },
  {
    id: 'digestivo',
    zone: 'abdomen',
    label: 'Digestivo',
    organs: [
      { id: 'boca', label: 'Boca' },
      { id: 'esofago', label: 'Esófago' },
      { id: 'estomago', label: 'Estómago' },
      { id: 'higado', label: 'Hígado' },
      { id: 'vesicula', label: 'Vesícula' },
      { id: 'pancreas', label: 'Páncreas' },
      { id: 'intestino-delgado', label: 'Intestino delgado' },
      { id: 'intestino-grueso', label: 'Intestino grueso' },
      { id: 'apendice', label: 'Apéndice' },
      { id: 'bazo', label: 'Bazo' },
    ],
  },
  {
    id: 'nervioso',
    zone: 'cabeza',
    label: 'Nervioso',
    organs: [
      { id: 'cerebro', label: 'Cerebro' },
      { id: 'cerebelo', label: 'Cerebelo' },
      { id: 'medula', label: 'Médula espinal' },
      { id: 'nervios', label: 'Nervios' },
    ],
  },
  {
    id: 'urinario',
    zone: 'abdomen',
    label: 'Urinario',
    organs: [
      { id: 'rinones', label: 'Riñones' },
      { id: 'ureteres', label: 'Uréteres' },
      { id: 'vejiga', label: 'Vejiga' },
      { id: 'uretra', label: 'Uretra' },
    ],
  },
  {
    id: 'sentidos',
    zone: 'ojos',
    label: 'Sentidos',
    organs: [
      { id: 'ojos', label: 'Ojos' },
      { id: 'oidos', label: 'Oídos' },
      { id: 'nariz', label: 'Nariz' },
      { id: 'lengua', label: 'Lengua' },
      { id: 'piel', label: 'Piel' },
    ],
  },
  {
    id: 'endocrino',
    zone: 'cabeza',
    label: 'Endocrino',
    organs: [
      { id: 'tiroides', label: 'Tiroides' },
      { id: 'hipofisis', label: 'Hipófisis' },
      { id: 'paratiroides', label: 'Paratiroides' },
      { id: 'suprarrenales', label: 'Suprarrenales' },
    ],
  },
  {
    id: 'reproductor',
    zone: 'abdomen',
    label: 'Reproductor',
    organs: [
      { id: 'utero', label: 'Útero' },
      { id: 'ovarios', label: 'Ovarios' },
      { id: 'trompas', label: 'Trompas' },
      { id: 'vagina', label: 'Vagina' },
      { id: 'mamas', label: 'Mamas' },
      { id: 'testiculos', label: 'Testículos' },
      { id: 'prostata', label: 'Próstata' },
      { id: 'pene', label: 'Pene' },
    ],
  },
];
