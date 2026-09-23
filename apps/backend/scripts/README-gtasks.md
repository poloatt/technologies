# Runbook - Google Tasks (Auditoría, Limpieza y Normalización)

Este runbook documenta los comandos de mantenimiento para la integración con Google Tasks.

## Alcance de la integración

Attadia sincroniza **Google Tasks** (tareas ↔ objetivos) y, opcionalmente, **Google Calendar** (eventos con horario en la grilla de Foco).

| Sincroniza | No sincroniza |
|------------|----------------|
| Tareas (`Tareas`) con **objetivo** ↔ Google Task List | Horarios de Google Tasks (la API solo expone fecha en `due`) |
| Objetivo ↔ Google Task List | Hábitos / Rutinas (franja de iconos en Foco) |
| Subtareas en campo `notes` del task padre | Subtareas como tasks hijas (`parent`) en Google |
| **Eventos** de Google Calendar (`tipo: EVENTO`, read-only) | Sync bidireccional Calendar → Atta (v1 solo import) |
| Tareas con horario local (`Horario Attadia:` en notes) | Tasks con hora solo en UI de Google Calendar |

### Google Calendar API

- OAuth scope: `calendar.readonly`
- Rutas: `/api/google-calendar/*` (auth, status, sync, calendars)
- Eventos importados: `tipo: EVENTO`, sin objetivo, campos en `googleCalendarSync` (incluye `allDay`, `htmlLink`)
- Aparecen en **calendario/agenda** de Foco; no en listas Ahora/Luego
- **Read-only**: update/delete API responde 403; UI abre `htmlLink` en Google
- Tokens Calendar **no** se escriben en `googleTasksConfig` (scopes distintos)
- Cleanup: solo `status=cancelled` o calendarios deseleccionados (no por fuera de ventana)
- Habilitar **Google Calendar API** en GCP y añadir el scope al consent screen

Variables opcionales:

```bash
# GCAL_LOOKBACK_DAYS=14      # días hacia atrás (default)
# GCAL_HORIZON_DAYS=120      # días hacia adelante (default) — UI: "14 + 120 días"
# GCAL_SKIP_EVENT_TYPES=workingLocation,focusTime
```

`googleCalendarConfig.syncDirection` es siempre `from_google` (v1). El valor legacy `bidirectional` se fuerza a import-only.

La vista de semana de Google Calendar mezcla **eventos** (citables por API) y **tasks** (solo fecha por Tasks API). Atta importa cada uno por su canal.

## Modelo de subtareas (notes-only)

Las subtareas **no** se sincronizan como tareas hijas (`parent`) en Google Tasks. Van en el campo `notes` de la tarea padre, con bloque `Subtareas:` y marcadores `☐` / `☑`.

Campos legacy en schema (no usar en código nuevo):

- `subtarea.googleTaskId` — sustituido por bloque en `notes`
- `googleTasksSync.parent` — sustituido por modelo notes-only

## Import desde Google

Por defecto **no** se crea un Objetivo por cada TaskList nueva en Google. Solo se importan listas ya vinculadas (mismo nombre que un Objetivo local) o si `GTASKS_AUTO_CREATE_OBJETIVOS=true`.

## Tareas recurrentes (RRULE)

La API de Google Tasks **no expone** recurrencia nativa. Attadia:

- Guarda series en `TareaSeries` con RRULE (RFC 5545).
- Importa desde Google agrupando tasks con el mismo título y fechas `due` (≥2 instancias) o leyendo el bloque en `notes`:

```
Recurrencia:
RRULE:FREQ=WEEKLY;INTERVAL=1
```

- Series **creadas en Attadia** (`exportInstances: true`): pueden exportar ocurrencias a Google (lote limitado por `GTASKS_MAX_TASKS_PER_SYNC`).
- Series **inferidas desde Google** (`exportInstances: false`): una sola tarea en Google;
  el calendario Attadia **expande ocurrencias virtuales** en el rango visible (sin duplicar el día del ancla).
- Al completar una instancia, genera la siguiente ocurrencia local y la sincroniza.

