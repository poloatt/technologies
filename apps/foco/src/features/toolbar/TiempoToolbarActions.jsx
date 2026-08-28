import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CalendarTodayOutlined,
  DeleteOutlined,
  Google as GoogleIcon,
  TuneOutlined,
  ViewModuleOutlined,
  EventRepeatOutlined,
} from '@mui/icons-material';
import { SystemButtons } from '@shared/components/common/SystemButtons';
import { ToolbarAddButton } from '@shared/components/common/ToolbarAddButton';
import RutinaToolbarAddButton from './RutinaToolbarAddButton';
import { useActionHistory } from '@shared/context/ActionHistoryContext';
import { useUndoScope } from '@shared/hooks/useScopedUndo';
import { getIconByKey } from '@shared/navigation/menuIcons';
import { matchTiempoSection } from '@shared/navigation/tiempoToolbarPaths';
import { TIEMPO_ICON_KEYS } from '@shared/navigation/tiempoIconKeys';
import { toggleTareasPageView, useTareasPageView } from '../tasks/list/useTareasPageView';
import { RUTINA_PAGE_VIEW, toggleRutinaPageView } from '../habits/daily/useRutinaPageView';

function readStoredRutinaPageView() {
  if (typeof window === 'undefined') return RUTINA_PAGE_VIEW.group;
  const stored = window.localStorage.getItem('foco.rutinas.pageView');
  return stored === RUTINA_PAGE_VIEW.cadence ? RUTINA_PAGE_VIEW.cadence : RUTINA_PAGE_VIEW.group;
}

const ScopedUndoButton = SystemButtons.ScopedUndoButton;

const TareasMenuIcon = getIconByKey(TIEMPO_ICON_KEYS.tareas);

/**
 * Acciones de contexto del módulo Tiempo (no navegación).
 * Usar en overlay móvil del Hub/Agenda o en el centro de Objetivos/Tareas en desktop.
 */
