import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Typography,
  Box,
  Switch,
  FormControlLabel,
  LinearProgress,
  IconButton,
  Stack,
  Alert,
  CircularProgress,
  Tooltip,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  Select,
  MenuItem,
  Checkbox,
  FormGroup,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Google as GoogleIcon,
  Sync as SyncIcon,
  DeleteSweep as DeleteSweepIcon,
  ExpandMore as ExpandMoreIcon,
  Schedule as ScheduleIcon,
  LinkOff as LinkOffIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSnackbar } from 'notistack';
import clienteAxios from '@shared/config/axios';
import { useAuth } from '@shared/context/AuthContext';
import { useResponsive } from '@shared/hooks';
import {
  TareaFormHeader,
  TareaFormFooter,
  TareaFormSectionLabel,
  tareaFormDialogPaperSx,
  tareaFormSaveButtonSx,
  tareaFormBodyTextSx,
  tareaFormCaptionTextSx,
  tareaFormAllDaySwitchControlSx,
  TASK_FORM_HORIZONTAL_PX,
  TASK_FORM_BODY_FONT_SIZE,
} from '@shared/components/forms/tareaFormUi';

const SYNC_DIRECTION_LABELS = {
  bidirectional: 'Bidireccional',
  to_google: 'Solo a Google',
  from_google: 'Solo desde Google',
};

function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return <Box role="tabpanel" sx={{ pt: 1 }}>{children}</Box>;
}

function SharedPrimaryButton({ onClick, disabled, loading, label, loadingLabel, startIcon }) {
  return (
    <Button
      variant="contained"
      fullWidth
      disabled={disabled}
      onClick={onClick}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : startIcon}
      sx={tareaFormSaveButtonSx}
    >
      {loading ? loadingLabel : label}
    </Button>
  );
}

function SettingRow({ label, hint, control }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        py: 0.75,
        minHeight: 40,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={tareaFormBodyTextSx}>{label}</Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary" sx={tareaFormCaptionTextSx}>
            {hint}
          </Typography>
        ) : null}
      </Box>
      {control}
    </Box>
  );
}

function parseSyncResults(results) {
  if (!results) return null;
  const fromGoogle = results.tareas?.fromGoogle || {};
  let skippedLists = fromGoogle.skippedTaskLists ?? 0;
  let skippedTasks = fromGoogle.skippedTasks ?? 0;
  if (fromGoogle.skippedTaskLists == null && fromGoogle.skippedTasks == null && fromGoogle.skipped) {
    skippedLists = fromGoogle.skipped;
    skippedTasks = 0;
  }

  return {
    objetivosCreated: results.objetivos?.created || 0,
    objetivosUpdated: results.objetivos?.updated || 0,
    toGoogle: results.tareas?.toGoogle?.success || 0,
    fromCreated: fromGoogle.created || 0,
    fromUpdated: fromGoogle.updated || 0,
    fromSkippedLists: skippedLists,
    fromSkippedTasks: skippedTasks,
    seriesCreated: results.series?.seriesCreated || fromGoogle.series?.seriesCreated || 0,
    seriesUpdated: results.series?.seriesUpdated || fromGoogle.series?.seriesUpdated || 0,
    instancesLinked: results.series?.instancesLinked || results.tareas?.fromGoogle?.series?.instancesLinked || 0,
    expandCreated:
      (results.seriesExpandLocal?.instancesCreated || 0)
      + (results.seriesExpand?.instancesCreated || 0),
    expandSynced: results.seriesExpand?.instancesSynced || 0,
    expandLocalCreated: results.seriesExpandLocal?.instancesCreated || 0,
    errors: [
      ...(results.objetivos?.errors || []),
      ...(results.tareas?.toGoogle?.errors || []),
      ...(results.tareas?.fromGoogle?.errors || []),
    ],
  };
}

