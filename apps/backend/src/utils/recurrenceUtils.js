import crypto from 'crypto';
import rruleModule from 'rrule';

const { RRule } = rruleModule;

const RECURRENCE_MARKER = 'Recurrencia:';
const NOTE_END_MARKERS = ['Subtareas:', 'Objetivo:', 'Proyecto:', '---'];

/** Quita bloque Subtareas: y líneas con marcadores ☐/☑. */
export function stripSubtareasBlock(text = '') {
  const lines = String(text).split('\n');
  const kept = [];
  let inSubtasks = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'Subtareas:') {
      inSubtasks = true;
      continue;
    }
    if (inSubtasks) continue;
    kept.push(line);
  }

  return kept.join('\n').trim();
}

/** Descripción limpia para guardar en BD (sin recurrencia ni subtareas embebidas). */
export function cleanDescriptionFromGoogleNotes(notes = '') {
  const { descripcionSinRecurrencia } = parseRecurrenceFromNotes(notes);
  const base = descripcionSinRecurrencia || '';
  const lines = base.split('\n');
  const endMarkers = [...NOTE_END_MARKERS, RECURRENCE_MARKER];
  const kept = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (endMarkers.some((m) => trimmed.startsWith(m))) break;
    if (/^RRULE:/i.test(trimmed)) break;
    kept.push(line);
  }

  return stripSubtareasBlock(kept.join('\n').trim());
}

/** RRULE desde notes: bloque Attadia o texto de repetición de Google Tasks. */
export function resolveRruleFromNotes(notes = '') {
  const parsed = parseRecurrenceFromNotes(notes);
  if (parsed.rrule) return parsed.rrule;
  return inferRecurrenceFromGoogleNotes(notes);
}

