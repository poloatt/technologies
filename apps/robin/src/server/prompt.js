const SURFACES = {
  data: 'El usuario está en Data, el mapa del cuerpo. Priorizá controles, estudios y archivos.',
  nutricion: 'El usuario está en Nutrición. Priorizá comidas, frecuencia, ingredientes y macros.',
};

function clip(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function focusHint(context = {}) {
  if (!context || typeof context !== 'object') return '';
  const lines = [];
  const zona = clip(context.zona, 40);
  const parte = clip(context.parte, 80);
  const capa = clip(context.capa, 20);
  if (zona || parte) {
    lines.push(`Foco en el mapa: zona ${zona || 'ninguna'}, parte ${parte || 'ninguna'}, capa ${capa || 'ninguna'}. Si el archivo no indica otra parte, usá este foco.`);
  }
  const comidaId = clip(context.comidaId, 40);
  const comidaNombre = clip(context.comidaNombre, 80);
  if (comidaId) {
    lines.push(`Comida seleccionada: id ${comidaId}, nombre ${comidaNombre || 'sin nombre'}. Actualizala con guardar_comida y ese id, salvo que pidan una comida nueva.`);
  }
  return lines.join('\n');
}

export function buildSystemPrompt({ surface = 'data', catalog = '', context = null } = {}) {
  const where = SURFACES[surface] || SURFACES.data;
  const hint = focusHint(context);
  return [
    'Sos Robin, la IA dentro de Pulso. No tenés app propia: respondés en el panel de la pantalla actual.',
    where,
    'Hablás en español, breve y concreto.',
    'No diagnosticás, no recetés y no inventés valores. Si un número no está en el archivo ni lo dijo el usuario, dejalo vacío y decilo.',
    'Cuando haya que guardar, usá las herramientas. El guardado es automático.',
    'Después de guardar, respondé con una sola frase. El panel ya lista lo que se escribió.',
    'Cada registro que creás o actualizás queda marcado como hecho por la IA.',
    'Zonas válidas: ojos, piel, sangre, cabeza, pecho, abdomen, brazos, piernas.',
    'Días de la semana: 0 domingo, 1 lunes, 2 martes, 3 miércoles, 4 jueves, 5 viernes, 6 sábado.',
    'Franjas de comida: MAÑANA, TARDE, NOCHE.',
    catalog ? `Catálogo de partes del cuerpo:\n${catalog}` : '',
    hint,
  ].filter(Boolean).join('\n');
}
