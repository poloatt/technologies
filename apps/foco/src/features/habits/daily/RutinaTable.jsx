import React, { useMemo, memo, useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Grid } from '@mui/material';
import RutinaCard from './RutinaCard';
import {
  rutinaGridContainerSx,
  rutinaGridItemSx,
  rutinaPageLoaderSx,
} from '@shared/styles/rutinaPageStyles';
import { useHabits } from '@shared/context';
import useResponsive from '@shared/hooks/useResponsive';
import { resolveHabitSections, resolveSectionLabel } from '@shared/habits';
import HabitGroupFormDialog from '@shared/components/habits/HabitGroupFormDialog';
import RutinaDesktopLayout from './RutinaDesktopLayout';
import AddHabitGroupButton, { AddHabitGroupButtonWrap } from '@shared/components/habits/AddHabitGroupButton';
import useHabitGroupActions from './useHabitGroupActions';
import { toISODateString, parseAPIDate } from '@shared/utils/dateUtils';

export const RutinaTable = ({
  rutina,
  loading: loadingProp,
}) => {
  const { customSections } = useHabits();
  const { isDesktop } = useResponsive();

  const {
    groupDialogOpen,
    setGroupDialogOpen,
    groupDialogMode,
    editingSection,
    isSavingGroup,
    openCreateGroupDialog,
    openEditGroupDialog,
    handleSaveGroup,
    handleDeleteGroup,
  } = useHabitGroupActions({ customSections });

  useEffect(() => {
    const onOpenAddHabitGroup = () => openCreateGroupDialog();
    window.addEventListener('openAddHabitGroup', onOpenAddHabitGroup);
    return () => window.removeEventListener('openAddHabitGroup', onOpenAddHabitGroup);
  }, [openCreateGroupDialog]);

  const sectionCards = useMemo(
    () => resolveHabitSections(customSections).map((key) => ({
      key,
      title: resolveSectionLabel(key, customSections),
    })),
    [customSections],
  );

  const rutinaDateKey = useMemo(() => {
    try {
      return rutina?.fecha ? toISODateString(parseAPIDate(rutina.fecha)) : 'no-rutina';
    } catch {
      return rutina?._id || 'no-rutina';
    }
  }, [rutina?.fecha, rutina?._id]);

  const [expandedSection, setExpandedSection] = useState(null);

  useEffect(() => {
    setExpandedSection(null);
  }, [rutinaDateKey]);

  if (loadingProp) {
    return (
      <Box sx={{ ...rutinaPageLoaderSx, height: '70vh', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!rutina || !rutina._id) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography color="text.secondary">
          No hay ninguna rutina para mostrar
        </Typography>
      </Box>
    );
  }

  return (
    <Box key={rutinaDateKey}>
      {isDesktop ? (
        <RutinaDesktopLayout rutina={rutina} />
      ) : (
        <>
          <Grid container spacing={1} sx={rutinaGridContainerSx}>
            {sectionCards.map(({ key, title }) => (
              <Grid item xs={12} md={6} sx={rutinaGridItemSx} key={`card-${key}-${rutinaDateKey}`}>
                <RutinaCard
                  title={title}
                  section={key}
                  data={rutina[key] || {}}
                  config={rutina.config?.[key] || {}}
                  readOnly={false}
                  onEditGroup={openEditGroupDialog}
                  onDeleteGroup={handleDeleteGroup}
                  expandedSection={expandedSection}
                  onExpandedSectionChange={setExpandedSection}
                />
              </Grid>
            ))}
          </Grid>
          <AddHabitGroupButtonWrap sx={{ px: 0.5 }}>
            <AddHabitGroupButton onClick={openCreateGroupDialog} />
          </AddHabitGroupButtonWrap>
          <HabitGroupFormDialog
            open={groupDialogOpen}
            onClose={() => setGroupDialogOpen(false)}
            onSave={handleSaveGroup}
            saving={isSavingGroup}
            mode={groupDialogMode}
            initialSection={editingSection}
          />
        </>
      )}
    </Box>
  );
};

const MemoizedRutinaTable = memo(RutinaTable, (prevProps, nextProps) => {
  const prevConfig = JSON.stringify(prevProps.rutina?.config || {});
  const nextConfig = JSON.stringify(nextProps.rutina?.config || {});
  if (prevConfig !== nextConfig) return false;

  return (
    prevProps.loading === nextProps.loading
    && prevProps.rutina?._id === nextProps.rutina?._id
    && prevProps.rutina?.fecha === nextProps.rutina?.fecha
  );
});

export default MemoizedRutinaTable;