export function normalizeTitleForSerieKey(title = '') {
  return String(title)
    .replace(/^\s*(\[[^\]]+\]\s*)+/g, '')
    .replace(/\s+(\[[^\]]+\])\s+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function buildGoogleSerieKey(taskListId, title) {
  const raw = `${taskListId || ''}|${normalizeTitleForSerieKey(title)}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export function parseRecurrenceFromNotes(notes = '') {
  if (!notes) return { rrule: null, descripcionSinRecurrencia: notes };

  const lines = String(notes).split('\n');
  let rrule = null;
  const kept = [];
  let inRecurrence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === RECURRENCE_MARKER) {
      inRecurrence = true;
      continue;
    }
    if (inRecurrence) {
      if (trimmed.startsWith('RRULE:')) {
        rrule = trimmed.slice(6).trim();
        continue;
      }
      if (trimmed === '' || trimmed.startsWith('RRULE:')) {
        continue;
      }
      if (NOTE_END_MARKERS.some((m) => trimmed.startsWith(m))) {
        inRecurrence = false;
        kept.push(line);
        continue;
      }
      if (!rrule && trimmed.includes('FREQ=')) {
        rrule = trimmed;
        continue;
      }
      inRecurrence = false;
    }
    if (!inRecurrence) {
      kept.push(line);
    }
  }

  return {
    rrule,
    descripcionSinRecurrencia: kept.join('\n').trim(),
  };
}

export function appendRecurrenceToNotes(notes = '', rrule) {
  if (!rrule) return notes || '';
  const { descripcionSinRecurrencia } = parseRecurrenceFromNotes(notes);
  const base = descripcionSinRecurrencia || '';
  const block = `${RECURRENCE_MARKER}\nRRULE:${rrule}`;
  return base ? `${base}\n\n${block}` : block;
}

/**
 * Infiere RRULE a partir de fechas de vencimiento (heurística).
 */
const RRULE_WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export function weekdayToRruleByday(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  return RRULE_WEEKDAYS[date.getDay()];
}

/**
 * Detecta patrones de repetición en notes de Google Tasks (UI, sin campo API).
 */
export function inferRecurrenceFromGoogleNotes(notes = '') {
  const text = String(notes || '').toLowerCase();
  if (!text.trim()) return null;

  const everyNDays = text.match(/(?:every|cada)\s+(\d+)\s+(?:d[ií]as?|days?)\b/);
  if (everyNDays) {
    const interval = Math.max(1, Number(everyNDays[1]) || 1);
    return `FREQ=DAILY;INTERVAL=${interval}`;
  }

  if (
    /every\s+day|each\s+day|\bdaily\b|diariamente|cada\s+d[ií]a|todos\s+los\s+d[ií]as|repite\s+cada\s+d[ií]a|se\s+repite\s+diariamente/.test(
      text,
    )
  ) {
    return 'FREQ=DAILY;INTERVAL=1';
  }
  if (
    /every\s+week|\bweekly\b|semanalmente|cada\s+semana|todas\s+las\s+semanas|repite\s+cada\s+semana|se\s+repite\s+(cada\s+)?semana|se\s+repite\s+semanalmente|repetir\s+semanalmente|repeats?\s+weekly|cada\s+semana,\s*el\s+\w+/.test(
      text,
    )
  ) {
    return 'FREQ=WEEKLY;INTERVAL=1';
  }
  if (
    /every\s+month|\bmonthly\b|mensualmente|cada\s+mes|repite\s+cada\s+mes|se\s+repite\s+mensualmente/.test(
      text,
    )
  ) {
    return 'FREQ=MONTHLY;INTERVAL=1';
  }
  if (
    /every\s+year|\byearly\b|anualmente|cada\s+a[nñ]o|repite\s+cada\s+a[nñ]o|se\s+repite\s+anualmente/.test(
      text,
    )
  ) {
    return 'FREQ=YEARLY;INTERVAL=1';
  }
  if (/every\s+2\s+weeks|biweekly|quincenal|cada\s+2\s+semanas/.test(text)) {
    return 'FREQ=WEEKLY;INTERVAL=2';
  }

  const dayMatch = text.match(
    /(?:every|each|cada|on|los|las|el|la)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i,
  );
  if (dayMatch) {
    const map = {
      monday: 'MO', tuesday: 'TU', wednesday: 'WE', thursday: 'TH',
      friday: 'FR', saturday: 'SA', sunday: 'SU',
      lunes: 'MO', martes: 'TU', miercoles: 'WE', miércoles: 'WE',
      jueves: 'TH', viernes: 'FR', sabado: 'SA', sábado: 'SA', domingo: 'SU',
    };
    const byday = map[dayMatch[1].toLowerCase()];
    if (byday) return `FREQ=WEEKLY;INTERVAL=1;BYDAY=${byday}`;
  }

  return null;
}

/** Agrupa fechas únicas por día calendario. */
export function collectDueDatesFromTasks(tasks = []) {
  const seen = new Set();
  const dates = [];

  for (const t of tasks) {
    const candidates = [
      t?.fechaVencimiento,
      t?.fechaInicio,
      ...(Array.isArray(t?.googleDueHistory) ? t.googleDueHistory : []),
    ];
    for (const raw of candidates) {
      const d = raw instanceof Date ? raw : new Date(raw);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dates.push(d);
    }
  }

  return dates;
}

export function inferRruleFromDueDates(dates = []) {
  const sorted = [...dates]
    .filter((d) => d instanceof Date && !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (sorted.length < 2) {
    return null;
  }

  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(Math.round((sorted[i] - sorted[i - 1]) / (24 * 60 * 60 * 1000)));
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const maxDev = Math.max(...gaps.map((g) => Math.abs(g - avgGap)));

  if (maxDev > 2) {
    return null;
  }

  const dtstart = sorted[0];
  let freq = RRule.DAILY;
  let interval = 1;
  let byweekday;

  if (avgGap >= 6 && avgGap <= 8) {
    freq = RRule.WEEKLY;
    interval = 1;
  } else if (avgGap >= 13 && avgGap <= 15) {
    freq = RRule.WEEKLY;
    interval = 2;
  } else if (avgGap >= 28 && avgGap <= 31) {
    freq = RRule.MONTHLY;
    interval = 1;
  } else if (avgGap >= 360 && avgGap <= 370) {
    freq = RRule.YEARLY;
    interval = 1;
  } else if (avgGap >= 1 && avgGap < 6) {
    freq = RRule.DAILY;
    interval = Math.max(1, Math.round(avgGap));
  } else {
    return null;
  }

  if (freq === RRule.WEEKLY) {
    const weekdays = new Set(sorted.map((d) => d.getDay()));
    if (weekdays.size === 1) {
      const byday = weekdayToRruleByday(sorted[0]);
      if (byday && RRule[byday] != null) {
        byweekday = [RRule[byday]];
      }
    }
  }

  const ruleOpts = { freq, interval, dtstart };
  if (byweekday) ruleOpts.byweekday = byweekday;

  const rule = new RRule(ruleOpts);

  return rule.toString().replace(/^RRULE:/, '');
}

/** Añade BYDAY a RRULE semanal cuando falta (p. ej. inferencia genérica). */
export function ensureWeeklyByday(rrule, anchorDate) {
  if (!rrule || /BYDAY=/i.test(rrule)) return rrule;
  if (!/FREQ=WEEKLY/i.test(rrule)) return rrule;
  const d = anchorDate instanceof Date ? anchorDate : new Date(anchorDate);
  const byday = weekdayToRruleByday(d);
  if (!byday) return rrule;
  return `${rrule.replace(/;?\s*$/, '')};BYDAY=${byday}`;
}

export function expandSerie(rruleStr, dtstart, from, to) {
  if (!rruleStr || !dtstart || Number.isNaN(new Date(dtstart).getTime())) return [];

  const lines = String(rruleStr).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const freqLine = lines.find((line) => /FREQ=/i.test(line)) || lines[0] || '';
  const body = freqLine.replace(/^RRULE:/i, '');

  const start = dtstart instanceof Date ? dtstart : new Date(dtstart);
  try {
    const rule = new RRule({
      ...RRule.parseString(body),
      dtstart: start,
    });
    return rule.between(from, to, true);
  } catch {
    return [];
  }
}

export function sameCalendarDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}