function SyncResultPanel({ summary, onDismiss }) {
  const b = summary.breakdown;
  const hasChanges =
    b.ObjetivosCreated + b.ObjetivosUpdated + b.tareasToGoogle
    + b.tareasFromGoogleCreated + b.tareasFromGoogleUpdated > 0;
  const severity = summary.totalErrors > 0 ? 'warning' : hasChanges ? 'success' : 'info';

  const lines = [
    b.tareasFromGoogleCreated > 0 && `${b.tareasFromGoogleCreated} importadas`,
    b.tareasFromGoogleUpdated > 0 && `${b.tareasFromGoogleUpdated} actualizadas`,
    b.tareasToGoogle > 0 && `${b.tareasToGoogle} enviadas`,
    b.ObjetivosCreated + b.ObjetivosUpdated > 0
      && `${b.ObjetivosCreated + b.ObjetivosUpdated} objetivo(s)`,
    b.tareasFromGoogleSkippedLists > 0
      && `${b.tareasFromGoogleSkippedLists} lista(s) sin vincular`,
  ].filter(Boolean);

  return (
    <Alert severity={severity} onClose={onDismiss} sx={{ py: 0.5 }}>
      <Typography variant="body2" sx={tareaFormBodyTextSx}>
        {hasChanges ? 'Sync completado' : 'Sin cambios'}
        {lines.length ? ` · ${lines.join(' · ')}` : ''}
        {summary.totalErrors > 0 ? ` · ${summary.totalErrors} error(es)` : ''}
      </Typography>
    </Alert>
  );
}

