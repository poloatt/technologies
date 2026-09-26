/**
 * Nombre del modelo (Z-Anatomy) → grupo de entrenamiento y músculo.
 * El orden importa: lo más específico va primero.
 */
const RULES = [
  [/^(superior|inferior|medial|lateral) (rectus|oblique)$/i, 'cabeza', 'expresion'],
  [/levator palpebrae|tarsus|common tendinous/i, 'cabeza', 'expresion'],
  [/frontalis|occipitalis|orbicularis|zygomaticus|buccinator|nasalis|mentalis|risorius|procerus|corrugator|depressor|levator anguli|levator labii|epicranial|temporoparietalis|platysma|hyoglossus|genioglossus/i, 'cabeza', 'expresion'],
  [/masseter|pterygoid|digastric|mylohyoid|geniohyoid|stylohyoid/i, 'cabeza', 'masetero'],
  [/temporal$/i, 'cabeza', 'temporal'],
  [/sternocleidomastoid|omohyoid|sternohyoid|sternothyroid|thyrohyoid/i, 'cabeza', 'esternocleidomastoideo'],
  [/scalene|longus capitis|longus colli/i, 'cabeza', 'escalenos'],
  [/splenius|capitis/i, 'cabeza', 'extensores-cuello'],
  [/pectoralis major/i, 'pecho', 'pectoral-mayor'],
  [/pectoralis minor/i, 'pecho', 'pectoral-menor'],
  [/serratus anterior|subclavius/i, 'pecho', 'serrato'],
  [/latissimus|teres major/i, 'espalda', 'dorsal'],
  [/trapezius|levator scapulae/i, 'espalda', 'trapecio'],
  [/rhomboid/i, 'espalda', 'romboides'],
  [/quadratus lumborum/i, 'espalda', 'cuadrado'],
  [/iliocostalis|longissimus|spinalis|multifidus|interspinales|rotatores|intertransversarii|semispinalis|serratus posterior/i, 'espalda', 'erectores'],
  [/rectus abdominis|linea alba|pyramidalis/i, 'abdomen', 'recto'],
  [/transverse abdominal/i, 'abdomen', 'transverso'],
  [/abdominal external oblique/i, 'abdomen', 'oblicuo-externo'],
  [/abdominal internal oblique/i, 'abdomen', 'oblicuo-interno'],
  [/psoas/i, 'abdomen', 'psoas'],
  [/iliacus/i, 'abdomen', 'iliaco'],
  [/deltoid/i, 'brazos', 'deltoides'],
  [/supraspinatus/i, 'brazos', 'supraespinoso'],
  [/infraspinatus/i, 'brazos', 'infraespinoso'],
  [/subscapularis/i, 'brazos', 'subescapular'],
  [/teres minor/i, 'brazos', 'redondo-menor'],
  [/gluteus maximus/i, 'piernas', 'gluteo-mayor'],
  [/gluteus medius|gluteus minimus/i, 'piernas', 'gluteo-medio'],
  [/piriformis|obturator|gemelli|quadratus femoris/i, 'piernas', 'piriforme'],
  [/quadriceps|sartorius|retinaculum/i, 'piernas', 'cuadriceps'],
  [/biceps femoris/i, 'piernas', 'biceps-femoral'],
  [/semitendinosus/i, 'piernas', 'semitendinoso'],
  [/semimembranosus/i, 'piernas', 'semimembranoso'],
  [/adductor (magnus|longus|brevis)|pectineus|gracilis/i, 'piernas', 'aductores'],
  [/gastrocnemius/i, 'piernas', 'gemelos'],
  [/soleus|plantaris|tibialis posterior|popliteus|flexor (digitorum|hallucis) longus|flexor hallucis brevis|adductor hallucis/i, 'piernas', 'soleo'],
  [/tibialis anterior/i, 'piernas', 'tibial'],
  [/peroneus|fibularis/i, 'piernas', 'peroneos'],
  [/extensor (digitorum|hallucis) longus/i, 'piernas', 'tibial'],
  [/biceps|brachialis|coracobrachialis/i, 'brazos', 'biceps'],
  [/triceps|anconeus/i, 'brazos', 'triceps'],
  [/extensor|supinator/i, 'brazos', 'extensores'],
  [/pollicis|digiti minimi|lumbrical|interossei|flexor|pronator|brachioradialis|palmaris|opponens/i, 'brazos', 'flexores'],
];

const POSTERIOR = new Set([
  'extensores-cuello',
  'dorsal',
  'trapecio',
  'romboides',
  'erectores',
  'cuadrado',
  'infraespinoso',
  'supraespinoso',
  'redondo-menor',
  'triceps',
  'gluteo-mayor',
  'gluteo-medio',
  'piriforme',
  'biceps-femoral',
  'semitendinoso',
  'semimembranoso',
  'gemelos',
  'soleo',
]);

export function muscleGroup(name = '') {
  const rule = RULES.find(([pattern]) => pattern.test(name));
  if (!rule) return null;
  return { section: rule[1], muscle: rule[2] };
}

export function facesBack(section, muscle) {
  if (muscle) return POSTERIOR.has(muscle);
  return section === 'espalda';
}
