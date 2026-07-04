import { useEffect, useRef } from 'react';
import { useRutinas, useHabits } from '@shared/context';
import { formatDateForAPI, parseAPIDate } from '@shared/utils/dateUtils';
import { findRutinaByDateStr } from '@shared/habits';
import { ensureRutinaForDate } from './ensureRutinaForDate';

const ensuredDates = new Set();
const bootInFlight = new Map();
const MAX_ENSURE_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

/**
 * Carga hábitos/rutinas y asegura el log del día una sola vez por fecha (sesión).
 */
export default function useEnsureRutinaForDate(targetDate) {
  const { rutinas, fetchRutinas, getRutinaById } = useRutinas();
  const { fetchHabits } = useHabits();
  const rutinasRef = useRef(rutinas);

  const targetDateStr = formatDateForAPI(targetDate);

  useEffect(() => {
    rutinasRef.current = rutinas;
  }, [rutinas]);

  useEffect(() => {
    if (!targetDateStr) return undefined;

    let cancelled = false;
    let retryTimer;

    const markEnsuredIfPresent = () => {
      const cached = findRutinaByDateStr(rutinasRef.current, targetDateStr);
      if (cached?._id) {
        ensuredDates.add(targetDateStr);
        return true;
      }
      return false;
    };

    const boot = async (attempt = 0) => {
      if (cancelled) return;
      if (ensuredDates.has(targetDateStr) || markEnsuredIfPresent()) return;

      const inFlight = bootInFlight.get(targetDateStr);
      if (inFlight) {
        await inFlight.catch(() => {});
        return;
      }

      const run = (async () => {
        await Promise.all([
          typeof fetchHabits === 'function' ? fetchHabits().catch(() => {}) : undefined,
          typeof fetchRutinas === 'function' ? fetchRutinas().catch(() => {}) : undefined,
        ]);

        if (cancelled || typeof getRutinaById !== 'function') return;

        if (markEnsuredIfPresent()) return;

        const result = await ensureRutinaForDate(targetDate, {
          rutinas: rutinasRef.current,
          getRutinaById,
          fetchRutinas,
        }).catch(() => null);

        if (cancelled) return;

        if (result) {
          ensuredDates.add(targetDateStr);
          return;
        }

        if (attempt < MAX_ENSURE_RETRIES) {
          retryTimer = setTimeout(() => {
            boot(attempt + 1);
          }, RETRY_DELAY_MS * (attempt + 1));
        }
      })();

      bootInFlight.set(targetDateStr, run);
      try {
        await run;
      } finally {
        bootInFlight.delete(targetDateStr);
      }
    };

    boot();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [fetchRutinas, fetchHabits, getRutinaById, targetDate, targetDateStr, rutinas]);
}