const GoogleTasksConfig = ({ open, onClose }) => {
  const { user } = useAuth();
  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN';
  const { isMobile } = useResponsive();
  const [config, setConfig] = useState({
    enabled: false,
    lastSync: null,
    syncDirection: 'bidirectional',
  });
  const [autoSync, setAutoSync] = useState({ isRunning: false, nextRun: null });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [objetivoName, setObjetivoName] = useState('');
  const [applyCleanup, setApplyCleanup] = useState(false);
  const [calendarConfig, setCalendarConfig] = useState({
    enabled: false,
    lastSync: null,
    selectedCalendarIds: ['primary'],
  });
  const [calendarCalendars, setCalendarCalendars] = useState([]);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (open) {
      loadConfig();
      loadCalendarConfig();
      loadAutoSyncStatus();
      setError(null);
    }
  }, [open]);

  const lastSyncLabel = useMemo(() => {
    if (!config.lastSync) return 'Nunca';
    try {
      const d = new Date(config.lastSync);
      if (isNaN(d.getTime())) return 'Nunca';
      return `${formatDistanceToNow(d, { addSuffix: true, locale: es })} · ${format(d, "d MMM HH:mm", { locale: es })}`;
    } catch {
      return 'Nunca';
    }
  }, [config.lastSync]);

  const calendarLastSyncLabel = useMemo(() => {
    if (!calendarConfig.lastSync) return 'Nunca';
    try {
      const d = new Date(calendarConfig.lastSync);
      if (isNaN(d.getTime())) return 'Nunca';
      return `${formatDistanceToNow(d, { addSuffix: true, locale: es })} · ${format(d, "d MMM HH:mm", { locale: es })}`;
    } catch {
      return 'Nunca';
    }
  }, [calendarConfig.lastSync]);

  const loadCalendarConfig = async () => {
    try {
      const response = await clienteAxios.get('/api/google-calendar/status');
      const status = response.data.status || {};
      setCalendarConfig(status);
      if (status.enabled) {
        await loadCalendarList();
      } else {
        setCalendarCalendars([]);
      }
    } catch (err) {
      console.error('Error al cargar Google Calendar:', err);
    }
  };

  const loadCalendarList = async () => {
    try {
      const response = await clienteAxios.get('/api/google-calendar/calendars');
      setCalendarCalendars(response.data.calendars || []);
    } catch (err) {
      console.error('Error al listar calendarios:', err);
    }
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await clienteAxios.get('/api/google-tasks/status');
      setConfig(response.data.status);
    } catch (err) {
      console.error('Error al cargar configuración:', err);
      enqueueSnackbar('Error al cargar configuración de Google Tasks', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadAutoSyncStatus = async () => {
    try {
      const response = await clienteAxios.get('/api/google-tasks/auto-sync/status');
      setAutoSync(response.data.autoSync);
    } catch (err) {
      console.error('Error al cargar auto-sync:', err);
    }
  };

  const handleEnableGoogleCalendar = async () => {
    try {
      setLoading(true);
      const response = await clienteAxios.get('/api/google-calendar/auth-url', {
        params: { _t: Date.now() },
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.data.authUrl) {
        enqueueSnackbar('No se pudo generar la URL de autorización de Calendar', { variant: 'error' });
        return;
      }

      const authWindow = window.open(
        response.data.authUrl,
        'google-calendar-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes',
      );

      if (!authWindow) {
        enqueueSnackbar('Permite ventanas emergentes para conectar Google Calendar', { variant: 'warning' });
        return;
      }

      enqueueSnackbar('Completa la autorización de Google Calendar', { variant: 'info' });

      const handleAuthMessage = (event) => {
        if (event.data?.type === 'google_calendar_auth') {
          if (event.data.status === 'success') {
            enqueueSnackbar(event.data.message || 'Google Calendar conectado', { variant: 'success' });
            setTimeout(() => { loadCalendarConfig(); }, 500);
            window.dispatchEvent(new CustomEvent('googleCalendarSyncCompleted'));
          } else if (event.data.status === 'error') {
            enqueueSnackbar('Error en la autorización de Calendar', { variant: 'error' });
          }
          window.removeEventListener('message', handleAuthMessage);
          setLoading(false);
        }
      };

      window.addEventListener('message', handleAuthMessage);
      setTimeout(() => {
        window.removeEventListener('message', handleAuthMessage);
        setLoading(false);
      }, 300000);
    } catch (err) {
      enqueueSnackbar(
        err.response?.data?.error || err.message || 'Error al conectar Google Calendar',
        { variant: 'error' },
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDisableGoogleCalendar = async () => {
    if (!window.confirm('¿Desconectar Google Calendar? Los eventos ya importados se conservan.')) return;
    try {
      setLoading(true);
      await clienteAxios.delete('/api/google-calendar/disconnect');
      setCalendarConfig((prev) => ({ ...prev, enabled: false, lastSync: null }));
      setCalendarCalendars([]);
      enqueueSnackbar('Google Calendar desconectado', { variant: 'info' });
    } catch {
      enqueueSnackbar('Error al desconectar Calendar', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCalendarSelectionChange = async (calendarId, checked) => {
    const current = calendarConfig.selectedCalendarIds || ['primary'];
    const next = checked
      ? [...new Set([...current, calendarId])]
      : current.filter((id) => id !== calendarId);
    if (next.length === 0) {
      enqueueSnackbar('Debes seleccionar al menos un calendario', { variant: 'warning' });
      return;
    }
    try {
      setLoading(true);
      await clienteAxios.put('/api/google-calendar/config', { selectedCalendarIds: next });
      setCalendarConfig((prev) => ({ ...prev, selectedCalendarIds: next }));
      enqueueSnackbar('Calendarios actualizados', { variant: 'success' });
    } catch {
      enqueueSnackbar('No se pudieron guardar los calendarios', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCalendarSyncNow = async () => {
    try {
      setCalendarSyncing(true);
      const response = await clienteAxios.post('/api/google-calendar/sync');
      const r = response.data.results || {};
      enqueueSnackbar(
        `Calendar: ${r.created || 0} nuevos, ${r.updated || 0} actualizados`,
        { variant: 'success' },
      );
      await loadCalendarConfig();
      window.dispatchEvent(new CustomEvent('googleCalendarSyncCompleted'));
    } catch (err) {
      enqueueSnackbar(
        err.response?.data?.error || 'Error al sincronizar Google Calendar',
        { variant: 'error' },
      );
    } finally {
      setCalendarSyncing(false);
    }
  };

  const handleEnableGoogleTasks = async () => {
    try {
      setLoading(true);
      const response = await clienteAxios.get('/api/google-tasks/auth-url', {
        params: { _t: Date.now() },
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (response.data.directEnable) {
        enqueueSnackbar('Google Tasks conectado', { variant: 'success' });
        setTimeout(() => { loadConfig(); loadAutoSyncStatus(); }, 500);
        return;
      }

      if (!response.data.authUrl) {
        enqueueSnackbar('No se pudo generar la URL de autorización', { variant: 'error' });
        return;
      }

      const authWindow = window.open(
        response.data.authUrl,
        'google-tasks-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes',
      );

      if (!authWindow) {
        enqueueSnackbar('Permite ventanas emergentes para conectar Google', { variant: 'warning' });
        return;
      }

      enqueueSnackbar('Completa la autorización en la ventana de Google', { variant: 'info' });

      const handleAuthMessage = (event) => {
        if (event.data?.type === 'google_tasks_auth') {
          if (event.data.status === 'success') {
            enqueueSnackbar('Google Tasks conectado', { variant: 'success' });
            setTimeout(() => { loadConfig(); loadAutoSyncStatus(); }, 500);
          } else if (event.data.status === 'error') {
            enqueueSnackbar('Error en la autorización', { variant: 'error' });
          }
          window.removeEventListener('message', handleAuthMessage);
          setLoading(false);
        }
      };

      window.addEventListener('message', handleAuthMessage);
      setTimeout(() => {
        window.removeEventListener('message', handleAuthMessage);
        setLoading(false);
      }, 300000);
    } catch (err) {
      console.error('Error al conectar Google Tasks:', err);
      enqueueSnackbar(
        err.response?.data?.error || err.message || 'Error al conectar con Google',
        { variant: 'error' },
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDisableGoogleTasks = async () => {
    if (!window.confirm('¿Desconectar Google Tasks? Las tareas locales se conservan.')) return;
    try {
      setLoading(true);
      await clienteAxios.delete('/api/google-tasks/disable');
      setConfig((prev) => ({ ...prev, enabled: false, lastSync: null }));
      setAutoSync({ isRunning: false, nextRun: null });
      setSummary(null);
      enqueueSnackbar('Google Tasks desconectado', { variant: 'info' });
    } catch (err) {
      enqueueSnackbar('Error al desconectar', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncDirectionChange = async (event) => {
    const syncDirection = event.target.value;
    try {
      setLoading(true);
      await clienteAxios.put('/api/google-tasks/config', { syncDirection });
      setConfig((prev) => ({ ...prev, syncDirection }));
      enqueueSnackbar('Dirección de sincronización guardada', { variant: 'success' });
    } catch {
      enqueueSnackbar('No se pudo guardar la dirección de sync', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupDuplicates = async () => {
    try {
      setSyncing(true);
      setError(null);
      const response = await clienteAxios.post('/api/google-tasks/cleanup');
      const { data } = response.data;
      enqueueSnackbar(
        `${data.localFixed} título(s) normalizado(s) de ${data.totalProcessed} revisadas`,
        { variant: 'success' },
      );
      await loadConfig();
    } catch {
      enqueueSnackbar('Error al normalizar títulos', { variant: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleAuditProject = async () => {
    if (!objetivoName.trim()) {
      enqueueSnackbar('Escribe el nombre del objetivo', { variant: 'warning' });
      return;
    }
    try {
      setSyncing(true);
      const resp = await clienteAxios.post('/api/google-tasks/audit-project', { objetivoName: objetivoName.trim() });
      enqueueSnackbar('Auditoría completada (ver consola del navegador)', { variant: 'info' });
      setError({
        type: resp.data.success ? 'info' : 'warning',
        title: 'Auditoría',
        message: 'Resultado en la consola de desarrollo (F12).',
        details: (resp.data.output || '').split('\n').filter(Boolean).slice(-4),
      });
      console.log('[AUDIT]', resp.data.output);
    } catch {
      enqueueSnackbar('Error al auditar', { variant: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleCleanupProject = async () => {
    if (!objetivoName.trim()) {
      enqueueSnackbar('Escribe el nombre del objetivo', { variant: 'warning' });
      return;
    }
    try {
      setSyncing(true);
      const resp = await clienteAxios.post('/api/google-tasks/cleanup-project', {
        objetivoName: objetivoName.trim(),
        apply: applyCleanup,
      });
      enqueueSnackbar(applyCleanup ? 'Limpieza aplicada' : 'Simulación ejecutada', { variant: 'success' });
      setError({
        type: resp.data.success ? 'info' : 'warning',
        title: applyCleanup ? 'Limpieza' : 'Simulación',
        message: 'Resultado en la consola de desarrollo (F12).',
        details: (resp.data.output || '').split('\n').filter(Boolean).slice(-4),
      });
      console.log('[CLEANUP]', resp.data.output);
    } catch {
      enqueueSnackbar('Error en limpieza', { variant: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const applySyncResults = (results) => {
    const parsed = parseSyncResults(results);
    if (!parsed) return;

    const totalSuccess =
      parsed.objetivosCreated + parsed.objetivosUpdated + parsed.toGoogle
      + parsed.fromCreated + parsed.fromUpdated;
    const totalErrors = parsed.errors.length;

    setSummary({
      totalSuccess,
      totalErrors,
      breakdown: {
        ObjetivosCreated: parsed.objetivosCreated,
        ObjetivosUpdated: parsed.objetivosUpdated,
        tareasToGoogle: parsed.toGoogle,
        tareasFromGoogleCreated: parsed.fromCreated,
        tareasFromGoogleUpdated: parsed.fromUpdated,
        tareasFromGoogleSkippedLists: parsed.fromSkippedLists,
        tareasFromGoogleSkippedTasks: parsed.fromSkippedTasks,
        seriesCreated: parsed.seriesCreated,
        seriesUpdated: parsed.seriesUpdated,
        instancesLinked: parsed.instancesLinked,
        expandCreated: parsed.expandCreated,
        expandLocalCreated: parsed.expandLocalCreated,
        expandSynced: parsed.expandSynced,
      },
    });

    if (totalSuccess === 0 && parsed.fromSkippedLists > 0) {
      enqueueSnackbar(
        `${parsed.fromSkippedLists} lista(s) de Google sin objetivo vinculado. Crea el objetivo con el mismo nombre que la lista.`,
        { variant: 'info', autoHideDuration: 8000 },
      );
    } else if (totalSuccess > 0) {
      enqueueSnackbar('Sincronización completada', { variant: 'success' });
    }

    if (totalErrors > 0) {
      setError({
        type: 'warning',
        title: 'Algunas operaciones fallaron',
        message: `${totalErrors} error(es) durante la sincronización.`,
        details: parsed.errors.slice(0, 5),
      });
    }
  };

  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSummary(null);

      const response = await clienteAxios.post('/api/google-tasks/sync', {}, {
        timeout: 180000,
      });
      applySyncResults(response.data.results);
      await loadConfig();

      const totalMs = response.data.results?.metrics?.timings?.totalMs;
      const fullImport = response.data.results?.metrics?.fullImport;
      if (totalMs != null) {
        const secs = Math.round(totalMs / 1000);
        enqueueSnackbar(
          `Sync ${fullImport ? 'completo' : 'rápido'} en ${secs}s`,
          { variant: 'info', autoHideDuration: 4000 },
        );
      }

      window.dispatchEvent(new CustomEvent('googleTasksSyncCompleted', {
        detail: { results: response.data.results },
      }));
    } catch (err) {
      let errorMessage = err.response?.data?.error || 'Error en la sincronización';
      let errorType = 'error';

      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'La sincronización tardó demasiado (más de 3 min). Probá de nuevo; si persiste, usá sync incremental (esperá 24h entre syncs completos).';
      } else if (errorMessage.includes('Permisos insuficientes')) {
        errorType = 'warning';
        errorMessage += ' Revisa los permisos de Google Tasks en tu cuenta.';
      } else if (errorMessage.includes('Token') || errorMessage.includes('credentials')) {
        errorMessage = 'Sesión de Google expirada. Vuelve a conectar.';
      } else if (errorMessage.includes('Límite') || errorMessage.includes('cuota')) {
        errorType = 'warning';
        errorMessage = 'Límite de Google alcanzado. Espera unos minutos.';
      }

      setError({ type: errorType, title: 'No se pudo sincronizar', message: errorMessage });
      enqueueSnackbar(errorMessage, { variant: errorType });
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleAutoSync = async () => {
    try {
      if (autoSync.isRunning) {
        await clienteAxios.post('/api/google-tasks/auto-sync/stop');
        enqueueSnackbar('Sincronización automática desactivada', { variant: 'info' });
      } else {
        await clienteAxios.post('/api/google-tasks/auto-sync/start');
        enqueueSnackbar('Sincronización automática activada (cada ~10 min)', { variant: 'success' });
      }
      await loadAutoSyncStatus();
    } catch {
      enqueueSnackbar('Error al cambiar auto-sync', { variant: 'error' });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      disableRestoreFocus
      PaperProps={{
        sx: {
          ...tareaFormDialogPaperSx(isMobile),
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      sx={{
        '& .MuiBackdrop-root': {
          bottom: isMobile ? '56px' : 0,
        },
      }}
    >
      <TareaFormHeader onClose={onClose}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, pr: 0.5 }}>
          <GoogleIcon sx={{ color: '#fff', fontSize: 22, mt: 0.35, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="subtitle1"
              component="div"
              sx={{ ...tareaFormBodyTextSx, fontWeight: 700, fontSize: '1rem', lineHeight: 1.3 }}
            >
              Google Sync
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.25, ...tareaFormCaptionTextSx }}
            >
              Tasks y Calendar
            </Typography>
          </Box>
        </Box>
      </TareaFormHeader>

      {(loading || syncing || calendarSyncing) && (
        <LinearProgress sx={{ flexShrink: 0 }} />
      )}

      <DialogContent
        sx={{
          px: TASK_FORM_HORIZONTAL_PX,
          py: 1.5,
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{
            minHeight: 36,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: 36,
              textTransform: 'none',
              fontSize: TASK_FORM_BODY_FONT_SIZE,
              fontWeight: 600,
              py: 0.75,
            },
          }}
        >
          <Tab label="Tasks" />
          <Tab label="Calendar" />
        </Tabs>

        {error && (
          <Alert
            severity={error.type || 'error'}
            onClose={() => setError(null)}
            sx={{ py: 0.5 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, ...tareaFormBodyTextSx }}>
              {error.title}
            </Typography>
            <Typography variant="caption" sx={tareaFormCaptionTextSx}>
              {error.message}
            </Typography>
            {error.details?.length > 0 && (
              <Box component="ul" sx={{ m: 0, pl: 2, mt: 0.5 }}>
                {error.details.slice(0, 3).map((d, i) => (
                  <Typography component="li" key={i} variant="caption" sx={tareaFormCaptionTextSx}>
                    {typeof d === 'string' ? d : d.message || JSON.stringify(d)}
                  </Typography>
                ))}
              </Box>
            )}
          </Alert>
        )}

        {summary && activeTab === 0 && (
          <SyncResultPanel summary={summary} onDismiss={() => setSummary(null)} />
        )}

        <TabPanel value={activeTab} index={0}>
          {config.enabled ? (
            <Stack spacing={0.5}>
              <SettingRow
                label="Conectado"
                hint={`Último sync: ${lastSyncLabel}`}
                control={(
                  <Tooltip title="Desconectar">
                    <IconButton
                      size="small"
                      onClick={handleDisableGoogleTasks}
                      disabled={loading}
                      aria-label="Desconectar Google Tasks"
                    >
                      <LinkOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              />

              <SettingRow
                label="Dirección"
                control={(
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <Select
                      value={config.syncDirection || 'bidirectional'}
                      onChange={handleSyncDirectionChange}
                      disabled={loading}
                      sx={{ fontSize: TASK_FORM_BODY_FONT_SIZE }}
                    >
                      {Object.entries(SYNC_DIRECTION_LABELS).map(([value, label]) => (
                        <MenuItem key={value} value={value} sx={{ fontSize: TASK_FORM_BODY_FONT_SIZE }}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />

              {isAdmin && (
                <SettingRow
                  label="Auto-sync"
                  hint={autoSync.isRunning ? 'Cada ~10 min' : 'Desactivado'}
                  control={(
                    <FormControlLabel
                      control={(
                        <Switch
                          size="small"
                          checked={!!autoSync.isRunning}
                          onChange={handleToggleAutoSync}
                          disabled={loading}
                        />
                      )}
                      label=""
                      sx={{ ...tareaFormAllDaySwitchControlSx, m: 0 }}
                    />
                  )}
                />
              )}

              <Box sx={{ pt: 1 }}>
                <SharedPrimaryButton
                  onClick={handleSyncNow}
                  disabled={syncing || loading}
                  loading={syncing}
                  label="Sincronizar ahora"
                  loadingLabel="Sincronizando…"
                  startIcon={<SyncIcon />}
                />
              </Box>

              <Accordion
                disableGutters
                elevation={0}
                expanded={showAdvanced}
                onChange={(_, exp) => setShowAdvanced(exp)}
                sx={{
                  bgcolor: 'transparent',
                  '&:before': { display: 'none' },
                  mt: 0.5,
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon fontSize="small" />}
                  sx={{
                    minHeight: 36,
                    px: 0,
                    '& .MuiAccordionSummary-content': { my: 0.5 },
                  }}
                >
                  <Typography variant="body2" color="text.secondary" sx={tareaFormBodyTextSx}>
                    Más opciones
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 0, pt: 0, pb: 0.5 }}>
                  <Stack spacing={1.25}>
                    <Typography variant="caption" color="text.secondary" sx={tareaFormCaptionTextSx}>
                      Listas ↔ objetivos (mismo nombre). Sin subtareas anidadas, ni hábitos/rutinas.
                    </Typography>

                    <Box>
                      <TareaFormSectionLabel>Mantenimiento</TareaFormSectionLabel>
                      <Button
                        size="small"
                        variant="outlined"
                        fullWidth
                        startIcon={<DeleteSweepIcon />}
                        onClick={handleCleanupDuplicates}
                        disabled={syncing || loading}
                        sx={{ textTransform: 'none', mt: 0.5 }}
                      >
                        Normalizar títulos
                      </Button>
                    </Box>

                    <Box>
                      <TareaFormSectionLabel>Por objetivo</TareaFormSectionLabel>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Nombre del objetivo"
                        value={objetivoName}
                        onChange={(e) => setObjetivoName(e.target.value)}
                        sx={{ mt: 0.5, mb: 1 }}
                        inputProps={{ style: { fontSize: TASK_FORM_BODY_FONT_SIZE } }}
                      />
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={handleAuditProject}
                          disabled={syncing || loading || !objetivoName.trim()}
                          sx={{ textTransform: 'none', flex: 1 }}
                        >
                          Auditar
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color={applyCleanup ? 'error' : 'inherit'}
                          onClick={handleCleanupProject}
                          disabled={syncing || loading || !objetivoName.trim()}
                          sx={{ textTransform: 'none', flex: 1 }}
                        >
                          {applyCleanup ? 'Limpiar' : 'Simular'}
                        </Button>
                      </Stack>
                      <FormControlLabel
                        control={(
                          <Checkbox
                            size="small"
                            checked={applyCleanup}
                            onChange={(e) => setApplyCleanup(e.target.checked)}
                          />
                        )}
                        label={(
                          <Typography variant="caption" sx={tareaFormCaptionTextSx}>
                            Aplicar limpieza (no solo simular)
                          </Typography>
                        )}
                        sx={{ mt: 0.5, ml: 0 }}
                      />
                    </Box>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Stack>
          ) : (
            <Stack spacing={1.5} sx={{ py: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={tareaFormBodyTextSx}>
                Conectá Google Tasks para sincronizar objetivos y tareas.
              </Typography>
              <SharedPrimaryButton
                onClick={handleEnableGoogleTasks}
                disabled={loading}
                loading={loading}
                label="Conectar Google Tasks"
                loadingLabel="Conectando…"
                startIcon={<GoogleIcon />}
              />
            </Stack>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {calendarConfig.enabled ? (
            <Stack spacing={0.5}>
              <SettingRow
                label="Conectado"
                hint={`Último sync: ${calendarLastSyncLabel}`}
                control={(
                  <Tooltip title="Desconectar">
                    <IconButton
                      size="small"
                      onClick={handleDisableGoogleCalendar}
                      disabled={loading}
                      aria-label="Desconectar Google Calendar"
                    >
                      <LinkOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              />

              {calendarCalendars.length > 0 && (
                <Box sx={{ py: 0.5 }}>
                  <Typography variant="body2" sx={{ mb: 0.5, ...tareaFormBodyTextSx }}>
                    Calendarios
                  </Typography>
                  <FormGroup>
                    {calendarCalendars.map((cal) => (
                      <FormControlLabel
                        key={cal.id}
                        control={(
                          <Checkbox
                            size="small"
                            checked={(calendarConfig.selectedCalendarIds || []).includes(cal.id)}
                            onChange={(e) => handleCalendarSelectionChange(cal.id, e.target.checked)}
                            disabled={loading}
                          />
                        )}
                        label={(
                          <Typography variant="body2" sx={tareaFormBodyTextSx}>
                            {cal.summary || cal.id}
                            {cal.primary ? ' (principal)' : ''}
                          </Typography>
                        )}
                        sx={{ ml: 0, mr: 0 }}
                      />
                    ))}
                  </FormGroup>
                </Box>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5, ...tareaFormCaptionTextSx }}>
                Solo importación · ventana ±6 meses
              </Typography>

              <Box sx={{ pt: 1 }}>
                <SharedPrimaryButton
                  onClick={handleCalendarSyncNow}
                  disabled={calendarSyncing || loading}
                  loading={calendarSyncing}
                  label="Sincronizar ahora"
                  loadingLabel="Sincronizando…"
                  startIcon={<ScheduleIcon />}
                />
              </Box>
            </Stack>
          ) : (
            <Stack spacing={1.5} sx={{ py: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={tareaFormBodyTextSx}>
                Conectá Google Calendar para importar eventos a la agenda.
              </Typography>
              <SharedPrimaryButton
                onClick={handleEnableGoogleCalendar}
                disabled={loading}
                loading={loading}
                label="Conectar Google Calendar"
                loadingLabel="Conectando…"
                startIcon={<GoogleIcon />}
              />
            </Stack>
          )}
        </TabPanel>
      </DialogContent>

      <TareaFormFooter>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Cerrar
        </Button>
      </TareaFormFooter>
    </Dialog>
  );
};

export default GoogleTasksConfig;