API: `POST /api/tarea-series`, `PATCH /api/tarea-series/:id`, `DELETE /api/tarea-series/:id`.

## Variables de entorno (sync)

```bash
# GTASKS_MAX_TASKS_PER_SYNC=25
# GTASKS_CONCURRENCY=3
# GTASKS_AUTO_CREATE_OBJETIVOS=true   # por defecto false: no crear Objetivo por cada TaskList nueva en Google sin vínculo local
# GTASKS_SERIES_HORIZON_DAYS=90       # cuántos días de ocurrencias exportar por serie
# GTASKS_SERIES_LOOKBACK_DAYS=14      # días hacia atrás al expandir (calendario)
# GTASKS_FULL_IMPORT_HOURS=24   # import completo solo si la última sync fue hace más de N horas
```

## Scripts disponibles

- Normalizar títulos (remueve prefijos entre corchetes, colapsa espacios):

```bash
node apps/backend/scripts/normalize-task-titles.js --user="EMAIL|ID" --objetivo-name="Salud,Trámites" --google --dry-run=false
```

- Deduplicar subtareas (BD y opcionalmente Google):

```bash
node apps/backend/scripts/cleanup-duplicate-subtasks.js --user="EMAIL|ID" --objetivo-name="Salud" --google --dry-run=false
```

- Deduplicar tareas padre (BD y opcionalmente Google):

```bash
node apps/backend/scripts/cleanup-duplicate-tasks.js --user="EMAIL|ID" --objetivo-name="Trámites" --google-parents --dry-run=false
```

- Eliminar instancias materializadas duplicadas de series recurrentes (post-sync expand):

```bash
node apps/backend/scripts/cleanup-serie-instance-duplicates.js --user="EMAIL|ID" --dry-run=false
# npm run cleanup-serie-duplicates:apply
```

- Desactivar series inferidas por heurística semanal (tras syncs con `GTASKS_ASSUME_GOOGLE_RECURRING_SINGLE=true` antiguo):

```bash
node apps/backend/scripts/cleanup-heuristic-series.js --user="EMAIL|ID" --dry-run=true
node apps/backend/scripts/cleanup-heuristic-series.js --user="EMAIL|ID" --dry-run=false
```

- Auditoría de consistencia (duplicados/órfanos) por objetivo:

```bash
node apps/backend/scripts/audit-google-tasks-consistency.js --user="EMAIL|ID" --objetivo-name="Salud,Trámites" --google
```

- Reparar “padre = igual subtarea” por objetivo (mantiene subtareas, elimina padres):

```bash
node apps/backend/scripts/fix-main-equals-subtasks.js --user="EMAIL|ID" --objetivo-name="Salud" --google --dry-run=false
```

## Parámetros

- `--user`: email o ID del usuario.
- `--objetivo`: ID del objetivo (opcional).
- `--objetivo-name`: nombre(s) de objetivo, separados por coma (case/acentos ignorados). **Preferido.**
- `--project-name` / `--project`: alias legacy de `--objetivo-name` (soportado en scripts CLI).
- En la API/UI de limpieza por objetivo se usa `--objetivo-name` en el body.
- `--google`: aplica también en Google Tasks (cuando corresponde).
- `--dry-run`: por defecto es `true`. Usar `--dry-run=false` para aplicar cambios.

## Recomendaciones operativas

- Ejecutar primero en `--dry-run` y revisar salida.
- Aplicar por objetivo (o subconjuntos) para evitar picos de cuota.
- Ejecutar auditoría después de cada limpieza para validar el estado final.

## Sincronización con métricas

Ejecutar un full sync con métricas y control de lotes/concurrencia:

```bash
node apps/backend/scripts/run-full-sync.js --user="EMAIL" --limit=25 --concurrency=3
```

La salida incluye `timings`, `batches`, `errorsByReason` y flags de cuota. Además, el import reporta métricas de limpieza post-import: `deletedLocalNotInGoogle`, `dedupLocalGroups`, `dedupLocalRemoved`.

Respetar `syncDirection` del usuario (`bidirectional`, `to_google`, `from_google`) en full sync del servicio.
