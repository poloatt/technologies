/**
 * Grupos de entrenamiento. Cada uno lista los músculos que se nombran al entrenar.
 */
export const MUSCLE_SECTIONS = [
  {
    id: 'cabeza',
    zone: 'cabeza',
    label: 'Cabeza',
    muscles: [
      { id: 'masetero', label: 'Masetero' },
      { id: 'temporal', label: 'Temporal' },
      { id: 'expresion', label: 'Expresión' },
      { id: 'esternocleidomastoideo', label: 'Esternocleidomastoideo' },
      { id: 'escalenos', label: 'Escalenos' },
      { id: 'extensores-cuello', label: 'Extensores del cuello' },
    ],
  },
  {
    id: 'pecho',
    zone: 'pecho',
    label: 'Pecho',
    muscles: [
      { id: 'pectoral-mayor', label: 'Pectoral mayor' },
      { id: 'pectoral-menor', label: 'Pectoral menor' },
      { id: 'serrato', label: 'Serrato' },
    ],
  },
  {
    id: 'espalda',
    zone: 'pecho',
    label: 'Espalda',
    muscles: [
      { id: 'dorsal', label: 'Dorsal ancho' },
      { id: 'trapecio', label: 'Trapecio' },
      { id: 'romboides', label: 'Romboides' },
      { id: 'erectores', label: 'Erectores' },
      { id: 'cuadrado', label: 'Cuadrado lumbar' },
    ],
  },
  {
    id: 'abdomen',
    zone: 'abdomen',
    label: 'Abdomen',
    muscles: [
      { id: 'recto', label: 'Recto abdominal' },
      { id: 'transverso', label: 'Transverso' },
      { id: 'oblicuo-externo', label: 'Oblicuo externo' },
      { id: 'oblicuo-interno', label: 'Oblicuo interno' },
      { id: 'psoas', label: 'Psoas' },
      { id: 'iliaco', label: 'Ilíaco' },
    ],
  },
  {
    id: 'brazos',
    zone: 'brazos',
    label: 'Brazos',
    muscles: [
      { id: 'deltoides', label: 'Deltoides' },
      { id: 'supraespinoso', label: 'Supraespinoso' },
      { id: 'infraespinoso', label: 'Infraespinoso' },
      { id: 'subescapular', label: 'Subescapular' },
      { id: 'redondo-menor', label: 'Redondo menor' },
      { id: 'biceps', label: 'Bíceps' },
      { id: 'triceps', label: 'Tríceps' },
      { id: 'flexores', label: 'Flexores' },
      { id: 'extensores', label: 'Extensores' },
    ],
  },
  {
    id: 'piernas',
    zone: 'piernas',
    label: 'Piernas',
    muscles: [
      { id: 'gluteo-mayor', label: 'Glúteo mayor' },
      { id: 'gluteo-medio', label: 'Glúteo medio' },
      { id: 'piriforme', label: 'Piriforme' },
      { id: 'cuadriceps', label: 'Cuádriceps' },
      { id: 'biceps-femoral', label: 'Bíceps femoral' },
      { id: 'semitendinoso', label: 'Semitendinoso' },
      { id: 'semimembranoso', label: 'Semimembranoso' },
      { id: 'aductores', label: 'Aductores' },
      { id: 'gemelos', label: 'Gemelos' },
      { id: 'soleo', label: 'Sóleo' },
      { id: 'tibial', label: 'Tibial' },
      { id: 'peroneos', label: 'Peroneos' },
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
