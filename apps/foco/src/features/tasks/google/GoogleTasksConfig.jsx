import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormGroup,
  Tabs,
  Tab,
  Chip,
  Collapse,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Google as GoogleIcon,
  Sync as SyncIcon,
  Close as CloseIcon,
  CloudOff as CloudOffIcon,
  DeleteSweep as DeleteSweepIcon,
  ExpandMore as ExpandMoreIcon,
  Build as BuildIcon,
  ArrowDownward as ImportIcon,
  ArrowUpward as ExportIcon,
  FolderOutlined as FolderIcon,
  Schedule as ScheduleIcon,
  LinkOff as LinkOffIcon,
  Event as EventIcon,
  TaskAlt as TaskAltIcon,
  InfoOutlined as InfoIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSnackbar } from 'notistack';
import clienteAxios from '@shared/config/axios';
import { useAuth } from '@shared/context/AuthContext';

const SYNC_DIRECTION_LABELS = {
  bidirectional: 'Bidireccional (Google ↔ Attadia)',
  to_google: 'Solo hacia Google',
  from_google: 'Solo desde Google',
};

/** Colores marca Google (acentos sutiles sobre tema Attadia oscuro). */
const GOOGLE = {
  blue: '#4285F4',
  red: '#EA4335',
  yellow: '#FBBC04',
  green: '#34A853',
};

function GoogleBrandStrip() {
  return (
    <Box sx={{ display: 'flex', height: 3, overflow: 'hidden', borderRadius: '3px 3px 0 0' }}>
      {[GOOGLE.blue, GOOGLE.red, GOOGLE.yellow, GOOGLE.green].map((color) => (
        <Box key={color} sx={{ flex: 1, bgcolor: color }} />
      ))}
    </Box>
  );
}

function ConnectionChip({ connected }) {
  return (
    <Chip
      size="small"
      label={connected ? 'Conectado' : 'Sin conectar'}
      icon={(
        <Box
          component="span"
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: connected ? GOOGLE.green : 'text.disabled',
            ml: '6px !important',
          }}
        />
      )}
      sx={{
        height: 26,
        fontWeight: 600,
        fontSize: '0.6875rem',
        letterSpacing: '0.02em',
        bgcolor: connected ? alpha(GOOGLE.green, 0.12) : alpha('#fff', 0.04),
        color: connected ? GOOGLE.green : 'text.secondary',
        border: '1px solid',
        borderColor: connected ? alpha(GOOGLE.green, 0.35) : 'divider',
      }}
    />
  );
}

function ServicePanel({ children, accent = GOOGLE.blue, sx }) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha('#fff', 0.02),
        overflow: 'hidden',
        ...sx,
      }}
    >
      <Box sx={{ height: 3, bgcolor: accent, opacity: 0.85 }} />
      <Box sx={{ p: 2 }}>{children}</Box>
    </Box>
  );
}

function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return <Box role="tabpanel" sx={{ pt: 2 }}>{children}</Box>;
}

function GoogleConnectButton({ onClick, disabled, label, icon: Icon = GoogleIcon, variant = 'tasks' }) {
  const accent = variant === 'calendar' ? GOOGLE.blue : GOOGLE.green;
  return (
    <Button
      variant="contained"
      fullWidth
      disabled={disabled}
      onClick={onClick}
      startIcon={<Icon sx={{ fontSize: 20 }} />}
      sx={{
        py: 1.35,
        borderRadius: 2,
        fontWeight: 600,
        textTransform: 'none',
        bgcolor: '#fff',
        color: '#202124',
        boxShadow: `0 1px 3px ${alpha('#000', 0.35)}`,
        '&:hover': {
          bgcolor: alpha('#fff', 0.92),
          boxShadow: `0 2px 8px ${alpha(accent, 0.25)}`,
        },
        '&.Mui-disabled': {
          bgcolor: alpha('#fff', 0.12),
          color: 'text.disabled',
        },
      }}
    >
      {label}
    </Button>
  );
}