export default function TiempoToolbarActions({ section: sectionProp, dense = false }) {
  const { pathname } = useLocation();
  const section = sectionProp || matchTiempoSection(pathname);
  const [hasSelectedItems, setHasSelectedItems] = useState(false);
  const tareasPageView = useTareasPageView();
  const isTareasAgendaView = section === 'tareas' && tareasPageView === 'agenda';
  const [rutinaPageView, setRutinaPageView] = useState(readStoredRutinaPageView);
  const isRutinaCadenceView = section === 'rutinas' && rutinaPageView === RUTINA_PAGE_VIEW.cadence;
  const undoScope = useUndoScope();
  const { actionHistory, getUndoCountForScope } = useActionHistory();
  const undoCount = undoScope ? getUndoCountForScope(undoScope) : 0;
  const showUndo = undoCount > 0;

  useEffect(() => {
    const handleSelectionChange = (event) => {
      setHasSelectedItems(!!event.detail?.hasSelections);
    };
    window.addEventListener('selectionChanged', handleSelectionChange);
    return () => window.removeEventListener('selectionChanged', handleSelectionChange);
  }, []);

  useEffect(() => {
    const syncRutinaView = (event) => {
      const next = event.detail?.viewMode;
      if (next === RUTINA_PAGE_VIEW.group || next === RUTINA_PAGE_VIEW.cadence) {
        setRutinaPageView(next);
      }
    };
    window.addEventListener('rutinaSetPageView', syncRutinaView);
    return () => window.removeEventListener('rutinaSetPageView', syncRutinaView);
  }, []);

  const commonButtonSx = useMemo(() => ({
    width: dense ? { xs: 32, sm: 26 } : { xs: 32, sm: 26 },
    height: dense ? { xs: 32, sm: 26 } : { xs: 32, sm: 26 },
    padding: { xs: 0.25, sm: 0.125 },
    minWidth: { xs: 32, sm: 26 },
    minHeight: { xs: 32, sm: 26 },
    color: 'text.secondary',
    '& .MuiSvgIcon-root': {
      fontSize: { xs: '1.1rem', sm: '1.1rem' },
    },
    '&:hover': {
      backgroundColor: 'action.hover',
      color: 'text.primary',
    },
  }), [dense]);

  const undoAction = useMemo(() => (showUndo ? {
    key: 'undo',
    icon: <ScopedUndoButton buttonSx={commonButtonSx} scope={undoScope} />,
    label: 'Deshacer última acción',
    tooltip: `Deshacer última acción (${undoCount})`,
  } : null), [commonButtonSx, showUndo, undoCount, undoScope]);

  const actions = useMemo(() => {
    if (section === 'archivo') {
      return undoAction ? [undoAction] : [];
    }

    if (section === 'rutinas') {
      return [
        ...(undoAction ? [undoAction] : []),
        {
          key: 'toggleRutinaView',
          icon: isRutinaCadenceView ? <ViewModuleOutlined /> : <EventRepeatOutlined />,
          label: isRutinaCadenceView ? 'Vista por grupo' : 'Vista por cadencia',
          tooltip: isRutinaCadenceView ? 'Vista por grupo' : 'Vista por cadencia',
          color: isRutinaCadenceView ? 'primary.main' : 'text.secondary',
          hoverColor: 'primary.main',
          buttonSx: {
            ...commonButtonSx,
            ...(isRutinaCadenceView && {
              bgcolor: 'action.selected',
              '&:hover': { bgcolor: 'action.selected' },
            }),
          },
          onClick: () => toggleRutinaPageView(rutinaPageView),
        },
        {
          key: 'personalizarRutina',
          icon: <TuneOutlined />,
          label: 'Personalizar hábitos',
          tooltip: 'Personalizar hábitos',
          buttonSx: commonButtonSx,
          onClick: () => window.dispatchEvent(new CustomEvent('openHabitTemplates')),
        },
        {
          key: 'add',
          icon: <RutinaToolbarAddButton buttonSx={commonButtonSx} />,
          label: 'Agregar hábito',
        },
      ];
    }

    const list = [
      ...(undoAction ? [undoAction] : []),
      ...((section === 'tareas' || section === 'objetivos') ? [{
        key: 'googleTasks',
        icon: <GoogleIcon sx={{ color: '#fff' }} />,
        label: 'Google Sync',
        tooltip: 'Google Sync',
        color: '#fff',
        hoverColor: '#fff',
        buttonSx: {
          ...commonButtonSx,
          color: '#fff',
          '& .MuiSvgIcon-root': {
            ...(commonButtonSx['& .MuiSvgIcon-root'] || {}),
            color: '#fff',
          },
          '&:hover': {
            backgroundColor: 'action.hover',
            color: '#fff',
            '& .MuiSvgIcon-root': { color: '#fff' },
          },
        },
        onClick: () => window.dispatchEvent(new CustomEvent('openGoogleTasksConfig')),
      }] : []),
      ...(section === 'tareas' ? [{
        key: 'toggleAgendaView',
        icon: isTareasAgendaView ? <TareasMenuIcon /> : <CalendarTodayOutlined />,
        label: isTareasAgendaView ? 'Ver lista' : 'Ver agenda',
        tooltip: isTareasAgendaView ? 'Ver lista de tareas' : 'Ver agenda',
        color: isTareasAgendaView ? 'primary.main' : 'text.secondary',
        hoverColor: 'primary.main',
        buttonSx: {
          ...commonButtonSx,
          ...(isTareasAgendaView && {
            bgcolor: 'action.selected',
            '&:hover': { bgcolor: 'action.selected' },
          }),
        },
        onClick: () => toggleTareasPageView(tareasPageView),
      }] : []),
      {
        key: 'deleteSelected',
        icon: <DeleteOutlined />,
        label: 'Eliminar',
        tooltip: section === 'objetivos' ? 'Eliminar objetivos seleccionados' : 'Eliminar seleccionadas',
        color: 'error.main',
        hoverColor: 'error.main',
        buttonSx: commonButtonSx,
        show: hasSelectedItems,
        onClick: () => {
          if (section === 'objetivos') {
            window.dispatchEvent(new CustomEvent('deleteSelectedObjetivos'));
          } else {
            window.dispatchEvent(new CustomEvent('deleteSelectedTasks'));
          }
        },
      },
    ];

    const addTooltip = section === 'objetivos'
      ? 'Nuevo objetivo'
      : 'Nueva tarea';

    list.push({
      key: 'add',
      icon: (
        <ToolbarAddButton
          buttonSx={commonButtonSx}
          aria-label={addTooltip}
          onClick={() => {
            if (section === 'objetivos') {
              window.dispatchEvent(new CustomEvent('addObjetivo'));
            } else {
              window.dispatchEvent(new CustomEvent('addTask'));
            }
          }}
        />
      ),
      label: addTooltip,
    });

    return list;
  }, [actionHistory, commonButtonSx, hasSelectedItems, isRutinaCadenceView, isTareasAgendaView, rutinaPageView, section, tareasPageView, undoAction]);

  if (!section) return null;
  if (actions.length === 0) return null;

  return (
    <SystemButtons
      actions={actions}
      gap={dense ? { xs: 0.02, sm: 0.1 } : { xs: 0.02, sm: 0.1 }}
    />
  );
}