function SyncPrimaryButton({ onClick, disabled, loading, label, loadingLabel }) {
  return (
    <Button
      variant="contained"
      fullWidth
      disabled={disabled}
      onClick={onClick}
      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SyncIcon />}
      sx={{
        py: 1.25,
        borderRadius: 2,
        fontWeight: 600,
        textTransform: 'none',
        bgcolor: 'primary.main',
        color: '#181818',
        '&:hover': { bgcolor: alpha('#fff', 0.88) },
        '&.Mui-disabled': { bgcolor: alpha('#fff', 0.15), color: alpha('#fff', 0.35) },
      }}
    >
      {loading ? loadingLabel : label}
    </Button>
  );
}

function LimitationsNote({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <Box
      sx={{
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: alpha(GOOGLE.blue, 0.2),
        bgcolor: alpha(GOOGLE.blue, 0.06),
        overflow: 'hidden',
      }}
    >
      <Button
        fullWidth
        onClick={() => setOpen((v) => !v)}
        startIcon={<InfoIcon sx={{ fontSize: 18, color: GOOGLE.blue }} />}
        endIcon={<ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
        sx={{
          justifyContent: 'flex-start',
          py: 1,
          px: 1.5,
          color: 'text.secondary',
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.75rem',
        }}
      >
        Limitaciones de la API de Google
      </Button>
      <Collapse in={open}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, pb: 1.5, lineHeight: 1.5 }}>
          {children}
        </Typography>
      </Collapse>
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

  const rows = [
    b.ObjetivosCreated > 0 && { icon: <FolderIcon fontSize="small" />, text: `${b.ObjetivosCreated} objetivo(s) creado(s) en Attadia` },
    b.ObjetivosUpdated > 0 && { icon: <FolderIcon fontSize="small" />, text: `${b.ObjetivosUpdated} objetivo(s) actualizado(s)` },
    b.tareasFromGoogleCreated > 0 && { icon: <ImportIcon fontSize="small" />, text: `${b.tareasFromGoogleCreated} tarea(s) importada(s) desde Google` },
    b.tareasFromGoogleUpdated > 0 && { icon: <ImportIcon fontSize="small" />, text: `${b.tareasFromGoogleUpdated} tarea(s) actualizada(s) desde Google` },
    b.tareasToGoogle > 0 && { icon: <ExportIcon fontSize="small" />, text: `${b.tareasToGoogle} tarea(s) enviada(s) a Google` },
    b.tareasFromGoogleSkippedLists > 0 && {
      icon: <CloudOffIcon fontSize="small" color="info" />,
      text: `${b.tareasFromGoogleSkippedLists} lista(s) de Google sin objetivo vinculado (no importadas)`,
    },
    b.tareasFromGoogleSkippedTasks > 0 && {
      icon: <CloudOffIcon fontSize="small" color="disabled" />,
      text: `${b.tareasFromGoogleSkippedTasks} tarea(s) en listas vinculadas ya estaban al día`,
    },
    b.seriesCreated > 0 && {
      icon: <ScheduleIcon fontSize="small" />,
      text: `${b.seriesCreated} serie(s) recurrente(s) nueva(s)`,
    },
    b.seriesUpdated > 0 && {
      icon: <ScheduleIcon fontSize="small" />,
      text: `${b.seriesUpdated} serie(s) recurrente(s) actualizada(s)`,
    },
    b.instancesLinked > 0 && {
      icon: <ImportIcon fontSize="small" />,
      text: `${b.instancesLinked} instancia(s) vinculada(s) a series`,
    },
    b.expandLocalCreated > 0 && {
      icon: <ImportIcon fontSize="small" />,
      text: `${b.expandLocalCreated} ocurrencia(s) en calendario (series recurrentes)`,
    },
    b.expandCreated > b.expandLocalCreated && {
      icon: <ExportIcon fontSize="small" />,
      text: `${b.expandCreated - (b.expandLocalCreated || 0)} ocurrencia(s) adicionales materializadas`,
    },
    b.expandSynced > 0 && {
      icon: <ExportIcon fontSize="small" />,
      text: `${b.expandSynced} ocurrencia(s) exportada(s) a Google`,
    },
  ].filter(Boolean);

  return (
    <Alert
      severity={severity}
      onClose={onDismiss}
      sx={{ '& .MuiAlert-message': { width: '100%' } }}
    >
      <Typography variant="subtitle2" sx={{ mb: rows.length ? 1 : 0 }}>
        {hasChanges ? 'Sincronización completada' : 'Sin cambios en esta sincronización'}
      </Typography>
      {rows.length > 0 ? (
        <List dense disablePadding>
          {rows.map((row, i) => (
            <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 28 }}>{row.icon}</ListItemIcon>
              <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={row.text} />
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Vincula cada lista de Google Tasks a un objetivo en Attadia (mismo nombre o ID guardado).
          Los eventos nativos de Google Calendar no se importan por Tasks; usa la sección Google Calendar más abajo.
          Las tareas con hora en Google Calendar UI no llegan por API; solo eventos del calendario.
        </Typography>
      )}
      {!hasChanges && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          La agenda muestra tareas en el día/semana seleccionados. Las completadas aparecen atenuadas.
        </Typography>
      )}
      {summary.totalErrors > 0 && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
          {summary.totalErrors} error(es). Revisa el detalle arriba en el panel de avisos.
        </Typography>
      )}
    </Alert>
  );
}

const GoogleTasksConfig = ({ open, onClose }) => {
  const { user } = useAuth();
  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN';
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
  const theme = useTheme();
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
        { variant: 'error',
        },
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
      PaperProps={{
        sx: {
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: theme.palette.background.paper,
          overflow: 'hidden',
        },
      }}
    >
      <GoogleBrandStrip />

      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, pb: 1, pt: 2 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha('#fff', 0.06),
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <GoogleIcon sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" component="div" lineHeight={1.2} fontWeight={700}>
            Google Workspace
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            Sincroniza Tasks y Calendar con Attadia Foco
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Cerrar" sx={{ mt: -0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 2, pb: 0 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{
            minHeight: 40,
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
              bgcolor: activeTab === 0 ? GOOGLE.green : GOOGLE.blue,
            },
            '& .MuiTab-root': {
              minHeight: 40,
              py: 1,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8125rem',
              color: 'text.secondary',
              gap: 0.75,
              '&.Mui-selected': { color: 'text.primary' },
            },
          }}
        >
          <Tab
            icon={<TaskAltIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Tasks"
          />
          <Tab
            icon={<EventIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Calendar"
          />
        </Tabs>
        <Divider />
      </Box>

      <DialogContent sx={{ pt: 0, px: 2, pb: 1 }}>
        {(loading || syncing || calendarSyncing) && (
          <LinearProgress
            sx={{
              mb: 2,
              mt: 1,
              borderRadius: 1,
              bgcolor: alpha('#fff', 0.06),
              '& .MuiLinearProgress-bar': {
                bgcolor: activeTab === 0 ? GOOGLE.green : GOOGLE.blue,
              },
            }}
          />
        )}

        <Stack spacing={2}>
          {error && (
            <Alert severity={error.type} onClose={() => setError(null)} sx={{ borderRadius: 2 }}>
              <Typography variant="subtitle2">{error.title}</Typography>
              <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
                {error.message}
              </Typography>
              {error.details?.length > 0 && (
                <Box sx={{ mt: 1, maxHeight: 80, overflow: 'auto' }}>
                  {error.details.map((d, i) => (
                    <Typography key={i} variant="caption" display="block" color="text.secondary">
                      · {d}
                    </Typography>
                  ))}
                </Box>
              )}
            </Alert>
          )}

          {syncing && activeTab === 0 && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <CircularProgress size={16} sx={{ color: GOOGLE.green }} />
              <Typography variant="body2" color="text.secondary">
                Sincronizando Google Tasks…
              </Typography>
            </Stack>
          )}

          {calendarSyncing && activeTab === 1 && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <CircularProgress size={16} sx={{ color: GOOGLE.blue }} />
              <Typography variant="body2" color="text.secondary">
                Sincronizando eventos de Calendar…
              </Typography>
            </Stack>
          )}

          {!syncing && summary && activeTab === 0 && (
            <SyncResultPanel summary={summary} onDismiss={() => setSummary(null)} />
          )}

          <TabPanel value={activeTab} index={0}>
            {config.enabled ? (
              <Stack spacing={2}>
                <ServicePanel accent={GOOGLE.green}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CheckCircleOutlineIcon sx={{ color: GOOGLE.green, fontSize: 22 }} />
                      <Typography variant="subtitle1" fontWeight={700}>Google Tasks</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <ConnectionChip connected />
                      <Tooltip title="Desconectar">
                        <span>
                          <IconButton
                            size="small"
                            onClick={handleDisableGoogleTasks}
                            disabled={loading || syncing}
                          >
                            <LinkOffIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1.5 }}>
                    <ScheduleIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      Última sync: {lastSyncLabel}
                    </Typography>
                  </Stack>

                  <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="gtasks-sync-direction-label">Dirección</InputLabel>
                    <Select
                      labelId="gtasks-sync-direction-label"
                      label="Dirección"
                      value={config.syncDirection || 'bidirectional'}
                      onChange={handleSyncDirectionChange}
                      disabled={loading || syncing}
                    >
                      {Object.entries(SYNC_DIRECTION_LABELS).map(([value, label]) => (
                        <MenuItem key={value} value={value}>{label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <SyncPrimaryButton
                    onClick={handleSyncNow}
                    disabled={syncing || loading}
                    loading={syncing}
                    label="Sincronizar Tasks"
                    loadingLabel="Sincronizando…"
                  />
                </ServicePanel>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 0.5,
                    py: 0.5,
                    borderRadius: 1.5,
                    bgcolor: alpha('#fff', 0.02),
                  }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Auto-sync</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {isAdmin
                        ? 'Cada ~10–15 min en el servidor (control global)'
                        : (autoSync.isRunning
                          ? 'Activo en el servidor (~10–15 min)'
                          : 'Gestionado por el servidor')}
                    </Typography>
                  </Box>
                  {isAdmin ? (
                    <Switch
                      checked={autoSync.isRunning}
                      onChange={handleToggleAutoSync}
                      disabled={loading || syncing}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: GOOGLE.green },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: alpha(GOOGLE.green, 0.5) },
                      }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ pr: 1 }}>
                      {autoSync.isRunning ? 'On' : 'Off'}
                    </Typography>
                  )}
                </Box>

                <LimitationsNote>
                  Listas ↔ objetivos. Subtareas en notas de Google. Los horarios de Tasks no vienen por API;
                  solo fecha o horario definido en Atta. Hábitos y rutinas no se sincronizan. Los eventos del
                  calendario se importan en la pestaña Calendar.
                </LimitationsNote>

                <Accordion
                  expanded={showAdvanced}
                  onChange={(_, exp) => setShowAdvanced(exp)}
                  disableGutters
                  elevation={0}
                  sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ px: 0.5, minHeight: 36, '& .MuiAccordionSummary-content': { my: 0 } }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <BuildIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary" fontWeight={500}>
                        Herramientas avanzadas
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0.5, pt: 0 }}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                          Normalizar títulos
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          fullWidth
                          startIcon={<DeleteSweepIcon />}
                          onClick={handleCleanupDuplicates}
                          disabled={syncing || loading}
                          sx={{ borderRadius: 2, borderColor: 'divider' }}
                        >
                          Normalizar títulos locales
                        </Button>
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>Por objetivo</Typography>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Nombre del objetivo, ej. Salud"
                          value={objetivoName}
                          onChange={(e) => setObjetivoName(e.target.value)}
                          disabled={syncing}
                          sx={{ mb: 1 }}
                        />
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Button variant="outlined" size="small" onClick={handleAuditProject} disabled={syncing || !objetivoName.trim()}>
                            Auditar
                          </Button>
                          <FormControlLabel
                            control={
                              <Switch size="small" checked={applyCleanup} onChange={(e) => setApplyCleanup(e.target.checked)} disabled={syncing} />
                            }
                            label={<Typography variant="caption">Aplicar</Typography>}
                          />
                          <Button
                            variant="outlined"
                            color="warning"
                            size="small"
                            onClick={handleCleanupProject}
                            disabled={syncing || !objetivoName.trim()}
                          >
                            {applyCleanup ? 'Limpiar' : 'Simular'}
                          </Button>
                        </Stack>
                      </Box>
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Stack>
            ) : (
              <Stack spacing={2} alignItems="stretch">
                <ServicePanel accent={GOOGLE.green}>
                  <Stack alignItems="center" textAlign="center" spacing={1.5} sx={{ py: 1 }}>
                    <CloudOffIcon sx={{ fontSize: 44, color: alpha('#fff', 0.2) }} />
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
                      Conectá Google Tasks para sincronizar listas con tus objetivos en Attadia.
                    </Typography>
                  </Stack>
                </ServicePanel>
                <GoogleConnectButton
                  onClick={handleEnableGoogleTasks}
                  disabled={loading}
                  label="Conectar Google Tasks"
                  icon={TaskAltIcon}
                  variant="tasks"
                />
              </Stack>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            {calendarConfig.enabled ? (
              <Stack spacing={2}>
                <ServicePanel accent={GOOGLE.blue}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <EventIcon sx={{ color: GOOGLE.blue, fontSize: 22 }} />
                      <Typography variant="subtitle1" fontWeight={700}>Google Calendar</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <ConnectionChip connected />
                      <Tooltip title="Desconectar Calendar">
                        <span>
                          <IconButton
                            size="small"
                            onClick={handleDisableGoogleCalendar}
                            disabled={loading || calendarSyncing}
                          >
                            <LinkOffIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                    Última sync: {calendarLastSyncLabel}
                  </Typography>

                  {calendarCalendars.length > 0 && (
                    <FormGroup sx={{ mb: 2, gap: 0.25 }}>
                      {calendarCalendars.map((cal) => (
                        <FormControlLabel
                          key={cal.id}
                          control={(
                            <Checkbox
                              size="small"
                              checked={(calendarConfig.selectedCalendarIds || ['primary']).includes(cal.id)}
                              onChange={(e) => handleCalendarSelectionChange(cal.id, e.target.checked)}
                              disabled={loading || calendarSyncing}
                              sx={{
                                color: alpha(GOOGLE.blue, 0.5),
                                '&.Mui-checked': { color: GOOGLE.blue },
                              }}
                            />
                          )}
                          label={(
                            <Typography variant="body2">
                              {cal.summary}{cal.primary ? ' · principal' : ''}
                            </Typography>
                          )}
                        />
                      ))}
                    </FormGroup>
                  )}

                  <Button
                    variant="outlined"
                    fullWidth
                    disabled={calendarSyncing || loading}
                    onClick={handleCalendarSyncNow}
                    startIcon={calendarSyncing ? <CircularProgress size={16} /> : <SyncIcon />}
                    sx={{
                      py: 1.1,
                      borderRadius: 2,
                      fontWeight: 600,
                      textTransform: 'none',
                      borderColor: alpha(GOOGLE.blue, 0.45),
                      color: GOOGLE.blue,
                      '&:hover': {
                        borderColor: GOOGLE.blue,
                        bgcolor: alpha(GOOGLE.blue, 0.08),
                      },
                    }}
                  >
                    {calendarSyncing ? 'Sincronizando…' : 'Sincronizar eventos'}
                  </Button>
                </ServicePanel>

                <LimitationsNote>
                  Importa eventos del calendario (clases, reuniones) con horario en la grilla de Foco.
                  No incluye tasks con checkbox de Google Calendar — esos vienen por la pestaña Tasks (sin hora por API).
                </LimitationsNote>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <ServicePanel accent={GOOGLE.blue}>
                  <Stack alignItems="center" textAlign="center" spacing={1.5} sx={{ py: 1 }}>
                    <EventIcon sx={{ fontSize: 44, color: alpha(GOOGLE.blue, 0.35) }} />
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
                      Importá citas y clases con horario real en el calendario de Foco (solo lectura).
                    </Typography>
                  </Stack>
                </ServicePanel>
                <GoogleConnectButton
                  onClick={handleEnableGoogleCalendar}
                  disabled={loading}
                  label="Conectar Google Calendar"
                  icon={EventIcon}
                  variant="calendar"
                />
              </Stack>
            )}
          </TabPanel>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, pt: 0.5 }}>
        <Button onClick={onClose} size="medium" sx={{ textTransform: 'none', fontWeight: 500 }}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GoogleTasksConfig;
